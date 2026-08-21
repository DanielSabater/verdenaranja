$code = @'
using System;
using System.Runtime.InteropServices;

public class ShellNotifier {
    [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    public static extern void SHChangeNotify(int wEventId, uint uFlags, IntPtr dwItem1, IntPtr dwItem2);

    public static void Refresh() {
        // SHCNE_ASSOCCHANGED = 0x08000000, SHCNF_IDLIST = 0x0000
        SHChangeNotify(0x08000000, 0, IntPtr.Zero, IntPtr.Zero);
    }
}
'@

Add-Type -TypeDefinition $code
[ShellNotifier]::Refresh()
Write-Host "Caché de iconos de Windows notificada y refrescada."
