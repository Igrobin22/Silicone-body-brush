const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = readFileSync(path.join(__dirname, '../assets/pureform-admin-recovery.js'), 'utf8');
const callback = '#type=recovery&access_token=fake-test-token&refresh_token=fake-test-refresh';

async function fixture(options = {}) {
  const elements = {};
  const calls = [];
  const timers = [];
  const ids = ['recoveryRequestForm', 'recoveryPasswordForm', 'recoveryEmail', 'new-password', 'sendRecoveryButton', 'saveRecoveryButton', 'recoveryStatus', 'recoveryTitle', 'showRecoveryPassword'];
  ids.forEach((id) => {
    elements[id] = {
      value: '', hidden: id.endsWith('Form'), disabled: id === 'new-password' || id === 'saveRecoveryButton',
      type: id === 'new-password' ? 'password' : '', checked: false, textContent: '', className: '',
      handlers: {}, addEventListener(event, handler) { this.handlers[event] = handler; },
      reportValidity() { return options.validForm !== false; }, focus() { this.focused = true; }
    };
  });
  const user = { id: 'fake-owner-id', email: 'owner@example.test' };
  let userChecks = 0;
  const auth = {
    async initialize() {
      calls.push(['initialize']);
      return { error: options.initializeError || null };
    },
    async getSession() {
      calls.push(['session']);
      return { data: { session: options.noSession ? null : { user } }, error: options.sessionError || null };
    },
    async getUser() {
      calls.push(['user']);
      userChecks++;
      const denied = options.invalidUser || (options.expireOnSave && userChecks > 1);
      return { data: { user: denied ? null : user }, error: denied ? new Error('expired') : null };
    },
    async resetPasswordForEmail(email, settings) {
      calls.push(['reset', email, settings]);
      return { error: options.sendError || null };
    },
    async updateUser(values) {
      calls.push(['update', values]);
      return { data: { user }, error: options.updateError || null };
    },
    async signOut(settings) { calls.push(['signOut', settings]); return { error: null }; }
  };
  const window = {
    PUREFORM_SUPABASE_CONFIG: options.missingConfig ? {} : { url: 'https://example.supabase.co', anonKey: 'fake-public-key' },
    location: { hash: options.hash || '', search: options.search || '', pathname: '/admin/reset-password.html' },
    history: { replaceState(_state, _title, url) { calls.push(['history', url]); } },
    setTimeout(handler, delay) { timers.push({ handler, delay }); }
  };
  const context = vm.createContext({ window, document: { getElementById: (id) => elements[id] }, URLSearchParams });
  const sdk = new vm.SyntheticModule(['createClient'], function () {
    this.setExport('createClient', (url, key, settings) => {
      calls.push(['client', url, key, settings]);
      return { auth };
    });
  }, { context });
  await sdk.link(() => {});
  await sdk.evaluate();
  new vm.Script(source, {
    importModuleDynamically: async (specifier) => {
      assert.equal(specifier, 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
      if (options.loadError) throw new Error('offline');
      return sdk;
    }
  }).runInContext(context);
  await new Promise((resolve) => setImmediate(resolve));
  return { elements, calls, timers, async submit(id) { await elements[id].handlers.submit({ preventDefault() {} }); } };
}

test('plain visit offers recovery, never an unauthenticated password change', async () => {
  const page = await fixture();
  assert.equal(page.elements.recoveryRequestForm.hidden, false);
  assert.equal(page.elements.recoveryPasswordForm.hidden, true);
  assert.equal(page.elements['new-password'].disabled, true);
  await page.submit('recoveryPasswordForm');
  assert.equal(page.calls.length, 0);
});

test('expired callback gives safe retry and removes callback parameters', async () => {
  const page = await fixture({ hash: '#error=access_denied&error_code=otp_expired&error_description=%3Cscript%3E' });
  assert.match(page.elements.recoveryStatus.textContent, /Supabase reports/);
  assert.match(page.elements.recoveryStatus.textContent, /newest message/);
  assert.doesNotMatch(page.elements.recoveryStatus.textContent, /script/);
  assert.deepEqual(page.calls, [['history', '/admin/reset-password.html']]);
});

test('non-recovery token fragments and unsupported codes are rejected and removed', async () => {
  for (const options of [{ hash: '#type=signup&access_token=fake' }, { search: '?code=fake-code' }]) {
    const page = await fixture(options);
    assert.equal(page.elements.recoveryPasswordForm.hidden, true);
    assert.match(page.elements.recoveryStatus.textContent, /supported password-recovery session/);
    assert.deepEqual(page.calls, [['history', '/admin/reset-password.html']]);
  }
});

test('verified recovery enables password form without persisting its session', async () => {
  const page = await fixture({ hash: callback });
  assert.equal(page.elements.recoveryPasswordForm.hidden, false);
  assert.equal(page.elements.recoveryRequestForm.hidden, true);
  assert.equal(page.elements['new-password'].disabled, false);
  assert.equal(page.calls.find((call) => call[0] === 'client')[3].auth.persistSession, false);
  assert.deepEqual(page.calls.map((call) => call[0]), ['client', 'initialize', 'session', 'user', 'history']);
});

test('connection and dependency failures are not mislabeled as expired links', async () => {
  for (const options of [{ loadError: true }, { initializeError: { name: 'AuthRetryableFetchError', status: 0 } }, { sessionError: { status: 503 } }]) {
    const page = await fixture({ hash: callback, ...options });
    assert.match(page.elements.recoveryStatus.textContent, /could not be reached/);
    assert.doesNotMatch(page.elements.recoveryStatus.textContent, /expired/);
    assert.equal(page.elements.recoveryPasswordForm.hidden, true);
    assert.equal(page.calls.at(-1)[0], 'history');
  }
});

test('initialization errors are checked before trusting any cached session', async () => {
  const page = await fixture({ hash: callback, initializeError: { name: 'AuthApiError', code: 'bad_jwt', status: 403 } });
  assert.match(page.elements.recoveryStatus.textContent, /could not verify/);
  assert.equal(page.calls.some((call) => call[0] === 'session'), false);
  assert.equal(page.elements.recoveryPasswordForm.hidden, true);
});

test('missing or unverified sessions cannot enable password changes', async () => {
  for (const options of [{ noSession: true }, { invalidUser: true }, { loadError: true }, { missingConfig: true }]) {
    const page = await fixture({ hash: callback, ...options });
    assert.equal(page.elements.recoveryPasswordForm.hidden, true);
    await page.submit('recoveryPasswordForm');
    assert.equal(page.calls.some((call) => call[0] === 'update'), false);
  }
});

test('reset requests use only the fixed published callback and generic confirmation', async () => {
  const page = await fixture({ search: '?redirectTo=https://malicious.example' });
  page.elements.recoveryEmail.value = ' owner@example.test ';
  await page.submit('recoveryRequestForm');
  const reset = page.calls.find((call) => call[0] === 'reset');
  assert.equal(reset[1], 'owner@example.test');
  assert.equal(reset[2].redirectTo, 'https://siliconebodybrush2.pages.dev/admin/reset-password.html');
  assert.match(page.elements.recoveryStatus.textContent, /If this email has an account/);
  assert.equal(page.elements.sendRecoveryButton.disabled, true);
  await page.submit('recoveryRequestForm');
  assert.equal(page.calls.filter((call) => call[0] === 'reset').length, 1);
  assert.equal(page.timers[0].delay, 60000);
  page.timers[0].handler();
  assert.equal(page.elements.sendRecoveryButton.disabled, false);
});

test('email errors allow retry and invalid forms send nothing', async () => {
  const failed = await fixture({ sendError: new Error('rate limit') });
  await failed.submit('recoveryRequestForm');
  assert.match(failed.elements.recoveryStatus.textContent, /could not be sent/);
  assert.equal(failed.elements.sendRecoveryButton.disabled, false);
  const invalid = await fixture({ validForm: false });
  await invalid.submit('recoveryRequestForm');
  assert.equal(invalid.calls.length, 0);
});

test('password save revalidates user, updates Auth only, clears password and signs out locally', async () => {
  const page = await fixture({ hash: callback });
  page.elements['new-password'].value = 'Fake-test-password-only';
  await page.submit('recoveryPasswordForm');
  assert.equal(page.calls.find((call) => call[0] === 'update')[1].password, 'Fake-test-password-only');
  assert.equal(page.calls.filter((call) => call[0] === 'user').length, 2);
  assert.equal(page.calls.find((call) => call[0] === 'signOut')[1].scope, 'local');
  assert.equal(page.elements['new-password'].value, '');
  assert.equal(page.elements.recoveryPasswordForm.hidden, true);
  assert.equal(page.elements.recoveryTitle.textContent, 'Password updated');
  await page.submit('recoveryPasswordForm');
  assert.equal(page.calls.filter((call) => call[0] === 'update').length, 1);
});

test('expired session at submit cannot change a password', async () => {
  const page = await fixture({ hash: callback, expireOnSave: true });
  page.elements['new-password'].value = 'Fake-test-password-only';
  await page.submit('recoveryPasswordForm');
  assert.equal(page.calls.some((call) => call[0] === 'update'), false);
  assert.equal(page.elements.recoveryRequestForm.hidden, false);
  assert.equal(page.elements['new-password'].value, '');
});

test('failed password update keeps a retry available but clears the entered password', async () => {
  const page = await fixture({ hash: callback, updateError: new Error('weak password') });
  page.elements['new-password'].value = 'Fake-test-password-only';
  await page.submit('recoveryPasswordForm');
  assert.equal(page.elements.recoveryPasswordForm.hidden, false);
  assert.equal(page.elements.saveRecoveryButton.disabled, false);
  assert.equal(page.elements['new-password'].value, '');
  assert.match(page.elements.recoveryStatus.textContent, /could not be saved/);
});

test('recovery HTML uses password autofill, minimum length, no referrer and no analytics', () => {
  const html = readFileSync(path.join(__dirname, '../admin/reset-password.html'), 'utf8');
  assert.match(html, /autocomplete="new-password" minlength="12"/);
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /Content-Security-Policy/);
  assert.doesNotMatch(html, /analytics|gtag|pixel|service.role|sk_live|rk_live/i);
});
