const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function create(seed={},blocked=false){
 const a=html.indexOf('// BEGIN ARMED FOES'),b=html.indexOf('// END ARMED FOES',a);
 let kit=seed;
 const c=vm.createContext({facilitySite:{id:'base'},poiWalkActive:true,pineAIActive:false,poiWalkLevel:0,
  poiHotbarHasKit:()=>true,poiInventoryAllowed:()=>true,poiHotbarRead:()=>kit,poiEconomyWrite:k=>{kit=k;return true},
  poiInventoryAccept:(_k,t,n,item)=>({slots:[{type:t,...item}],accepted:n}),poiInventoryEdited:(k,slots)=>({...k,slots}),
  validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<96,poiEquipmentDurabilityMax:()=>80,
  world:[],isFloor:()=>false,poiEconomyRefresh(){},poiSound(){},poiInventoryItemName:t=>t,toast(){},
  poiWalkCanStep:(x,z)=>!(blocked===true&&x===42&&z===88||blocked==='flank'&&x===41&&z===88)});
 vm.runInContext(html.slice(a,b),c);
 return {c,kit:()=>kit};
}
const mage={type:'monsterSkelMage',x:40,z:88,y:0},long={type:'monsterSkelLongStaff',x:43,z:7,y:0};
const at=o=>({x:o.x,z:o.z,hp:0});
test('actual mage drops only a guaranteed plain weapon on no bonus roll; long-staff enemy drops its own held staff',()=>{
 const f=create({gold:12,toolshopSupply:{stock:6}});
 assert.equal(f.c.poiArmedEnemyLoot(mage,at(mage),()=>.9),true);
 assert.equal(f.kit().armedDrops[0].type,'equipPlainStaff');
 assert.equal(f.kit().armedDrops.length,1);
 assert.equal(f.c.poiArmedEnemyLoot(long,at(long),()=>.5),true);
 assert.equal(f.kit().armedDrops[1].type,'equipLongStaff');
 assert.equal(f.kit().toolshopSupply.stock,6);
});
test('optional fire wand roll and exact remaining uses persist across load and transfer separately from melee durability',()=>{
 const f=create();assert.equal(f.c.poiArmedEnemyLoot(mage,at(mage),()=>.05),true);
 const wand=f.kit().armedDrops.find(a=>a.type==='fireWand');assert.equal(wand.charges,2);assert(!('durability' in wand));
 const re=create();const drops=re.c.poiArmedDropDecode(f.kit().armedDrops);
 assert.equal(drops.length,2);assert.equal(drops[1].charges,2);
 const bad=re.c.poiArmedDropDecode([{...wand,charges:8}]);assert.equal(bad,null);
});
test('mage traces valid diagonal lanes only within its own encounter and range',()=>{
 const f=create();
 assert.equal(f.c.poiArmedAim(mage,at(mage),43,88)?.tiles.length,3);
 const diag=f.c.poiArmedAim(mage,at(mage),43,89);
 assert.equal(diag?.angular,true);
 assert.deepEqual(Array.from(diag.tiles,t=>[t.x,t.z]),[[41,88],[42,89],[43,89]]);
 assert.equal(f.c.poiArmedAim(mage,at(mage),43,91),null,'in authored region but beyond true reach');
 assert.equal(create({},'flank').c.poiArmedAim(mage,at(mage),42,90),null,'diagonal cannot cut a blocked flank');
 assert.equal(f.c.poiArmedAim(mage,at(mage),44,88),null);
 assert.equal(create({},true).c.poiArmedAim(mage,at(mage),43,88),null);
});
