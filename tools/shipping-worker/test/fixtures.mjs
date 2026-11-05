import {readFileSync} from 'node:fs';
export function verifiedProfile(){
  const profile=JSON.parse(readFileSync(new URL('../profile.example.json',import.meta.url)));
  const address={verified:true,mapPinVerified:true,country:'United Arab Emirates',city:'Dubai',
    address:'Synthetic pickup building, Dubai',apartment:'401',phone:'+971500000000',
    placeQuery:'Synthetic pickup building',placeLabel:'Synthetic pickup building - Dubai - United Arab Emirates',latitude:25.18,longitude:55.28};
  profile.pickup={...address};
  profile.origin={...address,company:'Fixture business',name:'Fixture owner',email:'owner@example.test'};
  return profile;
}
