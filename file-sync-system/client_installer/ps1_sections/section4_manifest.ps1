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
