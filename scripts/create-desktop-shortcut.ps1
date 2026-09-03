# Creates YouPeak.lnk on the Windows desktop (Tauri release exe).

$ErrorActionPreference = "Stop"
$Desktop = [Environment]::GetFolderPath("Desktop")
$YouPeakRoot = Split-Path -Parent $PSScriptRoot
$Exe = Join-Path $YouPeakRoot "src-tauri\target\release\youpeak.exe"
$Icon = Join-Path $YouPeakRoot "src-tauri\icons\icon.ico"

Push-Location $YouPeakRoot
try {
    npm run icon:desktop | Out-Host
} finally {
    Pop-Location
}

if (-not (Test-Path $Exe)) {
    Write-Warning "YouPeak: executable not found at $Exe - run npm run tauri:build first."
    exit 1
}

if (-not (Test-Path $Icon)) {
    Write-Warning "YouPeak: icon not found at $Icon - run npm run icon:desktop first."
    exit 1
}

$ShortcutPath = Join-Path $Desktop "YouPeak.lnk"
if (Test-Path $ShortcutPath) {
    Remove-Item -Force $ShortcutPath
}

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Exe
$Shortcut.WorkingDirectory = $YouPeakRoot
$Shortcut.IconLocation = "$Icon,0"
$Shortcut.Description = "YouPeak gym journal"
$Shortcut.Save()

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class ShellNotify {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(int eventId, uint flags, IntPtr item1, IntPtr item2);
}
"@
[ShellNotify]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
$null = Start-Process "ie4uinit.exe" -ArgumentList "-show" -WindowStyle Hidden -ErrorAction SilentlyContinue

Write-Host "Created shortcut: $ShortcutPath"
Write-Host "Icon: $Icon,0"
