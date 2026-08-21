$icoSource = "c:\Users\Admin\Desktop\VN\verdenaranja\public\favicon.ico"
$crxPath = "C:\Users\Admin\AppData\Local\Google\Chrome\User Data\Default\Web Applications"

if (Test-Path $crxPath) {
    Get-ChildItem -Path $crxPath -Recurse -Filter "*.ico" | Where-Object { $_.FullName -like "*Perla*" -or $_.Directory.Name -like "*pkojibjnhbhpaihkednmkdnldiecncfe*" } | ForEach-Object {
        Copy-Item -Path $icoSource -Destination $_.FullName -Force
        Write-Host "Reemplazado ico en: $($_.FullName)"
    }
}

$wsh = New-Object -ComObject WScript.Shell

$searchDirs = @(
    "$env:APPDATA\Microsoft\Windows\Start Menu\Programs",
    "$env:USERPROFILE\Desktop",
    "$env:APPDATA\Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar"
)

foreach ($dir in $searchDirs) {
    if (Test-Path $dir) {
        Get-ChildItem -Path $dir -Recurse -Filter "*Perla*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            $sc = $wsh.CreateShortcut($_.FullName)
            $sc.IconLocation = "$icoSource,0"
            $sc.Save()
            Write-Host "Icono asignado en acceso directo: $($_.FullName)"
        }
        Get-ChildItem -Path $dir -Recurse -Filter "*perla*.lnk" -ErrorAction SilentlyContinue | ForEach-Object {
            $sc = $wsh.CreateShortcut($_.FullName)
            $sc.IconLocation = "$icoSource,0"
            $sc.Save()
            Write-Host "Icono asignado en acceso directo: $($_.FullName)"
        }
    }
}

Write-Host "Completado con exito."
