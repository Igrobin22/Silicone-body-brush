import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';

test('idle laptop listener stops when its separate browser closes and does not repeat a claim',{timeout:15000},async()=>{
  const privateDir=await mkdtemp(path.join(tmpdir(),'pureform-shipping-watch-test-'));
  const profile=await readFile(new URL('../profile.example.json',import.meta.url),'utf8');
  await writeFile(path.join(privateDir,'profile.json'),profile);
  const originalLaunch=chromium.launchPersistentContext.bind(chromium);
  const originalFetch=globalThis.fetch;
  let browser,requests=0,finish;
  const finished=new Promise(resolve=>{finish=resolve});
  chromium.launchPersistentContext=async(dir,options)=>{
    browser=await originalLaunch(dir,{...options,headless:true});
    return browser;
  };
  globalThis.fetch=async(url,options)=>{
    assert.equal(url,'https://hibfipskhksboubibwbz.supabase.co/functions/v1/shipping-worker');
    assert.deepEqual(JSON.parse(options.body),{action:'claim'});requests++;
    setTimeout(async()=>{await browser.close();finish();},100);
    return new Response('{"job":null}',{headers:{'Content-Type':'application/json'}});
  };
  process.env.PUREFORM_SHIPPING_DIR=privateDir;
  process.env.PUREFORM_SHIPPING_WORKER_SECRET='fixture_shipping_secret_123456789012345';
  process.argv[2]='watch';
  try{
    await import('../worker.mjs');
    await finished;
    assert.equal(requests,1);assert.notEqual(process.exitCode,1);
  }finally{
    globalThis.fetch=originalFetch;chromium.launchPersistentContext=originalLaunch;
    delete process.env.PUREFORM_SHIPPING_DIR;delete process.env.PUREFORM_SHIPPING_WORKER_SECRET;
  }
});
