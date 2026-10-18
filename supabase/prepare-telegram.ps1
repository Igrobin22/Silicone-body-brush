param([switch]$ActivateWebhook)

$ErrorActionPreference = 'Stop'
$secretFolder = Join-Path $env:LOCALAPPDATA 'PureForm\Telegram'
$secretPath = Join-Path $secretFolder 'bot.env'
$endpoint = 'https://hibfipskhksboubibwbz.supabase.co/functions/v1/telegram-bot'
$setupStage = 'startup'

function Stop-Setup([string]$Code) {
    $failure = [InvalidOperationException]::new('PureForm Telegram setup stopped.')
    $failure.Data['PureFormSetupCode'] = $Code
    throw $failure
}

function Get-SetupMessage([string]$Code) {
    switch ($Code) {
        'token-format' { return 'The token format is invalid. Copy ONLY the API token from BotFather, without quotes, a bot prefix or other text.' }
        'token-rejected' { return 'Telegram rejected the token (HTTP 401/404). Copy the current token for the NEW PureForm bot from BotFather and retry privately.' }
        'network-reset' { return 'The connection to Telegram was reset. Your token could not be checked. Check your internet connection or try another trusted network, then retry.' }
        'network-dns' { return 'This computer could not find api.telegram.org. Check your internet connection and DNS, then retry.' }
        'network-timeout' { return 'Telegram did not respond in time. Check your internet connection, then retry.' }
        'network-tls' { return 'A secure connection to Telegram could not be verified. Check the computer clock and network security settings. Do not disable certificate verification.' }
        'network' { return 'Could not connect to Telegram. Your token could not be checked. Check your internet connection or try another trusted network, then retry.' }
        'api-conflict' { return 'Another application is using this bot. Stop this setup and use a NEW dedicated PureForm bot. No existing webhook was changed.' }
        'api-rate-limit' { return 'Telegram is temporarily rate limiting requests. Wait a minute and retry; do not repeatedly submit the token.' }
        'api-unavailable' { return 'Telegram is temporarily unavailable. Wait a few minutes and retry.' }
        'api-rejected' { return 'Telegram rejected the setup request. Verify that this is the NEW dedicated PureForm bot, then retry privately.' }
        'webhook-existing' { return 'This bot already has a webhook. Use a NEW dedicated PureForm bot. The existing webhook was not changed.' }
        'webhook-different' { return 'This bot already uses a different webhook. The existing webhook was not changed.' }
        'webhook-verification' { return 'Telegram did not confirm the expected webhook. Do not use management commands until the connection has been checked.' }
        'setup-existing' { return 'A private setup file already exists under LocalAppData/PureForm/Telegram. It was NOT overwritten. Tell the setup assistant that the private file already exists; do not share its contents.' }
        'setup-missing' { return 'The private setup file is missing. Run the preparation step before activating the webhook.' }
        'owner-timeout' { return 'Owner verification timed out. No credentials were saved. Run the script again and send the NEW /link command to your bot within three minutes.' }
        'save' { return 'Windows could not save or protect the private setup file. Check permissions for LocalAppData/PureForm/Telegram. Do not move credentials into the website folder.' }
        default { return 'Setup stopped safely. No secret values were printed. Tell the setup assistant which step was visible, without sharing the token.' }
    }
}

function Get-ApiFailureCode([System.Management.Automation.ErrorRecord]$Failure) {
    $status = 0
    if ($Failure.Exception.Response) { $status = [int]$Failure.Exception.Response.StatusCode }
    if ($status -eq 401 -or $status -eq 404) { return 'token-rejected' }
    if ($status -eq 409) { return 'api-conflict' }
    if ($status -eq 429) { return 'api-rate-limit' }
    if ($status -ge 500) { return 'api-unavailable' }
    if ($status -ge 400) { return 'api-rejected' }

    # Inspect exception types/codes only; provider messages and URLs may contain the token.
    $cause = $Failure.Exception
    while ($cause) {
        if ($cause -is [Security.Authentication.AuthenticationException]) { return 'network-tls' }
        if ($cause -is [OperationCanceledException] -or $cause -is [TimeoutException]) { return 'network-timeout' }
        if ($cause -is [Net.Sockets.SocketException]) {
            switch ([string]$cause.SocketErrorCode) {
                'ConnectionReset' { return 'network-reset' }
                'ConnectionAborted' { return 'network-reset' }
                'HostNotFound' { return 'network-dns' }
                'TryAgain' { return 'network-dns' }
                'TimedOut' { return 'network-timeout' }
            }
        }
        if ($cause -is [Net.WebException]) {
            switch ([string]$cause.Status) {
                'NameResolutionFailure' { return 'network-dns' }
                'ProxyNameResolutionFailure' { return 'network-dns' }
                'Timeout' { return 'network-timeout' }
                'TrustFailure' { return 'network-tls' }
                'SecureChannelFailure' { return 'network-tls' }
                'ConnectionClosed' { return 'network-reset' }
                'ReceiveFailure' { return 'network-reset' }
            }
        }
        $cause = $cause.InnerException
    }
    return 'network'
}

function New-SetupSecret([int]$Length) {
    $bytes = New-Object byte[] $Length
    $random = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $random.GetBytes($bytes) }
    finally { $random.Dispose() }
    return [BitConverter]::ToString($bytes).Replace('-','').ToLowerInvariant()
}

function Confirm-Setup([string]$Prompt,[string]$Word) {
    if ((Read-Host $Prompt).Trim() -ieq $Word) { return $true }
    Write-Host 'Setup cancelled. No new credentials were saved and no webhook was changed.'
    return $false
}

function Invoke-BotApi([string]$Token,[string]$Method,[hashtable]$Payload) {
    # Only read requests are retried; webhook changes still require a single explicit action.
    $attempts = 1
    if ($Method -in @('getMe','getWebhookInfo','getUpdates')) { $attempts = 3 }
    for ($attempt = 1; $attempt -le $attempts; $attempt++) {
        try {
            $result = Invoke-RestMethod -Method Post -Uri ("https://api.telegram.org/bot{0}/{1}" -f $Token,$Method) `
                -ContentType 'application/json' -Body ($Payload | ConvertTo-Json -Depth 8 -Compress) -TimeoutSec 15 -MaximumRedirection 0
        } catch {
            $code = Get-ApiFailureCode $_
            if ($attempt -lt $attempts -and $code -in @('network','network-reset','network-dns','network-timeout','api-unavailable')) {
                Write-Host ('Temporary Telegram connection failure. Retrying (' + ($attempt + 1) + '/' + $attempts + ')...')
                Start-Sleep -Seconds (2 * $attempt)
                continue
            }
            Stop-Setup $code
        }
        if (-not $result.ok) { Stop-Setup 'api-rejected' }
        return $result.result
    }
}

try {
    if ($ActivateWebhook) {
        if (-not (Test-Path -LiteralPath $secretPath)) { Stop-Setup 'setup-missing' }
        $config = Get-Content -LiteralPath $secretPath -Raw | ConvertFrom-StringData
        $bot = Invoke-BotApi $config.TELEGRAM_BOT_TOKEN 'getMe' @{}
        $existing = Invoke-BotApi $config.TELEGRAM_BOT_TOKEN 'getWebhookInfo' @{}
        if ($existing.url -and $existing.url -ne $endpoint) { Stop-Setup 'webhook-different' }
        Write-Host "This connects @$($bot.username) to PureForm and enables confirmed stock/discount commands for owner ID $($config.TELEGRAM_OWNER_ID)."
        if (-not (Confirm-Setup 'Type CONNECT to continue' 'CONNECT')) { return }
        $null = Invoke-BotApi $config.TELEGRAM_BOT_TOKEN 'setWebhook' @{
            url=$endpoint; secret_token=$config.TELEGRAM_WEBHOOK_SECRET
            allowed_updates=@('message','callback_query'); max_connections=1; drop_pending_updates=$false
        }
        $verified = Invoke-BotApi $config.TELEGRAM_BOT_TOKEN 'getWebhookInfo' @{}
        if ($verified.url -ne $endpoint) { Stop-Setup 'webhook-verification' }
        Write-Host "Webhook registered for @$($bot.username). Send /inventory to test the owner connection."
        return
    }
    if (Test-Path -LiteralPath $secretPath) { Stop-Setup 'setup-existing' }
    $secure = Read-Host 'Paste the NEW dedicated bot token (hidden)' -AsSecureString
    $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $token = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer).Trim() }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
    if ($token -notmatch '^[0-9]{5,20}:[A-Za-z0-9_-]{20,}$') { Stop-Setup 'token-format' }
    $bot = Invoke-BotApi $token 'getMe' @{}
    $existing = Invoke-BotApi $token 'getWebhookInfo' @{}
    if ($existing.url) { Stop-Setup 'webhook-existing' }
    Write-Host "Bot: @$($bot.username). Use a dedicated bot, not one running another automation."
    if (-not (Confirm-Setup 'Type PREPARE to save owner-only credentials outside the website folder' 'PREPARE')) { return }
    $linkCode = 'pureform_' + (New-SetupSecret 16)
    Write-Host "Open @$($bot.username) in YOUR private Telegram account and send: /link $linkCode"
    $owner = $null
    $offset = $null
    $deadline = (Get-Date).AddMinutes(3)
    while (-not $owner -and (Get-Date) -lt $deadline) {
        $payload = @{allowed_updates=@('message');timeout=10}
        if ($null -ne $offset) { $payload.offset = $offset }
        $updates = @(Invoke-BotApi $token 'getUpdates' $payload)
        foreach ($update in $updates) {
            if ($null -ne $update.update_id) { $offset = [long]$update.update_id + 1 }
            $message = $update.message
            if ($message.text -ceq "/link $linkCode" -and $message.chat.type -eq 'private' -and
                $message.from.is_bot -eq $false -and $message.chat.id -eq $message.from.id -and -not $message.forward_origin) {
                $owner = [string]$message.from.id
                break
            }
        }
    }
    if (-not $owner) { Stop-Setup 'owner-timeout' }
    $webhook = New-SetupSecret 32
    $dispatch = New-SetupSecret 32
    $setupStage = 'save'
    $null = New-Item -ItemType Directory -Path $secretFolder -Force
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true,$false)
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $rule = [Security.AccessControl.FileSystemAccessRule]::new($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $acl.AddAccessRule($rule)
    Set-Acl -LiteralPath $secretFolder -AclObject $acl
    $contents = "TELEGRAM_BOT_TOKEN=$token`nTELEGRAM_OWNER_ID=$owner`nTELEGRAM_WEBHOOK_SECRET=$webhook`nTELEGRAM_DISPATCH_SECRET=$dispatch`n"
    $stream = [IO.File]::Open($secretPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try {
        $bytes = [Text.Encoding]::UTF8.GetBytes($contents)
        $stream.Write($bytes,0,$bytes.Length)
    } finally { $stream.Dispose() }
    Write-Host "Verified bot: @$($bot.username); owner ID: $owner"
    Write-Host "Private credentials saved to: $secretPath"
    Write-Host 'No webhook was activated. Upload this file to the PureForm Supabase secrets, then finish the migration, function and scheduler setup.'
} catch {
    # Do not print provider exceptions, URLs or secret values.
    $code = $_.Exception.Data['PureFormSetupCode']
    if (-not $code) { $code = $setupStage }
    Write-Host ('Setup stopped: ' + (Get-SetupMessage $code))
    exit 1
} finally {
    $token=$null; $contents=$null; $config=$null; $secure=$null
}
