$wsh = New-Object -ComObject WScript.Shell
Get-ChildItem -Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Aplicaciones de Chrome" -Filter "*Perla*.lnk" | ForEach-Object {
    $sc = $wsh.CreateShortcut($_.FullName)
    Write-Host "File: $($_.FullName)"
    Write-Host "Target: $($sc.TargetPath)"
    Write-Host "Arguments: $($sc.Arguments)"
    Write-Host "IconLocation: $($sc.IconLocation)"
}
Get-ChildItem -Path "$env:USERPROFILE\Desktop" -Filter "*Perla*.lnk" | ForEach-Object {
    $sc = $wsh.CreateShortcut($_.FullName)
    Write-Host "Desktop File: $($_.FullName)"
    Write-Host "Target: $($sc.TargetPath)"
    Write-Host "Arguments: $($sc.Arguments)"
    Write-Host "IconLocation: $($sc.IconLocation)"
}
