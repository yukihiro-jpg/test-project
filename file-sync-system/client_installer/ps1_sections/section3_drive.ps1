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
