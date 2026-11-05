import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {preparePayload,PreparationError,createQueueClient} from './prepare.mjs';
import {fillPreparation,createOrderUrl} from './shiplifier.mjs';

const privateDir=process.env.PUREFORM_SHIPPING_DIR||path.join(process.env.LOCALAPPDATA||'', 'PureForm','Shipping');
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const resolved=path.resolve(privateDir);
const comparison=process.platform==='win32'?resolved.toLowerCase():resolved;
const rootComparison=process.platform==='win32'?repoRoot.toLowerCase():repoRoot;
if(!path.isAbsolute(privateDir)||!process.env.LOCALAPPDATA||comparison===rootComparison||comparison.startsWith(rootComparison+path.sep))
  throw new Error('Shipping setup must be outside the website folder.');

async function main(){
  const mode=process.argv[2]||'watch';
  if(!['watch','prepare','login','check','verify'].includes(mode))throw new Error('Choose watch, prepare, login, check or verify.');
  const profile=JSON.parse((await readFile(path.join(privateDir,'profile.json'),'utf8')).replace(/^\uFEFF/,''));
  if(mode==='check'){
    console.log('Private profile found. Preferred courier: '+profile.preferredCourier+'. No order was read or changed.');return;
  }
  const queue=mode!=='login'?createQueueClient(profile.endpoint,process.env.PUREFORM_SHIPPING_WORKER_SECRET):null;
  if(mode==='verify'){
    const result=await queue({action:'ping'});
    if(result.authenticated!==true||result.mode!=='preparation_only')throw new Error('Unexpected shipping backend configuration.');
    console.log('Authenticated to the deployed PureForm shipping backend. No order was read or changed.');return;
  }
  await mkdir(path.join(privateDir,'browser'),{recursive:true});
  // This separate owner-operated profile never copies Chrome cookies/passwords.
  const browser=await chromium.launchPersistentContext(path.join(privateDir,'browser'),{channel:'chrome',chromiumSandbox:true,headless:false,viewport:{width:1366,height:950}});
  const terminal=createInterface({input:process.stdin,output:process.stdout});
  let stopped=false;
  const stop=new AbortController();
  browser.on('close',()=>{stopped=true;stop.abort();terminal.close();});
  try{
    if(mode==='login'){
      const p=browser.pages()[0]||await browser.newPage();await p.goto(createOrderUrl);
      await terminal.question('Sign in privately in this browser. Press Enter here when done. ');
      try{await p.getByRole('heading',{name:/^create order$/i}).waitFor({state:'visible',timeout:15000});}
      catch{throw new PreparationError('login_required');}
      console.log('Shiplifier login verified in the private shipping browser.');return;
    }
    if(mode==='watch')console.log('Waiting for /process_all. Keep this window open. Close the shipping browser to stop.');
    let count=0;
    while(!stopped&&(mode==='watch'||count<5)){
      const {job}=await queue({action:'claim'});
      if(!job){
        if(mode!=='watch'){console.log('No requested shipping preparations are waiting.');break;}
        try{await delay(30000,undefined,{signal:stop.signal});}catch{break;}
        continue;
      }
      count+=1;
      let outcome,prepared=false;
      try{
        const payload=preparePayload(job.order,profile);
        const p=await browser.newPage();
        outcome=await fillPreparation(p,payload);prepared=true;
      }catch(error){outcome={status:'needs_review',error:error instanceof PreparationError?error.code:'form_changed'};}
      await queue({action:'finish',id:job.id,lease:job.lease,...outcome});
      console.log('Preparation '+count+': '+outcome.error+'. No courier booked.');
      if(prepared)await terminal.question('Review this form in Shiplifier. C3X is preferred. Check pickup, receiver pin, currency and price before any booking. Press Enter here only when finished with this form. ');
      if(outcome.error==='login_required')break;
    }
  }finally{terminal.close();await browser.close();}
}
main().catch(()=>{console.error('Shipping preparation stopped. Check the private setup and /shipping status. No request was automatically repeated.');process.exitCode=1;});
