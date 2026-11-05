[CmdletBinding()]
param([ValidateSet('watch','prepare','login','check','verify')][string]$Mode = 'watch')
$ErrorActionPreference = 'Stop'
$shippingDir = Join-Path $env:LOCALAPPDATA 'PureForm\Shipping'
$credential = $null
try {
  if ($Mode -in @('watch','prepare','verify')) {
    $credential = Import-Clixml -LiteralPath (Join-Path $shippingDir 'credentials.xml')
    $env:PUREFORM_SHIPPING_WORKER_SECRET = $credential.GetNetworkCredential().Password
  }
  $env:PUREFORM_SHIPPING_DIR = $shippingDir
  & node.exe (Join-Path $PSScriptRoot 'worker.mjs') $Mode
  if ($LASTEXITCODE -ne 0) { throw 'Shipping worker stopped. See /shipping or the admin order.' }
} finally {
  Remove-Item Env:PUREFORM_SHIPPING_WORKER_SECRET -ErrorAction SilentlyContinue
  Remove-Item Env:PUREFORM_SHIPPING_DIR -ErrorAction SilentlyContinue
  $credential = $null
}
