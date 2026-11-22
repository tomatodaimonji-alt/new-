const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function snippet(a,b){const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)}
function fixture(kit={weapon:null,potions:3}, options={}){
 let state=kit, rolls=0;
 const scope=vm.createContext({facilitySite:{id:'base',townOffset:22},world:[{x:108,z:60,y:0,type:'ruinDoorBroken'}],
  poiEconomyAllowed:()=>true,poiLookoutRandom:()=>{rolls++;return options.random??.2},
  poiWalkCanStep:(x,z)=>!options.blocked?.includes(x+','+z),
  poiHotbarRead:()=>state,poiEconomyWrite:next=>{state=next;return true},poiHotbarHasKit:()=>true,
  poiEconomyDrops:new Map(),poiEconomyCaches:new Map(),poiEconomyMeshDirty:false,POI_ECONOMY_COIN:3,
  POI_INVENTORY_HERB:'healingHerb',POI_INVENTORY_SWORD:'equipWoodSword',POI_INVENTORY_LIMIT:36,POI_ECONOMY_GOLD_MAX:999999,
  poiEconomyRefresh(){},toast(){},poiInventoryAllowed:()=>true,poiWalkLevel:0,
  poiInventoryAccept:()=>({slots:{},accepted:1}),poiInventoryEdited:kit=>kit});
 vm.runInContext(snippet('const POI_LOOKOUT_CELLS=','function poiEconomyDrop(')+
  snippet('function poiEconomyCollect(','function poiEconomySnapshot(')+
  snippet('function poiInventoryPickup(','function poiInventoryReleaseMesh('),scope);
 const enter=scope.poiLookoutEnter;scope.poiLookoutEnter=(...args)=>enter(...args,scope.poiLookoutRandom);
 return {scope,get:()=>JSON.parse(JSON.stringify(state)),rolls:()=>rolls};
}
test('real portal entry rolls once, adds a reachable herb without overwriting a dropped sword and persists claim',()=>{
 const sword={x:107,z:58,y:0,type:'equipWoodSword'};
 const f=fixture({weapon:null,potions:3,drops:[sword]});
 const {scope}=f;
 assert.equal(scope.poiLookoutEnter(108,61,108,60),false);
 assert.equal(scope.poiLookoutEnter(108,60,108,59),true);
 assert.deepEqual(f.get().drops,[sword,{x:109,z:58,y:0,type:'healingHerb'}]);
 assert.equal(f.get().towerFind.kind,'herb');assert.equal(f.rolls(),1);
 scope.poiLookoutEnter(108,56,108,57);assert.equal(f.rolls(),1);
 assert.equal(scope.poiInventoryPickup(109,58),true);assert.deepEqual(f.get().towerFind,{kind:'claimed'});
 assert.deepEqual(f.get().drops,[sword]);
});
test('gold is restored as a genuine pickup and never credits early; empty remains empty across sessions',()=>{
 const f=fixture(undefined,{random:.6});
 assert.equal(f.scope.poiLookoutEnter(108,56,108,57),true);
 const state=f.get();assert.equal(state.towerFind.kind,'gold');assert.equal(state.gold,undefined);
 const resumed=fixture(state);resumed.scope.poiLookoutRestoreGold();
 const coin=[...resumed.scope.poiEconomyCaches.values()][0];
 assert(coin);assert.equal(coin.amount,3);
 assert.equal(resumed.scope.poiEconomyCollect(coin.x,coin.z),true);
 assert.equal(resumed.get().gold,3);assert.deepEqual(resumed.get().towerFind,{kind:'claimed'});
 resumed.scope.poiLookoutEnter(108,60,108,59);assert.equal(resumed.rolls(),0);
 const empty=fixture(undefined,{random:.9});empty.scope.poiLookoutEnter(108,60,108,59);
 const after=fixture(empty.get());after.scope.poiLookoutEnter(108,56,108,57);
 assert.deepEqual(after.get().towerFind,{kind:'empty'});assert.equal(after.rolls(),0);
});
test('a modified inaccessible side tile is skipped and world entry requires a ground-floor placed tower',()=>{
 const {scope,get}=fixture(undefined,{blocked:['107,58','109,58']});
 scope.world=[];assert.equal(scope.poiLookoutEnter(108,60,108,59),false);
 scope.world=[{x:108,z:60,y:0,type:'ruinDoorBroken'}];
 scope.poiLookoutEnter(108,60,108,59);
 assert.deepEqual(get().drops,[{x:108,z:58,y:0,type:'healingHerb'}]);
});
test('tower loot is actually rendered above fitted masonry without raising unrelated drops',()=>{
 const {scope}=fixture({weapon:null,potions:3,towerFind:{kind:'gold',cell:0}});
 scope.world.push({x:107,z:58,y:0,type:'stone'},{x:109,z:58,y:0,type:'stone'});
 assert.equal(scope.poiLookoutLootTop(107,58,0),.13);
 assert.equal(scope.poiLookoutLootTop(109,58,0),0);
 assert.equal(scope.poiLookoutLootTop(107,58,1),0);
 assert.match(html,/id==='lookout-tower'&&typeof poiLookoutLootTop/);
 assert.match(html,/Math.max\(floorTop,lookout\)/);
 assert.match(html,/Math.max\(top,lookout\)/);
});
test('temporarily blocked tower does not consume the discovery chance',()=>{
 const options={blocked:['107,58','109,58','108,58','107,59','109,57']};
 const {scope,get,rolls}=fixture(undefined,options);
 assert.equal(scope.poiLookoutEnter(108,60,108,59),false);
 assert.equal(rolls(),0);assert.equal(get().towerFind,undefined);
 options.blocked=[];
 assert.equal(scope.poiLookoutEnter(108,60,108,59),true);
 assert.equal(rolls(),1);assert.equal(get().towerFind.kind,'herb');
});
