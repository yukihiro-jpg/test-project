# ══════════════════════════════════════════════
#  JWT / OAuth2 認証 (drive_client.py → authenticate)
#  PS 5.1互換: CngKey.Import + Pkcs8PrivateBlob でRSA署名
# ══════════════════════════════════════════════

function Get-GoogleAccessToken {
    param([string]$ServiceAccountKeyPath)

    # 有効なトークンがあれば再利用
    if ($script:AccessToken -and [datetime]::UtcNow -lt $script:AccessTokenExpiry) {
        return $script:AccessToken
    }

    Write-SyncLog "INFO" "アクセストークンを取得中..."

    $sa = Get-Content $ServiceAccountKeyPath -Raw -Encoding UTF8 | ConvertFrom-Json

    # ── JWT Header ──
    $header = '{"alg":"RS256","typ":"JWT"}'
    $headerB64 = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($header))

    # ── JWT Claims ──
    $epoch = [datetime]::new(1970, 1, 1, 0, 0, 0, [DateTimeKind]::Utc)
    $now = [int]([datetime]::UtcNow - $epoch).TotalSeconds
    $claims = @{
        iss   = $sa.client_email
        scope = $script:SCOPE
        aud   = $sa.token_uri
        iat   = $now
        exp   = $now + 3600
    } | ConvertTo-Json -Compress
    $claimsB64 = ConvertTo-Base64Url ([Text.Encoding]::UTF8.GetBytes($claims))

    # ── RSA署名 (PS 5.1: CngKey.Import + Pkcs8PrivateBlob) ──
    $dataToSign = "$headerB64.$claimsB64"
    $dataBytes = [Text.Encoding]::UTF8.GetBytes($dataToSign)

    # PEM → DERバイト列に変換
    $pemLines = $sa.private_key -split "[\r\n]+" | Where-Object {
        $_ -notmatch "^-" -and $_.Trim() -ne ""
    }
    $keyBase64 = ($pemLines -join "").Trim()
    $keyBytes = [Convert]::FromBase64String($keyBase64)

    # CngKeyでインポートしRSACngで署名
    $cngKey = [Security.Cryptography.CngKey]::Import(
        $keyBytes,
        [Security.Cryptography.CngKeyBlobFormat]::Pkcs8PrivateBlob
    )
    $rsa = New-Object Security.Cryptography.RSACng($cngKey)
    try {
        $signature = $rsa.SignData(
            $dataBytes,
            [Security.Cryptography.HashAlgorithmName]::SHA256,
            [Security.Cryptography.RSASignaturePadding]::Pkcs1
        )
    } finally {
        $rsa.Dispose()
        $cngKey.Dispose()
    }
    $signatureB64 = ConvertTo-Base64Url $signature

    $jwt = "$dataToSign.$signatureB64"

    # ── トークン交換 ──
    $body = "grant_type=$([Uri]::EscapeDataString('urn:ietf:params:oauth:grant-type:jwt-bearer'))&assertion=$jwt"
    $response = Invoke-RestMethod -Uri $sa.token_uri -Method Post -Body $body -ContentType "application/x-www-form-urlencoded"

    $script:AccessToken = $response.access_token
    $script:AccessTokenExpiry = [datetime]::UtcNow.AddSeconds(3500)  # 余裕をもって100秒前に失効扱い
    $script:ServiceAccountKeyPath = $ServiceAccountKeyPath

    Write-SyncLog "INFO" "認証成功 (service account: $($sa.client_email))"
    return $script:AccessToken
}

# ══════════════════════════════════════════════
#  Drive API 共通呼び出し (drive_client.py → _retry_request)
#  リトライ: 429/500/502/503 で指数バックオフ
# ══════════════════════════════════════════════

function Invoke-DriveApi {
    param(
        [string]$Uri,
        [string]$Method = "GET",
        [string]$Body,
        [byte[]]$BodyBytes,
        [string]$ContentType = "application/json; charset=utf-8",
        [hashtable]$ExtraHeaders = @{},
        [string]$OutFile,
        [switch]$RawResponse
    )

    for ($attempt = 0; $attempt -le $script:MAX_RETRIES; $attempt++) {
        # トークン期限切れなら自動更新
        if ($script:ServiceAccountKeyPath -and [datetime]::UtcNow -ge $script:AccessTokenExpiry) {
            Get-GoogleAccessToken -ServiceAccountKeyPath $script:ServiceAccountKeyPath | Out-Null
        }

        $headers = @{ "Authorization" = "Bearer $script:AccessToken" }
        foreach ($k in $ExtraHeaders.Keys) { $headers[$k] = $ExtraHeaders[$k] }

        $params = @{
            Uri     = $Uri
            Method  = $Method
            Headers = $headers
        }

        if ($Body) {
            $params["Body"] = [Text.Encoding]::UTF8.GetBytes($Body)
            $params["ContentType"] = $ContentType
        } elseif ($BodyBytes) {
            $params["Body"] = $BodyBytes
            $params["ContentType"] = $ContentType
        }

        if ($OutFile) {
            $params["OutFile"] = $OutFile
        }

        try {
            if ($RawResponse) {
                return Invoke-WebRequest @params -UseBasicParsing
            } else {
                return Invoke-RestMethod @params
            }
        } catch {
            $statusCode = 0
            if ($_.Exception.Response) {
                $statusCode = [int]$_.Exception.Response.StatusCode
            }
            if ($statusCode -in @(429, 500, 502, 503) -and $attempt -lt $script:MAX_RETRIES) {
                $delay = $script:RETRY_BASE_DELAY * [Math]::Pow(2, $attempt)
                Write-SyncLog "WARN" "API error $statusCode, retry $($attempt+1)/$($script:MAX_RETRIES) in ${delay}s"
                Start-Sleep -Seconds $delay
            } else {
                throw
            }
        }
    }
}
