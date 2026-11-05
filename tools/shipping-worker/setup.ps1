[CmdletBinding()]
param([switch]$VerifierOnly)
$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Use this setup on your Windows laptop.' }
$shippingDir = Join-Path $env:LOCALAPPDATA 'PureForm\Shipping'
New-Item -ItemType Directory -Force -Path $shippingDir | Out-Null
$ownerSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
& icacls.exe $shippingDir /inheritance:r /grant:r "*${ownerSid}:(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the private shipping folder.' }
$profilePath = Join-Path $shippingDir 'profile.json'
if (-not (Test-Path -LiteralPath $profilePath)) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'profile.example.json') -Destination $profilePath }
$credentialPath = Join-Path $shippingDir 'credentials.xml'
if (Test-Path -LiteralPath $credentialPath) {
  $credential = Import-Clixml -LiteralPath $credentialPath
} else {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  $token = -join ($bytes | ForEach-Object { $_.ToString('x2') })
  $secureToken = ConvertTo-SecureString -String $token -AsPlainText -Force
  $credential = New-Object System.Management.Automation.PSCredential('pureform-shipping-worker',$secureToken)
  $credential | Export-Clixml -LiteralPath $credentialPath
  $token = $null
}
if ($credential.GetNetworkCredential().Password -notmatch '^[A-Za-z0-9_-]{32,256}$') { throw 'Use the dedicated 32-256 character shipping secret.' }
$hasher = [Security.Cryptography.SHA256]::Create()
try { $verifier = -join ($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($credential.GetNetworkCredential().Password)) | ForEach-Object { $_.ToString('x2') }) } finally { $hasher.Dispose() }
if ($VerifierOnly) { Write-Output $verifier; exit }
Write-Output 'Private setup saved, encrypted for this Windows account. It is outside the website folder.'
Write-Output 'Register only this non-secret verification hash in the Supabase shipping-worker configuration:'
Write-Output $verifier
Write-Output 'Sign in once using: powershell.exe -NoProfile -File .\tools\shipping-worker\start.ps1 -Mode login'
