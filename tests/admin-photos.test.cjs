const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = readFileSync(path.join(__dirname, '../assets/pureform-admin.js'), 'utf8');
const catalogSource = readFileSync(path.join(__dirname, '../assets/pureform-public-catalog.js'), 'utf8');
const migration = readFileSync(path.join(__dirname, '../supabase/migrations/20261024000100_product_photos.sql'), 'utf8');

function fixture() {
  const ids = {};
  const document = { addEventListener() {}, getElementById(id) { return ids[id] ||= { value: '', textContent: '', dataset: {} }; } };
  const window = {};
  const context = vm.createContext({ document, window, URL });
  new vm.Script(source.replace(/\}\)\(\);\s*$/, `
    globalThis.photosTest = { state, els, getPhotoUrlsFromForm, prepareListingPhoto, onListingPhotoUpload, photoPreviewUrl,
      stubUploadHooks(prepare, add) { prepareListingPhoto = prepare; addPhotoUrlField = add; syncPhotoUrlsFromFields = function () {}; } };
  })();`)).runInContext(context);
  return { ...context.photosTest, document, window };
}

test('owner galleries contain all 21 original links in saved order, matching the migration and seed', () => {
  const seed = readFileSync(path.join(__dirname, '../supabase/admin-schema.sql'), 'utf8');
  const mains = { grey: 'Main_with_background_anlah0.png', black: 'main_rjtosu.png', pink: 'main_img_voei63.png' };
  for (const [color, count] of Object.entries({ grey: 5, black: 7, pink: 9 })) {
    const photos = vm.runInNewContext('(' + catalogSource.match(new RegExp('var ' + color + 'Photos = (\\[[\\s\\S]*?\\n  \\]);'))[1] + ')');
    assert.equal(photos.length, count);
    assert.equal(new Set(photos).size, count);
    assert.ok(photos[0].endsWith(mains[color]));
    let position = -1;
    for (const url of photos) {
      assert.ok(url.startsWith('https://res.cloudinary.com/dqjilscgl/image/upload/v'));
      const next = migration.indexOf("'" + url + "'");
      assert.ok(next > position);
      position = next;
      assert.ok(seed.includes(url));
    }
  }
  assert.equal((migration.match(/update public.site_listings set photo_urls/g) || []).length, 3);
  assert.doesNotMatch(migration, /set (?:price|inventory_quantity|discount|visible)/i);
});

test('photo save retains order, permits old local assets and rejects unsafe URLs or oversized galleries', () => {
  const f = fixture();
  const input = f.document.getElementById('listingPhotos');
  input.value = 'https://images.example.test/second.jpg\nhttps://images.example.test/first.jpg\n/assets/old.png';
  assert.deepEqual(Array.from(f.getPhotoUrlsFromForm()), input.value.split('\n'));
  for (const url of ['javascript:alert(1)', 'data:image/svg+xml,test', 'http://example.test/photo.jpg', 'https://user:password@example.test/photo.jpg', '/assets/../private.png']) {
    input.value = url;
    assert.throws(() => f.getPhotoUrlsFromForm());
  }
  input.value = Array.from({ length: 25 }, (_, i) => 'https://example.test/' + i + '.jpg').join('\n');
  assert.throws(() => f.getPhotoUrlsFromForm(), /up to 24/);
});

test('uploads reject unsupported formats, empty and oversized files before decoding', async () => {
  const f = fixture();
  f.window.createImageBitmap = () => assert.fail('Invalid file must never be decoded');
  for (const file of [{ type: 'image/svg+xml', size: 100 }, { type: 'image/jpeg', size: 0 }, { type: 'image/png', size: 8388609 }]) {
    await assert.rejects(f.prepareListingPhoto(file));
  }
});

test('admin previews are bounded without changing saved originals or signed transforms', () => {
  const f = fixture();
  const original = 'https://res.cloudinary.com/dqjilscgl/image/upload/v1792821805/main_rjtosu.png';
  assert.equal(f.photoPreviewUrl(original), original.replace('/upload/', '/upload/f_auto,q_auto,c_limit,w_160/'));
  for (const url of [original + '?signature=test', original.replace('/upload/', '/upload/w_800/'), 'https://example.test/file.webp']) {
    assert.equal(f.photoPreviewUrl(url), url);
  }
  assert.match(source, /img.loading = 'eager'/);
});

test('upload requires an authorized admin and validates the complete selection before writing', async () => {
  const f = fixture();
  f.els.listingPhotoFiles = { value: '', files: [{ type: 'image/png', size: 100 }] };
  f.els.uploadListingPhotoButton = { disabled: false };
  f.els.listingPhotoStatus = { textContent: '', dataset: {} };
  await f.onListingPhotoUpload();
  assert.match(f.els.listingPhotoStatus.textContent, /Sign in as a store admin/);
  f.state.session = { user: { id: 'owner' } };
  f.state.profile = { role: 'admin' };
  f.document.getElementById('listingSlug').value = 'pureform-4pc-set-black';
  f.els.listingPhotoFiles.files.push({ type: 'image/svg+xml', size: 100 });
  f.stubUploadHooks(() => assert.fail('Invalid batch must never upload'), () => {});
  await f.onListingPhotoUpload();
  assert.match(f.els.listingPhotoStatus.textContent, /JPG, PNG or WebP/);
  assert.equal(f.state.photoUploadPending, false);
  assert.equal(f.els.uploadListingPhotoButton.disabled, false);
});

test('switching products while upload is in progress never adds that photo to the next product', async () => {
  const f = fixture();
  f.state.session = { user: { id: 'owner' } };
  f.state.profile = { role: 'admin' };
  f.document.getElementById('listingSlug').value = 'pureform-4pc-set-black';
  f.els.listingPhotoFiles = { files: [{ type: 'image/png', size: 100 }], value: '' };
  f.els.uploadListingPhotoButton = { disabled: false };
  f.els.listingPhotoStatus = { textContent: '', dataset: {} };
  f.stubUploadHooks(async () => { f.state.photoFormVersion += 1; return {}; }, () => assert.fail('No photo may be added to the next listing'));
  await f.onListingPhotoUpload();
  assert.equal(f.state.photoUploadPending, false);
});

test('both admin routes have file selection, URL entry, photo status and persistent-order controls', () => {
  for (const file of ['index.html', 'dashboard.html']) {
    const html = readFileSync(path.join(__dirname, '../admin/', file), 'utf8');
    assert.match(html, /id="listingPhotoFiles"[^>]*type="file"[^>]*accept="image\/jpeg,image\/png,image\/webp"[^>]*multiple/);
    assert.match(html, /id="uploadListingPhotoButton"/);
    assert.match(html, /id="listingPhotoStatus"[^>]*role="status"/);
  }
  assert.match(source, /upsert: false/);
  assert.match(source, /canvas\.toBlob\(resolve, 'image\/webp', 0\.88\)/);
  assert.match(source, /state\.session\.user\.id \+ '\/' \+ slug/);
  assert.doesNotMatch(source, /cloudinary.*api_secret|service_role/i);
});
