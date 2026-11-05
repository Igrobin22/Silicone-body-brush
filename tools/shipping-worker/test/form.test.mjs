import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {fillPreparation,createOrderUrl} from '../shiplifier.mjs';
import {preparePayload} from '../prepare.mjs';
import {verifiedProfile} from './fixtures.mjs';
const profile=verifiedProfile();
const order={source:'website',payment_status:'paid',currency:'AED',order_number:'PF-261105-FIXTURE',first_name:'Test',last_name:'Fixture',
  country:'United Arab Emirates',address:'Fixture building',apartment:'401',city:'Dubai',contact:'fixture@example.test',phone:'+971500000000',
  line_items:[{id:'pureform-4pc-set-grey',name:'Grey four-piece set',price:43.89,quantity:1}]};
const fixture=`<!doctype html><html><body><h1>Create Order</h1>
<section><div><h1>Origin</h1></div><mat-icon svgicon="edit-icon" onclick="openAddress('Origin')">edit</mat-icon></section><section><div><h1>Pickup</h1></div><mat-icon svgicon="edit-icon" onclick="openAddress('Pickup')">edit</mat-icon></section>
<div><mat-label>Reference ID (Optional)</mat-label><input></div>
<textarea placeholder="Type any special request here (optional)."></textarea>
<div><div>Length(CM)</div><input type="number"></div><div><div>Width(CM)</div><input type="number"></div><div><div>Height(CM)</div><input type="number"></div>
<mat-radio-group>Cash On Delivery (COD)?<label><input type="radio" name="cod" value="yes" checked>Yes</label><label><input type="radio" name="cod" value="no">No</label></mat-radio-group>
<mat-radio-group>Is Fragile?<label><input type="radio" name="fragile" value="yes">Yes</label><label><input type="radio" name="fragile" value="no">No</label></mat-radio-group>
<table><tbody><tr><td><input formcontrolname="name"></td><td><input formcontrolname="quantity"></td><td><input formcontrolname="price"></td><td><input formcontrolname="weight"></td><td><mat-select formcontrolname="currency" onclick="currency.hidden=false">Currency</mat-select></td></tr></tbody></table>
<button id="currency" role="option" hidden onclick="this.hidden=true;window.currencySelected='AED'">AED</button>
<button onclick="openAddress('Receiver')">Create new</button>
<dialog role="dialog"></dialog><button onclick="window.submitted++">Next</button>
<script>
window.submitted=0;window.saved=[];
function openAddress(kind){
 const dialog=document.querySelector('dialog');
 dialog.innerHTML='<h2>'+kind+'</h2>'+['Country','City'].map((label,i)=>'<mat-select role="combobox" onclick="this.querySelector(\\'button\\').hidden=false">'+label+'<button role="option" hidden onclick="event.stopPropagation();this.hidden=true">'+(i?'Dubai':'United Arab Emirates')+'</button></mat-select>').join('')+
 ['Enter company','Enter name','Enter email','e.g: 123456789'].map(x=>'<input placeholder="'+x+'">').join('')+
 '<input placeholder="Enter address 1" oninput="if(this.value.includes(\\'Synthetic\\'))document.querySelector(\\'#place\\').hidden=false">'+
 '<button id="place" role="option" hidden onclick="this.hidden=true;document.querySelector(\\'#map\\').href=\\'https://maps.google.com/maps?ll=25.18,55.28\\'">Synthetic pickup building - Dubai - United Arab Emirates</button>'+
 '<div><label>Address Line2</label><input placeholder="Enter address 2"></div><a id="map">Map</a>'+
 (kind==='Pickup'?'<button aria-label="Open calendar" onclick="document.querySelector(\\'#calendar\\').hidden=false">Calendar</button><div id="calendar" role="grid" hidden><button disabled>Past day</button><button onclick="this.parentElement.hidden=true">Allowed pickup date</button></div>':'')+
 '<button onclick="saveAddress()">Save Details</button>';
 dialog.showModal();window.currentKind=kind;
}
function saveAddress(){if(window.currentKind==='Receiver'){window.submitted++;return;}window.saved.push(window.currentKind);document.querySelector('dialog').close();}
</script></body></html>`;

test('first-page adapter saves verified business pins but leaves customer pin and booking to the owner',async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext();const page=await context.newPage();let actualRequests=0;
  await context.route('**/*',r=>{if(r.request().url()===createOrderUrl)return r.fulfill({contentType:'text/html',body:fixture});actualRequests++;return r.abort();});
  try{
    const result=await fillPreparation(page,preparePayload(order,profile));
    assert.deepEqual(result,{status:'needs_review',error:'prepared_for_review'});
    assert.equal(await page.locator('input[formcontrolname="price"]').inputValue(),'43.89');
    assert.equal(await page.locator('input[formcontrolname="weight"]').inputValue(),'0.8');
    assert.equal(await page.locator('input[name="cod"][value="no"]').isChecked(),true);
    assert.equal(await page.getByRole('dialog').getByPlaceholder('Enter email',{exact:true}).inputValue(),'fixture@example.test');
    assert.deepEqual(await page.evaluate(()=>window.saved),['Origin','Pickup']);
    assert.equal(await page.evaluate(()=>window.currencySelected),'AED');
    assert.equal(await page.evaluate(()=>window.submitted),0);assert.equal(actualRequests,0);
    await page.getByRole('dialog').evaluate(e=>e.close());
    await page.getByText('Reference ID (Optional)',{exact:true}).evaluate(e=>e.parentElement.remove());
    await assert.rejects(fillPreparation(page,preparePayload(order,profile),{navigate:false}),{code:'form_changed'});
    assert.equal(await page.evaluate(()=>window.submitted),0);
  }finally{await browser.close();}
});
