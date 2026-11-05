import {database,env} from '../_shared/payments.ts';
import {secretMatches} from '../_shared/telegram.ts';

const respond = (data: unknown,status=200) => new Response(JSON.stringify(data),{
  status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},
});
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const outcomes = ['missing_verified_profile','missing_package_profile','missing_customer_email','invalid_order','form_changed','login_required','worker_interrupted','prepared_for_review'];

export async function handler(request: Request) {
  if(request.method!=='POST') return respond({error:'Use POST.'},405);
  const secret=request.headers.get('x-shipping-worker-secret')||'';
  if(!env('SUPABASE_URL')||!env('SUPABASE_SERVICE_ROLE_KEY'))
    return respond({error:'Shipping worker is not configured.'},503);
  // Server-to-server only: never allow a storefront script to consume customer addresses.
  if(request.headers.has('origin')||!/^[A-Za-z0-9_-]{32,256}$/.test(secret))
    return respond({error:'Unauthorized.'},401);
  try {
    const {data:expected,error}=await database().rpc('get_site_shipping_worker_digest');
    if(error||typeof expected!=='string'||!/^[0-9a-f]{64}$/.test(expected))return respond({error:'Shipping worker is not configured.'},503);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
    const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if(!secretMatches(actual,expected))return respond({error:'Unauthorized.'},401);
  }catch{return respond({error:'Shipping authentication unavailable.'},503);}
  let body;
  try {
    const reader=request.body?.getReader();
    if(!reader) throw new Error();
    let bytes=0,text=''; const decoder=new TextDecoder();
    try {
      while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;
        if(bytes>2048){await reader.cancel();throw new Error();}text+=decoder.decode(part.value,{stream:true});}
      body=JSON.parse(text+decoder.decode());
    }finally{reader.releaseLock();}
  }catch{return respond({error:'Invalid request.'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)) return respond({error:'Invalid request.'},400);
  if(body.action==='ping'&&Object.keys(body).length===1)return respond({authenticated:true,mode:'preparation_only'});
  let rpc: string,args: Record<string,unknown>={};
  if(body.action==='claim'&&Object.keys(body).length===1) rpc='claim_site_shipping_job';
  else if(body.action==='finish'&&Object.keys(body).every(k=>['action','id','lease','status','error'].includes(k))&&
    uuid.test(body.id)&&uuid.test(body.lease)&&['needs_review','failed'].includes(body.status)&&outcomes.includes(body.error)){
    rpc='finish_site_shipping_job';
    args={p_id:body.id,p_lease:body.lease,p_status:body.status,p_error:body.error};
  }else return respond({error:'Invalid shipping action.'},400);
  try {
    const {data,error}=await database().rpc(rpc,args);
    if(error) throw new Error();
    if(rpc==='finish_site_shipping_job'&&data!==true) return respond({error:'Shipping lease expired or order changed.'},409);
    return respond(rpc==='claim_site_shipping_job'?{job:data}:{saved:true});
  }catch{return respond({error:'Shipping queue unavailable. Retry later.'},503);}
}
