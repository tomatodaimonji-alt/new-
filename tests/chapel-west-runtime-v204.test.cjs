const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8'),extract=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
function fixture(){
 const originalBounds={x1:74,x2:82,z1:73,z2:90,y:-1},bounds={...originalBounds,x1:60};
 const guard={x:64,z:81,y:-1,type:'monsterSlime',bounds:{x1:61,x2:72,z1:79,z2:84,y:-1}};
 const reward={id:'chapel-west-supply',x:65,z:88,y:-1,type:'cannedFood',count:1};
 const c={facilitySite:{id:'base',chapel:{bounds,gate:{z:77},dungeonStand:{z:88},expansion:{originalBounds,guard,reward,cells:[{x:74,z:82}]}}},poiWalkLevel:-1,poiWalkX:65,poiWalkZ:88,poiWalkActive:true,pineAIActive:false,world:[{...reward,type:'stone'}],kit:{gold:17},
  poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.kit,poiInventoryAccept:()=>({slots:[1],accepted:c.full?0:1}),poiInventoryEdited:(k,slots)=>({...k,slots}),poiEconomyWrite:k=>{if(c.fail)return false;c.kit=k;return true},poiEconomyRefresh(){},poiSound(){},toast(){},poiChapelEliteMatch:o=>o.type==='monsterSkeleton',poiChapelGateOpen:()=>false};
 vm.createContext(c);vm.runInContext(extract('function poiDungeonPointIn','function poiChapelWater')+extract('function poiChapelResumeBlocked','function poiOtherworldGateOpen')+
  extract('function poiOtherworldEnemyMayFight','// END OTHERWORLD TRAVEL')+extract('// BEGIN NORTH TRAIL CAMP','// END NORTH TRAIL CAMP'),c);return {c,guard,reward};
}
test('west guard exact origin has independent leash, old regular avoids seam and exit, original locked vault alone blocks reload',()=>{
 const {c,guard}=fixture(),old={x:78,z:83,y:-1,type:'monsterSlime'};
 assert.equal(c.poiOtherworldEnemyMayFight(guard,68,80),true);
 assert.equal(c.poiOtherworldEnemyMayFight(guard,73,80),false);
 assert.equal(c.poiOtherworldEnemyMayFight(old,65,82),false);
 assert.equal(c.poiOtherworldEnemyMayFight(old,74,82),false);
 assert.equal(c.poiOtherworldEnemyMayFight(old,78,84),true);
 assert.equal(c.poiOtherworldEnemyMayFight(old,78,87),false);
 assert.equal(c.poiChapelResumeBlocked({x:78,z:75,y:-1}),true);
 assert.equal(c.poiChapelResumeBlocked({x:66,z:75,y:-1}),false);
 assert.equal(c.poiDungeonTravelKey(c.facilitySite,66,75,-1),'chapel');
});
test('west supply is floor/realm scoped, cannot vanish when full or on failure, and fits exactly once',()=>{
 const {c}=fixture();
 assert.ok(c.poiChapelWestSupply(c.kit));
 c.poiWalkLevel=0;assert.equal(c.poiChapelWestSupply(c.kit),null);c.poiWalkLevel=-1;
 c.poiWalkX=102;assert.equal(c.poiChapelWestSupply(c.kit),null);c.poiWalkX=65;
 assert.equal(c.poiNorthTrailPickup(66,88),false);
 c.world[0].type='earth';assert.equal(c.poiNorthTrailPickup(65,88),false);c.world[0].type='stone';
 c.full=true;assert.equal(c.poiNorthTrailPickup(65,88),false);c.full=false;
 c.fail=true;assert.equal(c.poiNorthTrailPickup(65,88),false);c.fail=false;assert.equal(c.kit.chapelWestSupplyFound,undefined);
 assert.equal(c.poiNorthTrailPickup(65,88),true);assert.equal(c.kit.chapelWestSupplyFound,true);assert.equal(c.kit.gold,17);
 assert.equal(c.poiNorthTrailPickup(65,88),false);
});
test('optional west claim survives an ordinary save and does not silently clear Otherworld or legacy state',()=>{
 for(const claim of [undefined,'true',true]){
  let raw=JSON.stringify({version:1,weapon:null,potions:0,gold:28,otherworldEastSupplyFound:true,chapelWestSupplyFound:claim}),writes=0;
  const c={facilitySite:{id:'base'},POI_PLAYER_MAX_HP:100,localStorage:{getItem:()=>raw,setItem(_k,v){raw=v;writes++}}};
  vm.createContext(c);vm.runInContext(extract('const POI_HOTBAR_KEY=','function poiResetCombat('),c);
  const k=c.poiHotbarRead();assert.equal(writes,0);assert.equal(k.chapelWestSupplyFound,claim===true?true:undefined);
  assert.equal(c.poiHotbarSave({...k,gold:29}),true);
  const saved=JSON.parse(raw);
  assert.deepEqual([saved.chapelWestSupplyFound,saved.otherworldEastSupplyFound,saved.gold],[claim===true?true:undefined,true,29]);
 }
});
