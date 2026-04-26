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

# ══════════════════════════════════════════════
#  設定読み込み
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

    $localFolder = $cfg.local_folder
    if ($localFolder -match '%') {
        $localFolder = [Environment]::ExpandEnvironmentVariables($localFolder)
    }
    if (-not $localFolder) {
        $localFolder = Join-Path ([Environment]::GetFolderPath("Desktop")) "日下部税理士事務所"
    }

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
        ClientName           = $cfg.client_name
        DeviceName           = if ($cfg.device_name) { $cfg.device_name } else { "default" }
        LocalFolder          = $localFolder
        ServiceAccountKeyPath = $saKeyPath
        SharedDriveId        = $cfg.shared_drive_id
        RootFolderName       = if ($cfg.gdrive_root_folder_name) { $cfg.gdrive_root_folder_name } else { "02_顧問先共有フォルダ" }
        SyncPairs            = @($cfg.sync_pairs)
        MaxFileSizeBytes     = $maxSizeMB * 1048576
        AllowedExtensions    = $allowedExt
        LogLevel             = if ($cfg.log_level) { $cfg.log_level } else { "INFO" }
        ManifestPath         = Join-Path $appDir "sync_manifest.json"
        LogPath              = Join-Path $appDir "sync.log"
        UploadLogPath        = Join-Path $appDir "upload_log.json"
        AppDir               = $appDir
    }
}

function Initialize-Logging {
    param([hashtable]$Config)
    $script:LogFile = $Config.LogPath
    $logDir = [IO.Path]::GetDirectoryName($script:LogFile)
    if (-not (Test-Path $logDir)) {
        New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    }
    if (Test-Path $script:LogFile) {
        if ((Get-Item $script:LogFile).Length -gt $script:MAX_LOG_BYTES) {
            Move-Item -Path $script:LogFile -Destination "$($script:LogFile).1" -Force
        }
    }
}

function Test-FileAllowed {
    param(
        [string]$FileName,
        [hashtable]$Config
    )
    $ext = [IO.Path]::GetExtension($FileName).ToLower()
    return ($ext -and ($Config.AllowedExtensions -contains $ext))
}

# ここから先のセクション（認証、Drive API、同期ロジック、メイン処理）は後続で追加

