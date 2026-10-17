(function () {
  'use strict';

  var SUPABASE_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  var RECOVERY_URL = 'https://siliconebodybrush2.pages.dev/admin/reset-password.html';
  var client;
  var recoveryVerified = false;
  var busy = false;
  var requestForm = document.getElementById('recoveryRequestForm');
  var passwordForm = document.getElementById('recoveryPasswordForm');
  var email = document.getElementById('recoveryEmail');
  var password = document.getElementById('new-password');
  var sendButton = document.getElementById('sendRecoveryButton');
  var saveButton = document.getElementById('saveRecoveryButton');
  var status = document.getElementById('recoveryStatus');
  var title = document.getElementById('recoveryTitle');
  var showPassword = document.getElementById('showRecoveryPassword');

  requestForm.addEventListener('submit', requestRecovery);
  passwordForm.addEventListener('submit', savePassword);
  showPassword.addEventListener('change', function () {
    password.type = showPassword.checked ? 'text' : 'password';
  });

  initialize();

  function setStatus(message, tone) {
    status.textContent = message;
    status.className = 'status-message is-' + (tone || 'neutral');
  }

  function showRequest(message, tone) {
    recoveryVerified = false;
    passwordForm.hidden = true;
    password.disabled = true;
    saveButton.disabled = true;
    requestForm.hidden = false;
    setStatus(message, tone);
  }

  async function getClient() {
    if (client) return client;
    var config = window.PUREFORM_SUPABASE_CONFIG || {};
    if (!config.url || !config.anonKey) throw new Error('missing_config');
    var module = await import(SUPABASE_CDN);
    client = module.createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: true }
    });
    return client;
  }

  async function initialize() {
    var fragment = new URLSearchParams(window.location.hash.slice(1));
    var query = new URLSearchParams(window.location.search);
    var callbackError = fragment.has('error') || query.has('error');
    var isRecovery = fragment.get('type') === 'recovery' && fragment.has('access_token') && fragment.has('refresh_token');
    var hasCallback = fragment.has('access_token') || fragment.has('refresh_token') || fragment.has('type') || query.has('code') || callbackError;

    if (!hasCallback) {
      showRequest('Enter your admin email to receive a password-reset link.');
      return;
    }

    try {
      if (callbackError || !isRecovery) throw new Error('invalid_link');
      var supabase = await getClient();
      var sessionResult = await supabase.auth.getSession();
      if (sessionResult.error || !sessionResult.data.session) throw new Error('invalid_session');
      var userResult = await supabase.auth.getUser();
      if (userResult.error || !userResult.data.user) throw new Error('invalid_user');

      recoveryVerified = true;
      requestForm.hidden = true;
      passwordForm.hidden = false;
      password.disabled = false;
      saveButton.disabled = false;
      setStatus('Choose a new password for your PureForm admin account.');
      password.focus();
    } catch (error) {
      showRequest('This reset link is invalid, expired, or already used. Request a new link below.', 'error');
    } finally {
      // Keep recovery credentials out of copied URLs and subsequent navigation.
      window.history.replaceState(null, '', window.location.pathname);
    }
  }

  async function requestRecovery(event) {
    event.preventDefault();
    if (busy || sendButton.disabled || !requestForm.reportValidity()) return;
    busy = true;
    sendButton.disabled = true;
    setStatus('Sending reset link...');

    try {
      var supabase = await getClient();
      var result = await supabase.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: RECOVERY_URL });
      if (result.error) throw result.error;
      setStatus('If this email has an account, a new reset link will arrive shortly. Check your inbox and spam folder.', 'success');
      window.setTimeout(function () { sendButton.disabled = false; }, 60000);
    } catch (error) {
      setStatus('The reset email could not be sent. Wait a minute and try again.', 'error');
      sendButton.disabled = false;
    } finally {
      busy = false;
    }
  }

  async function savePassword(event) {
    event.preventDefault();
    if (busy || !recoveryVerified || !passwordForm.reportValidity()) return;
    busy = true;
    saveButton.disabled = true;
    setStatus('Saving your new password...');

    try {
      var userResult = await client.auth.getUser();
      if (userResult.error || !userResult.data.user) {
        showRequest('Your recovery session has expired. Request a new reset link.', 'error');
        return;
      }
      var result = await client.auth.updateUser({ password: password.value });
      if (result.error) throw result.error;

      recoveryVerified = false;
      passwordForm.hidden = true;
      password.disabled = true;
      title.textContent = 'Password updated';
      setStatus('Your admin password has been updated. Sign in with your new password.', 'success');
      password.value = '';
      await client.auth.signOut({ scope: 'local' });
    } catch (error) {
      if (recoveryVerified) {
        setStatus('Your password could not be saved. Try a different password or request a new reset link.', 'error');
      }
    } finally {
      password.value = '';
      password.type = 'password';
      showPassword.checked = false;
      saveButton.disabled = !recoveryVerified;
      busy = false;
    }
  }
})();
