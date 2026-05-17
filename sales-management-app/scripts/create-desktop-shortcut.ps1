# デスクトップに「販売管理」ショートカットを作成します。
# 使い方: PowerShell でこのスクリプトを実行
#   powershell -ExecutionPolicy Bypass -File scripts\create-desktop-shortcut.ps1

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$launcher    = Join-Path $projectRoot 'launch.bat'
$iconSource  = Join-Path $projectRoot 'resources\icon.ico'
$desktop     = [Environment]::GetFolderPath('Desktop')
$shortcut    = Join-Path $desktop '販売管理.lnk'

if (-not (Test-Path $launcher)) {
  Write-Error "launch.bat が見つかりません: $launcher"
  exit 1
}

$wsh = New-Object -ComObject WScript.Shell
$lnk = $wsh.CreateShortcut($shortcut)
$lnk.TargetPath       = $launcher
$lnk.WorkingDirectory = $projectRoot
$lnk.WindowStyle      = 1
$lnk.Description      = '販売管理アプリを起動'
if (Test-Path $iconSource) {
  $lnk.IconLocation = "$iconSource,0"
} else {
  # 既定のアイコン（cmd.exe）
  $lnk.IconLocation = "$env:WINDIR\System32\shell32.dll,167"
}
$lnk.Save()

Write-Host "デスクトップにショートカットを作成しました:"
Write-Host "  $shortcut"
Write-Host ""
Write-Host "ダブルクリックで「販売管理」アプリが起動します。"
