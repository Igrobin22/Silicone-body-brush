import {PreparationError} from './prepare.mjs';
export const createOrderUrl='https://app.shiplifier.com/en/orders/manual-order/create';

async function field(page,label){
  const container=page.getByText(label,{exact:true}).locator('..');
  const input=container.locator('input');
  if(await input.count()!==1)throw new PreparationError('form_changed');
  return input;
}

async function selectCity(dialog,city){
  const selects=dialog.locator('mat-select');
  if(await selects.count()!==2)throw new PreparationError('form_changed');
  await selects.nth(0).click();
  await dialog.getByRole('option',{name:'United Arab Emirates',exact:true}).click();
  await selects.nth(1).click();
  const option=dialog.getByRole('option',{name:city,exact:true});
  if(await option.count()!==1)throw new PreparationError('form_changed');
  await option.click();
}

async function businessAddress(page,kind,address){
  if(!address?.mapPinVerified||!address.placeLabel||!Number.isFinite(address.latitude)||!Number.isFinite(address.longitude))
    throw new PreparationError('missing_verified_profile');
  await page.getByRole('heading',{name:kind,exact:true}).locator('..').locator('..').locator('mat-icon[svgicon="edit-icon"]').click();
  const dialog=page.getByRole('dialog');
  await selectCity(dialog,address.city);
  if(kind==='Origin'){
    for(const [placeholder,value] of [['Enter company',address.company],['Enter name',address.name],['Enter email',address.email]])
      await dialog.getByPlaceholder(placeholder,{exact:true}).fill(value);
  }
  await (await field(dialog,'Address Line2')).fill(address.apartment||'');
  await dialog.getByPlaceholder('e.g: 123456789',{exact:true}).fill(address.phone.replace(/^\+971/,''));
  const input=dialog.getByPlaceholder('Enter address 1',{exact:true});
  // Shiplifier's geocoder can display late results for an earlier keystroke.
  // Submit one complete query, instead of racing a request for every character.
  await input.fill(address.placeQuery);
  await input.press('End');
  await dialog.getByRole('option',{name:address.placeLabel,exact:true}).click();
  // A known business pin must match the visible map, not just the typed address.
  await page.waitForFunction(({latitude,longitude})=>{
    const link=document.querySelector('[role="dialog"] a[href*="maps.google.com/maps?ll="]');
    if(!link)return false;
    const ll=new URL(link.href).searchParams.get('ll')?.split(',').map(Number);
    return ll?.length===2&&Math.abs(ll[0]-latitude)<.00002&&Math.abs(ll[1]-longitude)<.00002;
  },{latitude:address.latitude,longitude:address.longitude},{timeout:15000});
  if(kind==='Pickup'){
    await dialog.getByRole('button',{name:'Open calendar',exact:true}).click();
    const days=page.getByRole('grid').getByRole('button');
    let selected=false;
    for(const day of await days.all())if(await day.isEnabled()){await day.click();selected=true;break;}
    if(!selected)throw new PreparationError('form_changed');
  }
  await dialog.getByRole('button',{name:'Save Details',exact:true}).click();
  await dialog.waitFor({state:'hidden',timeout:15000});
}

// Visible first-page controls inspected in Shiplifier on 5 Nov 2026.
// Only verified business-address dialogs are saved. Receiver pin, Next and booking
// remain under owner control. Nothing here creates a shipment or buys a label.
export async function fillPreparation(page,payload,{navigate=true}={}){
  if(navigate)await page.goto(createOrderUrl,{waitUntil:'domcontentloaded'});
  if(new URL(page.url()).origin!=='https://app.shiplifier.com')throw new PreparationError('login_required');
  try{await page.getByRole('heading',{name:/^create order$/i}).waitFor({state:'visible',timeout:15000});}
  catch{throw new PreparationError('login_required');}
  try{
    if(payload.items.length!==1)throw new PreparationError('missing_package_profile');
    await businessAddress(page,'Origin',payload.origin);
    await businessAddress(page,'Pickup',payload.pickup);
    await (await field(page,'Reference ID (Optional)')).fill(payload.reference);
    await page.getByPlaceholder('Type any special request here (optional).',{exact:true}).fill(payload.instructions);
    for(const [label,key] of [['Length(CM)','lengthCm'],['Width(CM)','widthCm'],['Height(CM)','heightCm']])
      await(await field(page,label)).fill(String(payload.parcel[key]));
    await page.locator('mat-radio-group').filter({hasText:'Cash On Delivery (COD)?'}).getByRole('radio',{name:'No',exact:true}).check();
    await page.locator('mat-radio-group').filter({hasText:'Is Fragile?'}).getByRole('radio',{name:payload.parcel.fragile?'Yes':'No',exact:true}).check();
    const rows=page.locator('tr').filter({has:page.locator('input[formcontrolname="name"]')});
    if(await rows.count()!==payload.items.length)throw new PreparationError('form_changed');
    for(let i=0;i<payload.items.length;i++){
      const row=rows.nth(i),item=payload.items[i];
      await row.locator('input[formcontrolname="name"]').fill(item.description);
      await row.locator('input[formcontrolname="quantity"]').fill(String(item.quantity));
      await row.locator('input[formcontrolname="price"]').fill(item.unitPrice.toFixed(2));
      await row.locator('input[formcontrolname="weight"]').fill(String(payload.parcel.weightKg));
      await row.locator('mat-select[formcontrolname="currency"]').click();
      await page.getByRole('option',{name:'AED',exact:true}).click();
    }
    await page.getByRole('button',{name:'Create new',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await selectCity(dialog,payload.receiver.city);
    for(const [placeholder,value] of [
      ['Enter name',payload.receiver.name],['Enter address 1',payload.receiver.address],
      ['Enter address 2',payload.receiver.apartment],['Enter email',payload.receiver.email],['e.g: 123456789',payload.receiver.phone.replace(/^\+971/,'')],
    ])await dialog.getByPlaceholder(placeholder,{exact:true}).fill(value);
    await dialog.getByPlaceholder('Enter address 1',{exact:true}).press('End');
    // No customer map pin is guessed and no receiver address is saved.
    // Filling address text does not prove a geocoder selected the right property.
    return {status:'needs_review',error:'prepared_for_review'};
  }catch(error){
    if(error instanceof PreparationError)throw error;
    throw new PreparationError('form_changed',{cause:error});
  }
}
