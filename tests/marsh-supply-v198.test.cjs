const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('world-editor.html','utf8');
function setup(){
 const p={id:'north-marsh-herb',type:'healingHerb',count:1,x:115,z:32,y:0};
 const c={world:[{x:p.x,z:p.z,y:0,type:'earth'}],facilitySite:{id:'base',northTrail:{marsh:{pond:{reward:p}}}},
  poiWalkLevel:0,poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.kit,kit:{gold:12,northTrailCampSupplies:true,northWatchPostSupplies:true},take:1,
  poiInventoryAccept:()=>({slots:['herb'],accepted:c.take}),poiInventoryEdited:(kit,slots)=>({...kit,slots}),poiEconomyWrite:kit=>{if(c.fail)return false;c.kit=kit;return true},
  poiEconomyRefresh(){},poiSound(){},toast(){}};
 vm.createContext(c);
 const a=html.indexOf('// BEGIN NORTH TRAIL CAMP'),b=html.indexOf('// END NORTH TRAIL CAMP',a);
 vm.runInContext(html.slice(a,b),c);
 return {c,p};
}
test('far bank herb enters stock once; the two prior rewards and gold remain unchanged',()=>{
 const {c,p}=setup();
 assert.equal(c.poiNorthTrailPickup(p.x,p.z),true);
 assert.deepEqual(c.kit,{gold:12,northTrailCampSupplies:true,northWatchPostSupplies:true,northMarshHerbFound:true,slots:['herb']});
 assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);
});
test('no herb persistence until the live dry floor, current site and available inventory are confirmed',()=>{
 const {c,p}=setup();
 const tile=c.world.pop();assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);c.world.push(tile);
 c.poiWalkLevel=-1;assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);c.poiWalkLevel=0;
 c.facilitySite.id='inn';assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);c.facilitySite.id='base';
 c.take=0;assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);c.take=1;
 c.fail=true;assert.equal(c.poiNorthTrailPickup(p.x,p.z),false);c.fail=false;
 assert.equal(c.kit.northMarshHerbFound,undefined);
 assert.equal(c.poiNorthTrailPickup(p.x,p.z),true);
});
test('ordinary writes round-trip only a genuine true far bank claim',()=>{
 for(const mark of [undefined,'true',true]){
  const c={facilitySite:{id:'base'},POI_PLAYER_MAX_HP:100};
  let raw=JSON.stringify({version:1,weapon:null,potions:0,gold:22,northMarshHerbFound:mark});
  c.localStorage={getItem:()=>raw,setItem(_k,v){raw=v}};
  vm.createContext(c);
  const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiResetCombat(',a);
  vm.runInContext(html.slice(a,b),c);
  assert.equal(c.poiHotbarRead().northMarshHerbFound,mark===true?true:undefined);
  assert.equal(c.poiHotbarSave({...c.poiHotbarRead(),gold:23}),true);
  assert.equal(JSON.parse(raw).northMarshHerbFound,mark===true?true:undefined);
 }
});
