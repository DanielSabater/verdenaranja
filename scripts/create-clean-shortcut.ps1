$icoSource = "c:\Users\Admin\Desktop\VN\verdenaranja\public\favicon.ico"
$chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$appUrl = "http://localhost:5173"

# 1. Eliminar accesos directos anteriores corruptos con la letra P
$oldPaths = @(
    "$env:USERPROFILE\Desktop\Perla Verde · Turnos.lnk",
    "$env:USERPROFILE\Desktop\Perla Verde.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\perla-verde.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Aplicaciones de Chrome\Perla Verde · Turnos.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Aplicaciones de Chrome\Perla Verde.lnk"
)

foreach ($p in $oldPaths) {
    if (Test-Path $p) {
        Remove-Item -Path $p -Force -ErrorAction SilentlyContinue
        Write-Host "Eliminado acceso directo viejo: $p"
    }
}

# 2. Crear nuevo acceso directo limpio en Escritorio y Menú Inicio
$wsh = New-Object -ComObject WScript.Shell

$destinations = @(
    "$env:USERPROFILE\Desktop\Perla Verde.lnk",
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Perla Verde.lnk"
)

foreach ($dest in $destinations) {
    $sc = $wsh.CreateShortcut($dest)
    $sc.TargetPath = $chromePath
    $sc.Arguments = "--app=$appUrl"
    $sc.IconLocation = "$icoSource,0"
    $sc.Description = "Perla Verde · Turnos"
    $sc.WorkingDirectory = "c:\Users\Admin\Desktop\VN\verdenaranja"
    $sc.Save()
    Write-Host "Creado acceso directo limpio en: $dest"
}

# 3. Notificar a Windows Explorer
$code = @'
using System;
using System.Runtime.InteropServices;

public class ShellRefresh {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

    public static void Refresh() {
        SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
    }
}
'@

Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
[ShellRefresh]::Refresh()

Write-Host "Proceso completado exitosamente."
