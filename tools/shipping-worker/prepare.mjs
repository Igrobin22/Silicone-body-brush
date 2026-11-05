export class PreparationError extends Error {
  constructor(code,options) {super(code,options);this.code=code;}
}
const fail=code=>{throw new PreparationError(code);};
const clean=(v,max)=>typeof v==='string'&&v.trim().length<=max&&!/[\u0000-\u001f\u007f]/.test(v)?v.trim():'';
const canonical=/^pureform-4pc-set-(grey|black|pink)$/;

export function preparePayload(order,profile){
  if(!order||order.source!=='website'||order.payment_status!=='paid'||order.currency!=='AED'||order.country!=='United Arab Emirates')fail('invalid_order');
  if(!/^PF-[A-Z0-9-]{4,40}$/.test(order.order_number||''))fail('invalid_order');
  const receiver={
    name:[clean(order.first_name,100),clean(order.last_name,100)].join(' ').trim(),
    address:clean(order.address,500),apartment:clean(order.apartment||'',250),
    city:clean(order.emirate||order.city,100),country:order.country,
    email:clean(order.contact,160),phone:clean(order.phone,30),
  };
  if(!receiver.name||!receiver.address||!receiver.city||!/^\+971[1-9]\d{7,8}$/.test(receiver.phone))fail('invalid_order');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(receiver.email))fail('missing_customer_email');
  if(!Array.isArray(order.line_items)||!order.line_items.length||order.line_items.length>3)fail('invalid_order');
  const seen=new Set();let quantity=0;
  const items=order.line_items.map(item=>{
    if(!canonical.test(item?.id)||seen.has(item.id)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>20||
      typeof item.price!=='number'||!Number.isFinite(item.price)||item.price<=0||item.price>10000||Math.abs(item.price*100-Math.round(item.price*100))>.00001)fail('invalid_order');
    seen.add(item.id);quantity+=item.quantity;
    return {description:clean(item.name,160)||'PureForm '+item.id.split('-').at(-1)+' four-piece set',quantity:item.quantity,unitPrice:item.price};
  });
  const parcel=profile?.packages?.[String(quantity)];
  if(!parcel||parcel.verified!==true||typeof parcel.fragile!=='boolean'||
    ['lengthCm','widthCm','heightCm','weightKg'].some(k=>typeof parcel[k]!=='number'||!Number.isFinite(parcel[k])||parcel[k]<=0)||
    Math.max(parcel.lengthCm,parcel.widthCm,parcel.heightCm)>200||parcel.weightKg>30)fail('missing_package_profile');
  if(profile.preferredCourier!=='C3X'||profile.pickup?.verified!==true||!clean(profile.pickup.address,500)||profile.pickup.country!=='United Arab Emirates'||profile.pickup.city!=='Dubai')fail('missing_verified_profile');
  for(const address of [profile.origin,profile.pickup])if(!address?.mapPinVerified||address.verified!==true||
    address.country!=='United Arab Emirates'||address.city!=='Dubai'||!clean(address.placeQuery,300)||!clean(address.placeLabel,500)||
    !/^\+971[1-9]\d{7,8}$/.test(address.phone||'')||!Number.isFinite(address.latitude)||!Number.isFinite(address.longitude)||
    address.latitude<22.6||address.latitude>26.2||address.longitude<51.5||address.longitude>56.5)fail('missing_verified_profile');
  if(!clean(profile.origin.name,100)||!clean(profile.origin.company,100)||!clean(profile.origin.email,160)||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.origin.email))fail('missing_verified_profile');
  return {reference:order.order_number,receiver,items,quantity,parcel:{...parcel},pickup:{...profile.pickup},origin:{...profile.origin},
    preferredCourier:'C3X',currency:'AED',cod:false,instructions:clean(order.customer_notes||'',1000)};
}

export function createQueueClient(endpoint,secret,fetcher=fetch){
  const target=new URL(endpoint);
  if(target.origin!=='https://hibfipskhksboubibwbz.supabase.co'||target.pathname!=='/functions/v1/shipping-worker'||target.search||target.hash||
    !/^[A-Za-z0-9_-]{32,256}$/.test(secret||''))throw new Error('Invalid private worker configuration.');
  return async function request(body){
    let response;
    try{response=await fetcher(target.href,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','x-shipping-worker-secret':secret},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});}
    catch{throw new Error('Queue connection failed. No request was automatically repeated.');}
    if(!response.ok)throw new Error(response.status===409?'The order changed or its preparation lease expired.':'The shipping queue is unavailable.');
    try{return await response.json();}catch{throw new Error('Invalid shipping queue response.');}
  };
}
