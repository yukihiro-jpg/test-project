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
