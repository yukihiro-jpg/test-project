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
