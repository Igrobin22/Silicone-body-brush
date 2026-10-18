$ErrorActionPreference = 'Stop'
$scriptPath = Join-Path (Split-Path $PSScriptRoot -Parent) 'prepare-telegram.ps1'
$parseErrors = $null
$tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile($scriptPath,[ref]$tokens,[ref]$parseErrors)
if ($parseErrors.Count) { throw 'Preparation script did not parse.' }
foreach ($definition in $ast.EndBlock.Statements) {
    if ($definition -is [Management.Automation.Language.FunctionDefinitionAst]) {
        . ([ScriptBlock]::Create($definition.Extent.Text))
    }
}

$checks = 0
function Assert-Equal($Actual,$Expected,[string]$Label) {
    if ($Actual -cne $Expected) { throw ('Failed: ' + $Label) }
    $script:checks++
}

function New-TestFailure([Exception]$Exception) {
    return [Management.Automation.ErrorRecord]::new($Exception,'SyntheticFailure',[Management.Automation.ErrorCategory]::NotSpecified,$null)
}

foreach ($status in @(400,401,404,409,429,500,503)) {
    $failure = [InvalidOperationException]::new('Synthetic provider text must never be printed.')
    $failure | Add-Member -MemberType NoteProperty -Name Response -Value ([pscustomobject]@{StatusCode=$status})
    $expected = switch ($status) {
        400 { 'api-rejected' }
        401 { 'token-rejected' }
        404 { 'token-rejected' }
        409 { 'api-conflict' }
        429 { 'api-rate-limit' }
        default { 'api-unavailable' }
    }
    Assert-Equal (Get-ApiFailureCode (New-TestFailure $failure)) $expected ('HTTP ' + $status)
}

foreach ($case in @(
    @{Error=[Net.Sockets.SocketError]::ConnectionReset;Code='network-reset'},
    @{Error=[Net.Sockets.SocketError]::HostNotFound;Code='network-dns'},
    @{Error=[Net.Sockets.SocketError]::TimedOut;Code='network-timeout'}
)) {
    $socket = [Net.Sockets.SocketException]::new([int]$case.Error)
    $wrapped = [InvalidOperationException]::new('Synthetic URL with credentials.',$socket)
    Assert-Equal (Get-ApiFailureCode (New-TestFailure $wrapped)) $case.Code ('Socket ' + $case.Error)
}
Assert-Equal (Get-ApiFailureCode (New-TestFailure ([Security.Authentication.AuthenticationException]::new('Synthetic TLS details.')))) 'network-tls' 'TLS failure'
Assert-Equal (Get-ApiFailureCode (New-TestFailure ([OperationCanceledException]::new()))) 'network-timeout' 'Cancelled request'
Assert-Equal (Get-ApiFailureCode (New-TestFailure ([InvalidOperationException]::new('Synthetic raw error.')))) 'network' 'Unknown network failure'

foreach ($length in @(16,32)) {
    $first = New-SetupSecret $length
    $second = New-SetupSecret $length
    Assert-Equal ($first -cmatch ('^[a-f0-9]{' + (2 * $length) + '}$')) $true 'Cryptographic secret format'
    Assert-Equal ($first -cne $second) $true 'Independent random values'
}

function Read-Host { param([string]$Prompt) return $script:confirmation }
foreach ($value in @('PREPARE','prepare',' Prepare ')) {
    $script:confirmation = $value
    Assert-Equal (Confirm-Setup 'Synthetic prompt' 'PREPARE') $true 'Preparation accepts case and surrounding whitespace'
}
foreach ($value in @('','yes','PREPARE later')) {
    $script:confirmation = $value
    Assert-Equal (Confirm-Setup 'Synthetic prompt' 'PREPARE') $false 'Explicit word remains required'
}
$script:confirmation = ' connect '
Assert-Equal (Confirm-Setup 'Synthetic prompt' 'CONNECT') $true 'Webhook still needs explicit connect'

function Start-Sleep { param([int]$Seconds) $script:backoffs += $Seconds }
function Invoke-RestMethod {
    param($Method,$Uri,$ContentType,$Body,$TimeoutSec,$MaximumRedirection)
    $script:requestCount++
    if ($script:failureMode -eq 'recover' -and $script:requestCount -eq 3) { return @{ok=$true;result=@{username='SyntheticPureFormBot'}} }
    switch ($script:failureMode) {
        'token' {
            $failure = [InvalidOperationException]::new('Synthetic token rejection.')
            $failure | Add-Member -MemberType NoteProperty -Name Response -Value ([pscustomobject]@{StatusCode=401})
            throw $failure
        }
        'tls' { throw [Security.Authentication.AuthenticationException]::new('Synthetic TLS failure.') }
        default { throw [TimeoutException]::new('Synthetic timeout.') }
    }
}
foreach ($case in @(
    @{Mode='recover';Method='getMe';Count=3;Code='';Delays='2,4'},
    @{Mode='exhaust';Method='getWebhookInfo';Count=3;Code='network-timeout';Delays='2,4'},
    @{Mode='token';Method='getMe';Count=1;Code='token-rejected';Delays=''},
    @{Mode='tls';Method='getMe';Count=1;Code='network-tls';Delays=''},
    @{Mode='exhaust';Method='setWebhook';Count=1;Code='network-timeout';Delays=''}
)) {
    $script:failureMode = $case.Mode
    $script:requestCount = 0
    $script:backoffs = @()
    $actualCode = ''
    try {
        $result = Invoke-BotApi '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi' $case.Method @{}
        Assert-Equal $result.username 'SyntheticPureFormBot' 'Read call recovers after temporary failures'
    } catch { $actualCode = $_.Exception.Data['PureFormSetupCode'] }
    Assert-Equal $actualCode $case.Code ($case.Mode + ': safe result')
    Assert-Equal $script:requestCount $case.Count ($case.Mode + ': bounded request count')
    Assert-Equal ($script:backoffs -join ',') $case.Delays ($case.Mode + ': backoff')
}

# Execute early-failure paths in a separate process: the setup script exits on failure.
# All tokens and provider responses below are synthetic. No network calls are made.
$syntheticToken = '123456789:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi'
$shell = [Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
function Test-SetupFailure([string]$TokenInput,[string]$MockBody,[string]$ExpectedText,[string]$Label) {
    $temporaryRoot = Join-Path ([IO.Path]::GetTempPath()) ('pureform-telegram-test-' + [guid]::NewGuid().ToString('N'))
    $childCode = @'
$ErrorActionPreference = 'Stop'
$env:LOCALAPPDATA = '__TEMP__'
$global:inputToken = '__TOKEN__'
function Read-Host {
    param([string]$Prompt,[switch]$AsSecureString)
    if ($AsSecureString) { return ConvertTo-SecureString $global:inputToken -AsPlainText -Force }
    return ' prepare '
}
function Start-Sleep { param([int]$Seconds) }
function Invoke-RestMethod {
    param($Method,$Uri,$ContentType,$Body,$TimeoutSec,$MaximumRedirection)
__MOCK__
}
& '__SCRIPT__'
'@
    $childCode = $childCode.Replace('__TEMP__',$temporaryRoot.Replace("'","''")).Replace('__TOKEN__',$TokenInput.Replace("'","''"))
    $childCode = $childCode.Replace('__MOCK__',$MockBody).Replace('__SCRIPT__',$scriptPath.Replace("'","''"))
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($childCode))
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $shell
    $info.Arguments = '-NoProfile -NonInteractive -EncodedCommand ' + $encoded
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $child = [Diagnostics.Process]::Start($info)
    try {
        $stdout = $child.StandardOutput.ReadToEndAsync()
        $stderr = $child.StandardError.ReadToEndAsync()
        if (-not $child.WaitForExit(30000)) {
            $child.Kill()
            $child.WaitForExit()
            throw ('Failed: ' + $Label + ': test process timed out')
        }
        $output = $stdout.Result + $stderr.Result
        Assert-Equal $child.ExitCode 1 ($Label + ': exits safely')
        Assert-Equal ($output.Contains($ExpectedText)) $true ($Label + ': actionable message')
        Assert-Equal ($output.Contains($syntheticToken)) $false ($Label + ': token not exposed')
        Assert-Equal ($output.Contains('PROVIDER_PRIVATE_MARKER')) $false ($Label + ': provider detail not exposed')
        Assert-Equal (Test-Path -LiteralPath $temporaryRoot) $false ($Label + ': no credentials written')
    } finally { $child.Dispose() }
}

Test-SetupFailure 'not a token' 'throw "Unexpected API call"' 'The token format is invalid.' 'Token format'
foreach ($status in @(401,404)) {
    $mock = @'
$failure = [InvalidOperationException]::new('PROVIDER_PRIVATE_MARKER ' + $global:inputToken)
$failure | Add-Member -MemberType NoteProperty -Name Response -Value ([pscustomobject]@{StatusCode=__STATUS__})
throw $failure
'@
    Test-SetupFailure $syntheticToken ($mock.Replace('__STATUS__',[string]$status)) 'Telegram rejected the token (HTTP 401/404).' ('Rejected token ' + $status)
}
$resetMock = @'
$socket = [Net.Sockets.SocketException]::new([int][Net.Sockets.SocketError]::ConnectionReset)
throw [InvalidOperationException]::new('PROVIDER_PRIVATE_MARKER ' + $global:inputToken,$socket)
'@
Test-SetupFailure $syntheticToken $resetMock 'The connection to Telegram was reset.' 'Network reset'
$existingMock = @'
if ($Uri -notlike ('https://api.telegram.org/bot' + $global:inputToken.Trim() + '/*')) { throw 'Token was not trimmed' }
if ($MaximumRedirection -ne 0) { throw 'Redirect protection missing' }
if ($Uri.EndsWith('/getMe')) { return @{ok=$true;result=@{username='SyntheticPureFormBot'}} }
if ($Uri.EndsWith('/getWebhookInfo')) { return @{ok=$true;result=@{url='https://example.invalid/existing'}} }
throw 'Unexpected API call'
'@
Test-SetupFailure ('  ' + $syntheticToken + '  ') $existingMock 'This bot already has a webhook.' 'Trim input and preserve webhook'
$offsetMock = @'
if ($Uri.EndsWith('/getMe')) { return @{ok=$true;result=@{username='SyntheticPureFormBot'}} }
if ($Uri.EndsWith('/getWebhookInfo')) { return @{ok=$true;result=@{url=''}} }
if ($Uri.EndsWith('/getUpdates')) {
    $payload = $Body | ConvertFrom-Json
    if (-not $payload.offset) { return @{ok=$true;result=@(@{update_id=5;message=@{text='old message'}})} }
    if ($payload.offset -ne 6) { throw 'Incorrect polling offset' }
    $failure = [InvalidOperationException]::new('PROVIDER_PRIVATE_MARKER ' + $global:inputToken)
    $failure | Add-Member -MemberType NoteProperty -Name Response -Value ([pscustomobject]@{StatusCode=409})
    throw $failure
}
throw 'Unexpected API call'
'@
Test-SetupFailure $syntheticToken $offsetMock 'Another application is using this bot.' 'Advance polling offset'

Write-Host ('Telegram preparation tests passed: ' + $checks + ' checks on PowerShell ' + $PSVersionTable.PSVersion)
