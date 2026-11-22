const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync('world-editor.html','utf8');
function setup(){
 const supply={id:'north-trail-camp',type:'healingHerb',count:2,x:61,z:7,y:0};
 const floor={x:61,z:7,y:0,type:'earth'};
 const c={facilitySite:{id:'base',northTrail:{supply,regions:[{name:'北の森の道',difficulty:1,bounds:{x1:39,x2:86,z1:1,z2:4,y:0}},{name:'たき火のあと',difficulty:1,outdoorLandmark:true,bounds:{x1:59,x2:63,z1:5,z2:8,y:0}}]}},poiWalkLevel:0,world:[floor],poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.kit,poiInventoryAccept:()=>({slots:[2],accepted:c.capacity}),poiInventoryEdited:(kit,slots)=>({...kit,slots}),poiEconomyWrite:kit=>{if(c.fail)return false;c.kit=kit;c.writes++;return true},poiEconomyRefresh(){},poiSound(){},toast(){},poiDungeonPointIn:(b,x,z,y)=>b.y===y&&b.x1<=x&&x<=b.x2&&b.z1<=z&&z<=b.z2,isFloor:()=>true,kit:{weapon:'equipWoodSword',gold:12,quests:['mine-survey']},capacity:2,writes:0};
 vm.createContext(c);
 const a=html.indexOf('// BEGIN NORTH TRAIL CAMP'),b=html.indexOf('// END NORTH TRAIL CAMP');
 assert.ok(a>=0&&b>a);
 vm.runInContext(html.slice(a,b),c);return c;
}
test('camp collects all two herbs atomically and only once; floor/site/location and exact kit are preserved',()=>{
 const c=setup();
 assert.ok(c.poiNorthTrailSupply(c.kit));
 assert.equal(c.poiNorthTrailPickup(60,7),false);
 c.poiWalkLevel=-1;assert.equal(c.poiNorthTrailPickup(61,7),false);c.poiWalkLevel=0;
 c.facilitySite.id='inn';assert.equal(c.poiNorthTrailPickup(61,7),false);c.facilitySite.id='base';
 assert.equal(c.poiNorthTrailPickup(61,7),true);
 assert.equal(c.kit.northTrailCampSupplies,true);assert.equal(c.kit.gold,12);assert.equal(c.kit.weapon,'equipWoodSword');assert.equal(c.kit.quests[0],'mine-survey');
 assert.equal(c.poiNorthTrailPickup(61,7),false);assert.equal(c.writes,1);assert.equal(c.poiNorthTrailSupply(c.kit),null);
});
test('missing floor, partial room, or failed save never consume the find',()=>{
 const c=setup(),floor=c.world.pop();
 assert.equal(c.poiNorthTrailPickup(61,7),false);c.world.push(floor);
 c.capacity=1;assert.equal(c.poiNorthTrailPickup(61,7),false);
 c.capacity=2;c.fail=true;assert.equal(c.poiNorthTrailPickup(61,7),false);
 assert.equal(c.writes,0);assert.ok(c.poiNorthTrailSupply(c.kit));
});
test('named roads keep grade-only labels while simple landmarks use outdoor fallback',()=>{
 const c=setup(),s=c.facilitySite;
 assert.equal(c.poiNorthTrailRegion(s,46,3,0).name,'北の森の道');
 assert.equal(c.poiNorthTrailRegion(s,61,7,0),null);
 assert.equal(c.poiNorthTrailRegion(s,61,7,-1),null);
 assert.equal(c.poiNorthTrailRegion(s,58,7,0),null);
});
test('legacy default and malformed claim do not write or suppress pickup; valid claim survives existing kit save',()=>{
 for(const mark of [undefined,'true',1,true]){
  const initial={version:1,weapon:null,potions:0,gold:28,northTrailCampSupplies:mark};
  let raw=JSON.stringify(initial),writes=0;
  const c={facilitySite:{id:'base'},POI_PLAYER_MAX_HP:100,localStorage:{getItem:()=>raw,setItem(_k,v){raw=v;writes++}}};
  vm.createContext(c);
  const a=html.indexOf('const POI_HOTBAR_KEY='),b=html.indexOf('function poiResetCombat(',a);
  vm.runInContext(html.slice(a,b),c);
  const kit=c.poiHotbarRead();
  assert.equal(kit.northTrailCampSupplies,mark===true?true:undefined);assert.equal(writes,0);
  assert.equal(c.poiHotbarSave({...kit,gold:29}),true);
  assert.equal(JSON.parse(raw).northTrailCampSupplies,mark===true?true:undefined);
  assert.equal(JSON.parse(raw).gold,29);
 }
});

test('authored camp, watch post, pool and rest well return the same outdoor HUD fallback without hiding named roads',()=>{
 const c=setup(),a=html.indexOf('const FACILITY_SITES=Object.freeze('),b=html.indexOf('function workshopResumeDecode(',a);
 vm.runInContext(html.slice(a,b),c);
 const site={...c.buildFacilitySite('base'),id:'base'};
 for(const [x,z] of [[61,7],[101,11],[118,28],[120,44]])assert.equal(c.poiNorthTrailRegion(site,x,z,0),null,[x,z]);
 assert.equal(c.poiNorthTrailRegion(site,122,44,0)?.name,'丘の街道');
});
