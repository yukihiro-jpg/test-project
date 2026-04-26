#Requires -Version 5.1
# 日下部税理士事務所 ファイル同期エージェント (PowerShell版)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# ══════════════════════════════════════════════
#  グローバル状態
# ══════════════════════════════════════════════
$script:AccessToken = $null
$script:AccessTokenExpiry = [datetime]::MinValue
$script:LogFile = $null
$script:SharedDriveId = $null
$script:ServiceAccountKeyPath = $null
$script:OperationsLog = [System.Collections.ArrayList]::new()

# ══════════════════════════════════════════════
#  定数
# ══════════════════════════════════════════════
$script:MAX_RETRIES = 5
$script:RETRY_BASE_DELAY = 1
$script:DRIVE_API = "https://www.googleapis.com/drive/v3"
$script:DRIVE_UPLOAD = "https://www.googleapis.com/upload/drive/v3"
$script:FOLDER_MIME = "application/vnd.google-apps.folder"
$script:SCOPE = "https://www.googleapis.com/auth/drive"
$script:MAX_LOG_BYTES = 5242880  # 5MB

# ══════════════════════════════════════════════
#  ユーティリティ関数
# ══════════════════════════════════════════════

function Write-SyncLog {
    param(
        [ValidateSet("INFO","WARN","ERROR","DEBUG")]
        [string]$Level = "INFO",
        [string]$Message
    )
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "$ts [$Level] $Message"
    if ($script:LogFile) {
        try { $line | Out-File -FilePath $script:LogFile -Append -Encoding utf8 } catch {}
    }
    if ($Level -eq "ERROR") { Write-Host $line -ForegroundColor Red }
    elseif ($Level -eq "WARN") { Write-Host $line -ForegroundColor Yellow }
    else { Write-Host $line }
}

function ConvertTo-Base64Url {
    param([byte[]]$Bytes)
    return [Convert]::ToBase64String($Bytes).TrimEnd('=').Replace('+','-').Replace('/','_')
}

function Get-FileMD5 {
    param([string]$Path)
    $md5 = [Security.Cryptography.MD5]::Create()
    try {
        $stream = [IO.File]::OpenRead($Path)
        try {
            $hash = $md5.ComputeHash($stream)
            return [BitConverter]::ToString($hash).Replace("-","").ToLower()
        } finally { $stream.Close() }
    } finally { $md5.Dispose() }
}

function Get-LocalMtime {
    param([string]$Path)
    return (Get-Item $Path).LastWriteTime.ToString("o")
}

# ══════════════════════════════════════════════
#  設定読み込み (config.py → Read-SyncConfig)
# ══════════════════════════════════════════════

function Read-SyncConfig {
    param([string]$ConfigPath)

    $appDir = Join-Path $env:APPDATA "KusakabeSyncAgent"
    if (-not $ConfigPath) { $ConfigPath = Join-Path $appDir "config.json" }

    if (-not (Test-Path $ConfigPath)) {
        throw "設定ファイルが見つかりません: $ConfigPath"
    }

    $cfg = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

    if (-not $cfg.client_name) { throw "config: client_name が必要です" }
    if (-not $cfg.service_account_key_path) { throw "config: service_account_key_path が必要です" }
    if (-not $cfg.sync_pairs -or $cfg.sync_pairs.Count -eq 0) { throw "config: sync_pairs が必要です" }

    # local_folder: 環境変数展開、デフォルトはデスクトップ
    $localFolder = $cfg.local_folder
    if ($localFolder -and $localFolder -match '%') {
        $localFolder = [Environment]::ExpandEnvironmentVariables($localFolder)
    }
    if (-not $localFolder) {
        $localFolder = Join-Path ([Environment]::GetFolderPath("Desktop")) "日下部税理士事務所"
    }

    # service_account_key_path: 相対パスならAPP_DATA_DIR基準
    $saKeyPath = $cfg.service_account_key_path
    if (-not [IO.Path]::IsPathRooted($saKeyPath)) {
        $saKeyPath = Join-Path $appDir $saKeyPath
    }

    $maxSizeMB = if ($cfg.max_file_size_mb) { $cfg.max_file_size_mb } else { 100 }
    $allowedExt = if ($cfg.allowed_extensions) {
        @($cfg.allowed_extensions)
    } else {
        @(".pdf",".csv",".xlsx",".xls",".doc",".docx",".jpg",".jpeg",".png",".txt",".zip")
    }

    return @{
        ClientName            = $cfg.client_name
        DeviceName            = if ($cfg.device_name) { $cfg.device_name } else { "default" }
        LocalFolder           = $localFolder
        ServiceAccountKeyPath = $saKeyPath
        SharedDriveId         = $cfg.shared_drive_id
        RootFolderName        = if ($cfg.gdrive_root_folder_name) { $cfg.gdrive_root_folder_name } else { "02_顧問先共有フォルダ" }
        SyncPairs             = @($cfg.sync_pairs)
        MaxFileSizeBytes      = $maxSizeMB * 1048576
        AllowedExtensions     = $allowedExt
        LogLevel              = if ($cfg.log_level) { $cfg.log_level } else { "INFO" }
        ManifestPath          = Join-Path $appDir "sync_manifest.json"
        LogPath               = Join-Path $appDir "sync.log"
        UploadLogPath         = Join-Path $appDir "upload_log.json"
        AppDir                = $appDir
    }
}

# ══════════════════════════════════════════════
#  ログ初期化 (run_sync.py → setup_logging)
# ══════════════════════════════════════════════

function Initialize-Logging {
    param([hashtable]$Config)
    $script:LogFile = $Config.LogPath
    $logDir = [IO.Path]::GetDirectoryName($script:LogFile)
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    # 簡易ログローテーション (5MB超で.1にリネーム)
    if (Test-Path $script:LogFile) {
        if ((Get-Item $script:LogFile).Length -gt $script:MAX_LOG_BYTES) {
            Move-Item -Path $script:LogFile -Destination "$($script:LogFile).1" -Force
        }
    }
}

# ══════════════════════════════════════════════
#  ファイルフィルタ (config.py → is_file_allowed)
# ══════════════════════════════════════════════

function Test-FileAllowed {
    param(
        [string]$FileName,
        [hashtable]$Config
    )
    $ext = [IO.Path]::GetExtension($FileName).ToLower()
    return ($ext -and ($Config.AllowedExtensions -contains $ext))
}
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
# ══════════════════════════════════════════════
#  Google Drive 操作関数 (drive_client.py)
# ══════════════════════════════════════════════

# --- フォルダ検索 (find_folder_by_name) ---
function Find-DriveFolder {
    param(
        [string]$Name,
        [string]$ParentId
    )
    $q = "name = '$Name' and mimeType = '$($script:FOLDER_MIME)' and trashed = false"
    if ($ParentId) { $q += " and '$ParentId' in parents" }

    $uri = "$($script:DRIVE_API)/files?q=$([Uri]::EscapeDataString($q))&fields=$([Uri]::EscapeDataString('files(id,name)'))&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true"

    # 共有ドライブでルート検索時はcorpora=driveを指定
    if ($script:SharedDriveId -and -not $ParentId) {
        $uri += "&corpora=drive&driveId=$($script:SharedDriveId)"
    }

    $res = Invoke-DriveApi -Uri $uri
    if ($res.files -and $res.files.Count -gt 0) {
        return $res.files[0].id
    }
    return $null
}

# --- ファイル一覧 再帰取得 (list_files + _list_files_recursive) ---
function Get-DriveFiles {
    param(
        [string]$FolderId,
        [string]$PathPrefix = ""
    )

    $results = [System.Collections.ArrayList]::new()
    $pageToken = $null

    do {
        $q = "'$FolderId' in parents and trashed = false"
        $fields = "nextPageToken,files(id,name,mimeType,md5Checksum,modifiedTime,size)"
        $uri = "$($script:DRIVE_API)/files?q=$([Uri]::EscapeDataString($q))&fields=$([Uri]::EscapeDataString($fields))&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true"
        if ($pageToken) { $uri += "&pageToken=$([Uri]::EscapeDataString($pageToken))" }

        $res = Invoke-DriveApi -Uri $uri

        foreach ($f in $res.files) {
            $relPath = if ($PathPrefix) { "$PathPrefix$($f.name)" } else { $f.name }

            if ($f.mimeType -eq $script:FOLDER_MIME) {
                # フォルダ → 再帰
                $subFiles = Get-DriveFiles -FolderId $f.id -PathPrefix "$relPath/"
                foreach ($sf in $subFiles) { [void]$results.Add($sf) }
            } else {
                [void]$results.Add(@{
                    id           = $f.id
                    name         = $f.name
                    mimeType     = $f.mimeType
                    md5Checksum  = if ($f.md5Checksum) { $f.md5Checksum } else { "" }
                    modifiedTime = $f.modifiedTime
                    size         = if ($f.size) { [long]$f.size } else { 0 }
                    path         = $relPath
                })
            }
        }

        $pageToken = $null
        if ($res.PSObject.Properties.Name -contains "nextPageToken") {
            $pageToken = $res.nextPageToken
        }
    } while ($pageToken)

    return ,$results
}

# --- フォルダ作成 (create_folder) ---
function New-DriveFolder {
    param(
        [string]$Name,
        [string]$ParentId
    )
    $metadata = @{
        name     = $Name
        mimeType = $script:FOLDER_MIME
        parents  = @($ParentId)
    } | ConvertTo-Json -Compress -Depth 3
    $uri = "$($script:DRIVE_API)/files?supportsAllDrives=true"
    $res = Invoke-DriveApi -Uri $uri -Method POST -Body $metadata
    Write-SyncLog "INFO" "フォルダ作成: $Name"
    return $res.id
}

# --- フォルダパス確保 (ensure_folder_path) ---
function Ensure-DriveFolderPath {
    param(
        [string]$ParentId,
        [string[]]$Parts
    )
    $currentId = $ParentId
    foreach ($part in $Parts) {
        $folderId = Find-DriveFolder -Name $part -ParentId $currentId
        if (-not $folderId) {
            $folderId = New-DriveFolder -Name $part -ParentId $currentId
        }
        $currentId = $folderId
    }
    return $currentId
}

# --- ファイルアップロード・新規 (upload_file) ---
#     Resumable Upload: POST で開始 → PUT でバイト送信
function Send-DriveFile {
    param(
        [string]$LocalPath,
        [string]$FolderId,
        [string]$RemoteName
    )

    if (-not $RemoteName) { $RemoteName = [IO.Path]::GetFileName($LocalPath) }
    $fileSize = (Get-Item $LocalPath).Length

    # Resumable Upload 開始
    $metadata = @{
        name    = $RemoteName
        parents = @($FolderId)
    } | ConvertTo-Json -Compress -Depth 3

    $fieldsParam = [Uri]::EscapeDataString("id,name,md5Checksum,modifiedTime,size")
    $initUri = "$($script:DRIVE_UPLOAD)/files?uploadType=resumable&supportsAllDrives=true&fields=$fieldsParam"
    $initHeaders = @{
        "X-Upload-Content-Type"   = "application/octet-stream"
        "X-Upload-Content-Length" = $fileSize.ToString()
    }

    $initRes = Invoke-DriveApi -Uri $initUri -Method POST -Body $metadata -ExtraHeaders $initHeaders -RawResponse
    $uploadUri = $initRes.Headers["Location"]

    # ファイルバイト送信
    $fileBytes = [IO.File]::ReadAllBytes($LocalPath)
    $result = Invoke-DriveApi -Uri $uploadUri -Method PUT -BodyBytes $fileBytes -ContentType "application/octet-stream"

    Write-SyncLog "INFO" "アップロード完了: $RemoteName ($([Math]::Round($fileSize / 1024))KB)"
    return $result
}

# --- ファイルアップロード・更新 (update_file) ---
function Update-DriveFile {
    param(
        [string]$FileId,
        [string]$LocalPath
    )

    $fileSize = (Get-Item $LocalPath).Length

    $fieldsParam = [Uri]::EscapeDataString("id,name,md5Checksum,modifiedTime,size")
    $initUri = "$($script:DRIVE_UPLOAD)/files/${FileId}?uploadType=resumable&supportsAllDrives=true&fields=$fieldsParam"
    $initHeaders = @{
        "X-Upload-Content-Type"   = "application/octet-stream"
        "X-Upload-Content-Length" = $fileSize.ToString()
    }

    $initRes = Invoke-DriveApi -Uri $initUri -Method PATCH -Body "{}" -ExtraHeaders $initHeaders -RawResponse
    $uploadUri = $initRes.Headers["Location"]

    $fileBytes = [IO.File]::ReadAllBytes($LocalPath)
    $result = Invoke-DriveApi -Uri $uploadUri -Method PUT -BodyBytes $fileBytes -ContentType "application/octet-stream"

    Write-SyncLog "INFO" "更新アップロード: $([IO.Path]::GetFileName($LocalPath)) ($([Math]::Round($fileSize / 1024))KB)"
    return $result
}

# --- ファイルダウンロード (download_file) ---
function Save-DriveFile {
    param(
        [string]$FileId,
        [string]$LocalPath
    )

    $dir = [IO.Path]::GetDirectoryName($LocalPath)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $uri = "$($script:DRIVE_API)/files/${FileId}?alt=media&supportsAllDrives=true"
    Invoke-DriveApi -Uri $uri -OutFile $LocalPath -RawResponse | Out-Null

    Write-SyncLog "INFO" "ダウンロード完了: $([IO.Path]::GetFileName($LocalPath))"
}
# ══════════════════════════════════════════════
#  マニフェスト管理 (manifest.py → SyncManifest)
#  PSCustomObject で同期状態を管理
# ══════════════════════════════════════════════

# --- 読み込み (SyncManifest.__init__ + load) ---
function Read-Manifest {
    param([string]$Path)

    if (Test-Path $Path) {
        try {
            $raw = Get-Content $Path -Raw -Encoding UTF8
            $data = $raw | ConvertFrom-Json
            # files プロパティが無ければ補完
            if (-not ($data.PSObject.Properties.Name -contains "files")) {
                $data | Add-Member -NotePropertyName "files" -NotePropertyValue ([PSCustomObject]@{})
            }
            return $data
        } catch {
            Write-SyncLog "WARN" "マニフェスト読み込みエラー: $_"
        }
    }

    return [PSCustomObject]@{
        schema_version = 1
        last_sync_utc  = $null
        files          = [PSCustomObject]@{}
    }
}

# --- 保存 (SyncManifest.save) アトミック書き込み ---
function Save-Manifest {
    param(
        [PSCustomObject]$Manifest,
        [string]$Path
    )

    $Manifest.last_sync_utc = (Get-Date).ToUniversalTime().ToString("o")

    $dir = [IO.Path]::GetDirectoryName($Path)
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    $tmpPath = "$Path.tmp"
    try {
        $Manifest | ConvertTo-Json -Depth 10 | Out-File -FilePath $tmpPath -Encoding utf8
        Move-Item -Path $tmpPath -Destination $Path -Force
    } catch {
        if (Test-Path $tmpPath) { Remove-Item $tmpPath -Force -ErrorAction SilentlyContinue }
        throw
    }
}

# --- 参照 (SyncManifest.get_file_state) ---
function Get-ManifestEntry {
    param(
        [PSCustomObject]$Manifest,
        [string]$Key
    )

    if ($Manifest.files.PSObject.Properties.Name -contains $Key) {
        return $Manifest.files.$Key
    }
    return $null
}

# --- 更新 (SyncManifest.update_file_state) ---
function Set-ManifestEntry {
    param(
        [PSCustomObject]$Manifest,
        [string]$Key,
        [hashtable]$Value
    )

    $entry = [PSCustomObject]$Value
    $entry | Add-Member -NotePropertyName "last_synced_utc" -NotePropertyValue ((Get-Date).ToUniversalTime().ToString("o")) -Force

    if ($Manifest.files.PSObject.Properties.Name -contains $Key) {
        $Manifest.files.$Key = $entry
    } else {
        $Manifest.files | Add-Member -NotePropertyName $Key -NotePropertyValue $entry
    }
}
# ══════════════════════════════════════════════
#  同期ロジック (sync_engine.py)
# ══════════════════════════════════════════════

# --- アップロード同期 (_sync_upload) ---
#  条件1: ローカルのみ & マニフェストなし → 新規アップロード
#  条件2: 両方あり & マニフェストあり → ローカルMD5変更時に更新
#  条件3: 両方あり & マニフェストなし → MD5不一致なら新規アップロード、一致ならマニフェスト登録のみ
function Invoke-SyncUpload {
    param(
        [string]$LocalDir,
        [string]$DriveFolderId,
        [string]$ManifestPrefix,
        [PSCustomObject]$Manifest,
        [hashtable]$Config
    )

    $uploaded = 0

    if (-not (Test-Path $LocalDir)) { return $uploaded }

    # ローカルファイル収集 (拡張子・サイズフィルタ)
    $localFiles = @{}
    Get-ChildItem -Path $LocalDir -File -Recurse | ForEach-Object {
        if ((Test-FileAllowed $_.Name $Config) -and $_.Length -le $Config.MaxFileSizeBytes) {
            $rel = $_.FullName.Substring($LocalDir.Length).TrimStart('\','/').Replace('\','/')
            $localFiles[$rel] = $_
        }
    }

    if ($localFiles.Count -eq 0) { return $uploaded }

    # Driveファイル取得
    $driveFiles = Get-DriveFiles -FolderId $DriveFolderId
    $driveMap = @{}
    foreach ($df in $driveFiles) { $driveMap[$df.path] = $df }

    foreach ($rel in $localFiles.Keys) {
        $localFile = $localFiles[$rel]
        $manifestKey = "$ManifestPrefix/$rel"
        $state = Get-ManifestEntry $Manifest $manifestKey
        $localMd5 = Get-FileMD5 $localFile.FullName

        try {
            if (-not $driveMap.ContainsKey($rel) -and $null -eq $state) {
                # 条件1: ローカルのみ & マニフェストなし → 新規アップロード
                $pathParts = $rel -split '/'
                $fileName = $pathParts[-1]
                $targetFolderId = $DriveFolderId
                if ($pathParts.Count -gt 1) {
                    $targetFolderId = Ensure-DriveFolderPath $DriveFolderId $pathParts[0..($pathParts.Count - 2)]
                }
                $result = Send-DriveFile -LocalPath $localFile.FullName -FolderId $targetFolderId -RemoteName $fileName
                Set-ManifestEntry $Manifest $manifestKey @{
                    local_md5  = $localMd5
                    local_mtime = Get-LocalMtime $localFile.FullName
                    local_size = $localFile.Length
                    gdrive_id  = $result.id
                    gdrive_md5 = if ($result.md5Checksum) { $result.md5Checksum } else { "" }
                    origin     = "local"
                }
                [void]$script:OperationsLog.Add(@{
                    timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                    client_name = $Config.ClientName
                    device_name = $Config.DeviceName
                    operation  = "upload"
                    file_path  = $rel
                    size_bytes = $localFile.Length
                })
                Write-SyncLog "INFO" "[upload] $rel ($($localFile.Length) bytes)"
                $uploaded++

            } elseif ($driveMap.ContainsKey($rel) -and $null -ne $state) {
                # 条件2: 両方あり & マニフェストあり → ローカルMD5変更時に更新
                if ($localMd5 -ne $state.local_md5) {
                    $driveFile = $driveMap[$rel]
                    $result = Update-DriveFile -FileId $driveFile.id -LocalPath $localFile.FullName
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        local_mtime = Get-LocalMtime $localFile.FullName
                        local_size = $localFile.Length
                        gdrive_id  = $result.id
                        gdrive_md5 = if ($result.md5Checksum) { $result.md5Checksum } else { "" }
                        origin     = "local"
                    }
                    [void]$script:OperationsLog.Add(@{
                        timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                        client_name = $Config.ClientName
                        device_name = $Config.DeviceName
                        operation  = "update_upload"
                        file_path  = $rel
                        size_bytes = $localFile.Length
                    })
                    Write-SyncLog "INFO" "[update_upload] $rel ($($localFile.Length) bytes)"
                    $uploaded++
                }

            } elseif ($driveMap.ContainsKey($rel) -and $null -eq $state) {
                # 条件3: 両方あり & マニフェストなし → MD5比較
                $driveFile = $driveMap[$rel]
                $driveMd5 = if ($driveFile.md5Checksum) { $driveFile.md5Checksum } else { "" }
                if ($localMd5 -ne $driveMd5) {
                    $result = Update-DriveFile -FileId $driveFile.id -LocalPath $localFile.FullName
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        local_mtime = Get-LocalMtime $localFile.FullName
                        local_size = $localFile.Length
                        gdrive_id  = $result.id
                        gdrive_md5 = if ($result.md5Checksum) { $result.md5Checksum } else { "" }
                        origin     = "local"
                    }
                    [void]$script:OperationsLog.Add(@{
                        timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                        client_name = $Config.ClientName
                        device_name = $Config.DeviceName
                        operation  = "update_upload"
                        file_path  = $rel
                        size_bytes = $localFile.Length
                    })
                    Write-SyncLog "INFO" "[update_upload] $rel ($($localFile.Length) bytes)"
                    $uploaded++
                } else {
                    # MD5一致 → マニフェスト登録のみ
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        gdrive_id  = $driveFile.id
                        gdrive_md5 = $driveMd5
                        origin     = "local"
                    }
                }
            }
            # 暗黙のケース: ローカルのみ & マニフェストあり → 以前同期済みでDriveから削除 → スキップ
        } catch {
            Write-SyncLog "ERROR" "アップロードエラー: $rel - $_"
        }
    }

    return $uploaded
}

# --- ダウンロード同期 (_sync_download) ---
#  条件1: Driveのみ & マニフェストなし → ダウンロード
#  条件2: 両方あり & マニフェストあり → Drive MD5変更時にダウンロード
#  条件3: 両方あり & マニフェストなし → MD5不一致ならダウンロード、一致ならマニフェスト登録のみ
function Invoke-SyncDownload {
    param(
        [string]$LocalDir,
        [string]$DriveFolderId,
        [string]$ManifestPrefix,
        [PSCustomObject]$Manifest,
        [hashtable]$Config
    )

    $downloaded = 0

    # Driveファイル取得
    $driveFiles = Get-DriveFiles -FolderId $DriveFolderId
    $driveMap = @{}
    foreach ($df in $driveFiles) { $driveMap[$df.path] = $df }

    # ローカルファイル収集
    $localFiles = @{}
    if (Test-Path $LocalDir) {
        Get-ChildItem -Path $LocalDir -File -Recurse | ForEach-Object {
            $rel = $_.FullName.Substring($LocalDir.Length).TrimStart('\','/').Replace('\','/')
            $localFiles[$rel] = $_
        }
    }

    foreach ($rel in $driveMap.Keys) {
        $driveFile = $driveMap[$rel]

        if (-not (Test-FileAllowed $driveFile.name $Config)) { continue }

        $localPath = Join-Path $LocalDir ($rel.Replace('/','\'))
        $manifestKey = "$ManifestPrefix/$rel"
        $state = Get-ManifestEntry $Manifest $manifestKey
        $driveMd5 = if ($driveFile.md5Checksum) { $driveFile.md5Checksum } else { "" }

        try {
            if (-not $localFiles.ContainsKey($rel) -and $null -eq $state) {
                # 条件1: Driveのみ & マニフェストなし → ダウンロード
                Save-DriveFile -FileId $driveFile.id -LocalPath $localPath
                $localMd5 = Get-FileMD5 $localPath
                Set-ManifestEntry $Manifest $manifestKey @{
                    local_md5  = $localMd5
                    local_mtime = Get-LocalMtime $localPath
                    local_size = [long]$driveFile.size
                    gdrive_id  = $driveFile.id
                    gdrive_md5 = $driveMd5
                    origin     = "remote"
                }
                [void]$script:OperationsLog.Add(@{
                    timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                    client_name = $Config.ClientName
                    device_name = $Config.DeviceName
                    operation  = "download"
                    file_path  = $rel
                    size_bytes = [long]$driveFile.size
                })
                Write-SyncLog "INFO" "[download] $rel ($($driveFile.size) bytes)"
                $downloaded++

            } elseif ($localFiles.ContainsKey($rel) -and $null -ne $state) {
                # 条件2: 両方あり & マニフェストあり → Drive MD5変更時にダウンロード
                if ($driveMd5 -and $driveMd5 -ne $state.gdrive_md5) {
                    Save-DriveFile -FileId $driveFile.id -LocalPath $localPath
                    $localMd5 = Get-FileMD5 $localPath
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        local_mtime = Get-LocalMtime $localPath
                        local_size = [long]$driveFile.size
                        gdrive_id  = $driveFile.id
                        gdrive_md5 = $driveMd5
                        origin     = "remote"
                    }
                    [void]$script:OperationsLog.Add(@{
                        timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                        client_name = $Config.ClientName
                        device_name = $Config.DeviceName
                        operation  = "download"
                        file_path  = $rel
                        size_bytes = [long]$driveFile.size
                    })
                    Write-SyncLog "INFO" "[download] $rel ($($driveFile.size) bytes)"
                    $downloaded++
                }

            } elseif ($localFiles.ContainsKey($rel) -and $null -eq $state) {
                # 条件3: 両方あり & マニフェストなし → MD5比較
                $localMd5 = Get-FileMD5 $localPath
                if ($localMd5 -ne $driveMd5) {
                    Save-DriveFile -FileId $driveFile.id -LocalPath $localPath
                    $localMd5 = Get-FileMD5 $localPath
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        local_mtime = Get-LocalMtime $localPath
                        local_size = [long]$driveFile.size
                        gdrive_id  = $driveFile.id
                        gdrive_md5 = $driveMd5
                        origin     = "remote"
                    }
                    [void]$script:OperationsLog.Add(@{
                        timestamp  = (Get-Date).ToUniversalTime().ToString("o")
                        client_name = $Config.ClientName
                        device_name = $Config.DeviceName
                        operation  = "download"
                        file_path  = $rel
                        size_bytes = [long]$driveFile.size
                    })
                    Write-SyncLog "INFO" "[download] $rel ($($driveFile.size) bytes)"
                    $downloaded++
                } else {
                    # MD5一致 → マニフェスト登録のみ
                    Set-ManifestEntry $Manifest $manifestKey @{
                        local_md5  = $localMd5
                        gdrive_id  = $driveFile.id
                        gdrive_md5 = $driveMd5
                        origin     = "remote"
                    }
                }
            }
            # 暗黙のケース: Driveのみ & マニフェストあり → 以前同期済みでローカル削除 → スキップ
        } catch {
            Write-SyncLog "ERROR" "ダウンロードエラー: $rel - $_"
        }
    }

    return $downloaded
}

# --- 同期ログアップロード (_upload_sync_log) ---
function Send-SyncLog {
    param(
        [string]$ClientFolderId,
        [hashtable]$Config
    )

    if ($script:OperationsLog.Count -eq 0) { return }

    try {
        $logFolderId = Find-DriveFolder -Name "_sync_logs" -ParentId $ClientFolderId
        if (-not $logFolderId) {
            $logFolderId = New-DriveFolder -Name "_sync_logs" -ParentId $ClientFolderId
        }

        $logData = @{
            client_name = $Config.ClientName
            device_name = $Config.DeviceName
            sync_time   = (Get-Date).ToUniversalTime().ToString("o")
            operations  = @($script:OperationsLog)
        }

        $logFileName = "sync_log_$($Config.DeviceName)_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"
        $tmpFile = Join-Path $env:TEMP $logFileName
        $logData | ConvertTo-Json -Depth 5 | Out-File -FilePath $tmpFile -Encoding utf8

        try {
            Send-DriveFile -LocalPath $tmpFile -FolderId $logFolderId -RemoteName $logFileName | Out-Null
            Write-SyncLog "INFO" "同期ログアップロード完了: $logFileName"
        } finally {
            Remove-Item $tmpFile -Force -ErrorAction SilentlyContinue
        }
    } catch {
        Write-SyncLog "WARN" "同期ログのアップロードに失敗: $_"
    }
}

# --- エラーファイル出力 (_write_error_file) ---
function Write-ErrorFile {
    param(
        [string]$LocalFolder,
        [string]$ErrorMessage
    )
    try {
        $errorFile = Join-Path $LocalFolder "同期エラー.txt"
        $now = Get-Date -Format "yyyy/MM/dd HH:mm:ss"
        @"
ファイル同期でエラーが発生しました。
日時: $now
エラー内容: $ErrorMessage

この問題が続く場合は、日下部税理士事務所までご連絡ください。
"@ | Out-File -FilePath $errorFile -Encoding utf8
    } catch {}
}

# --- エラーファイル削除 (成功時に呼出) ---
function Remove-ErrorFile {
    param([string]$LocalFolder)
    $errorFile = Join-Path $LocalFolder "同期エラー.txt"
    if (Test-Path $errorFile) {
        Remove-Item $errorFile -Force -ErrorAction SilentlyContinue
    }
}
# ══════════════════════════════════════════════
#  メイン処理 (sync_engine.run + run_sync.main)
# ══════════════════════════════════════════════

function Start-Sync {
    param([string]$ConfigPath)

    # 設定読み込み
    $config = Read-SyncConfig -ConfigPath $ConfigPath
    Initialize-Logging $config

    Write-SyncLog "INFO" "===== 同期開始: $($config.ClientName) ($($config.DeviceName)) ====="

    $script:OperationsLog.Clear()
    $totalUploaded = 0
    $totalDownloaded = 0
    $syncError = $null

    try {
        # ローカルフォルダ作成 (config.ensure_local_folders)
        if (-not (Test-Path $config.LocalFolder)) {
            New-Item -ItemType Directory -Path $config.LocalFolder -Force | Out-Null
        }
        foreach ($pair in $config.SyncPairs) {
            $pairDir = Join-Path $config.LocalFolder $pair.local_folder
            if (-not (Test-Path $pairDir)) {
                New-Item -ItemType Directory -Path $pairDir -Force | Out-Null
            }
        }
        if (-not (Test-Path $config.AppDir)) {
            New-Item -ItemType Directory -Path $config.AppDir -Force | Out-Null
        }

        # 認証
        $null = Get-GoogleAccessToken -ServiceAccountKeyPath $config.ServiceAccountKeyPath

        # 顧問先フォルダ特定 (_find_client_folder_id)
        $script:SharedDriveId = $config.SharedDriveId
        if ($config.SharedDriveId) {
            $rootId = $config.SharedDriveId
        } else {
            $rootId = Find-DriveFolder -Name $config.RootFolderName
            if (-not $rootId) {
                throw "'$($config.RootFolderName)' フォルダが見つかりません。"
            }
        }

        $clientFolderId = Find-DriveFolder -Name $config.ClientName -ParentId $rootId
        if (-not $clientFolderId) {
            throw "'$($config.ClientName)' フォルダが見つかりません。"
        }
        Write-SyncLog "INFO" "顧問先フォルダを特定: $($config.ClientName)"

        # マニフェスト読み込み
        $manifest = Read-Manifest -Path $config.ManifestPath

        # sync_pairs ごとに同期実行
        foreach ($pair in $config.SyncPairs) {
            $localDir = Join-Path $config.LocalFolder $pair.local_folder
            $driveFolderName = $pair.drive_folder
            $direction = $pair.direction

            # Driveフォルダ検索、なければ作成
            $driveFolderId = Find-DriveFolder -Name $driveFolderName -ParentId $clientFolderId
            if (-not $driveFolderId) {
                $driveFolderId = New-DriveFolder -Name $driveFolderName -ParentId $clientFolderId
            }

            $manifestPrefix = "$direction/$($pair.local_folder)"

            if ($direction -eq "upload") {
                $count = Invoke-SyncUpload -LocalDir $localDir -DriveFolderId $driveFolderId `
                    -ManifestPrefix $manifestPrefix -Manifest $manifest -Config $config
                $totalUploaded += $count
            } elseif ($direction -eq "download") {
                $count = Invoke-SyncDownload -LocalDir $localDir -DriveFolderId $driveFolderId `
                    -ManifestPrefix $manifestPrefix -Manifest $manifest -Config $config
                $totalDownloaded += $count
            }
        }

        # マニフェスト保存
        Save-Manifest -Manifest $manifest -Path $config.ManifestPath

        # 同期ログアップロード
        if ($script:OperationsLog.Count -gt 0) {
            Send-SyncLog -ClientFolderId $clientFolderId -Config $config
        }

        # 成功時にエラーファイル削除
        Remove-ErrorFile -LocalFolder $config.LocalFolder

    } catch {
        $syncError = $_.Exception.Message
        Write-SyncLog "ERROR" "同期エラー: $syncError"
        Write-ErrorFile -LocalFolder $config.LocalFolder -ErrorMessage $syncError
    }

    Write-SyncLog "INFO" "===== 同期完了: UP ${totalUploaded}件, DL ${totalDownloaded}件 ====="

    if ($syncError) { exit 1 }
}

# ══════════════════════════════════════════════
#  エントリーポイント (run_sync.py → main)
# ══════════════════════════════════════════════

$configArg = $null
for ($i = 0; $i -lt $args.Count; $i++) {
    if ($args[$i] -in @("--config", "-c") -and ($i + 1) -lt $args.Count) {
        $configArg = $args[$i + 1]
    }
}

Start-Sync -ConfigPath $configArg
