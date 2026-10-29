# Creates Duckrep.lnk on the Windows desktop (Tauri release exe) and removes the old YouPeak.lnk.

$ErrorActionPreference = "Stop"
# Shortcuts live in the Desktop\Roots folder.
$Desktop = Join-Path ([Environment]::GetFolderPath("Desktop")) "Roots"
New-Item -ItemType Directory -Force $Desktop | Out-Null
$AppRoot = Split-Path -Parent $PSScriptRoot
$Exe = Join-Path $AppRoot "src-tauri\target\release\duckrep.exe"
$Icon = Join-Path $AppRoot "src-tauri\icons\icon.ico"

Push-Location $AppRoot
try {
    npm run icon:desktop | Out-Host
} finally {
    Pop-Location
}

if (-not (Test-Path $Exe)) {
    Write-Warning "Duckrep: executable not found at $Exe - run npm run tauri:build first."
    exit 1
}

if (-not (Test-Path $Icon)) {
    Write-Warning "Duckrep: icon not found at $Icon - run npm run icon:desktop first."
    exit 1
}

$LegacyShortcut = Join-Path $Desktop "YouPeak.lnk"
if (Test-Path $LegacyShortcut) {
    Remove-Item -Force $LegacyShortcut
}

$ShortcutPath = Join-Path $Desktop "Duckrep.lnk"
if (Test-Path $ShortcutPath) {
    Remove-Item -Force $ShortcutPath
}

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $Exe
$Shortcut.WorkingDirectory = $AppRoot
$Shortcut.IconLocation = "$Icon,0"
$Shortcut.Description = "Duckrep - every rep, logged"
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
