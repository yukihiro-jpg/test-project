@echo off
chcp 65001 >nul

powershell -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell;" ^
  "$desktop = $ws.SpecialFolders('Desktop');" ^
  "$sc = $ws.CreateShortcut([IO.Path]::Combine($desktop, '相続税 保険資産分類.lnk'));" ^
  "$sc.TargetPath = '%~dp0start-app.bat';" ^
  "$sc.WorkingDirectory = '%~dp0';" ^
  "$sc.IconLocation = '%~dp0public\app-icon.ico,0';" ^
  "$sc.Description = '相続税 保険資産分類ツールを起動（自動更新付き）';" ^
  "$sc.WindowStyle = 1;" ^
  "$sc.Save();" ^
  "Write-Host 'デスクトップにショートカットを作成しました: 相続税 保険資産分類'"

echo.
pause
