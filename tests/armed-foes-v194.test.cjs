const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function run(opts={}){
 const a=html.indexOf('// BEGIN ARMED FOES'),b=html.indexOf('// END ARMED FOES',a);
 assert(a>=0&&b>a,'armed-foe gameplay scope is present');
 let kit=opts.kit||{},saved=0,writes=true,hitSounds=[];
 const enemy={type:'monsterSkelWarrior',x:110,z:56,y:-1};const state={hp:0,x:110,z:56};
 const c=vm.createContext({facilitySite:{id:'base',chapel:{elite:{type:'monsterSkeleton',x:79,z:78,y:-1}}},
  poiWalkActive:true,pineAIActive:false,poiWalkLevel:-1,poiHotbarHasKit:()=>true,poiInventoryAllowed:()=>true,
  poiHotbarRead:()=>kit,poiEconomyWrite:k=>{if(!writes)return false;kit=k;saved++;return true},
  poiInventoryAccept:(_k,t,n,source)=>({slots:[{type:t,durability:source.durability}],accepted:opts.full?0:n}),poiInventoryEdited:(k,slots)=>({...k,slots}),
  validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<96,poiEquipmentDurabilityMax:()=>100,
  world:[{type:'moss',x:80,z:75,y:-1}],isFloor:t=>t==='moss',poiEconomyRefresh(){},poiSound:(...a)=>hitSounds.push(a),
  poiInventoryItemName:t=>t,toast(){},poiWalkCanStep:(x,z)=>!(opts.block&&x===104&&z===86||opts.diagonalFlank&&x===106&&z===86)});
 vm.runInContext(html.slice(a,b),c);
 return {c,enemy,state,kit:()=>kit,count:()=>saved,block:()=>writes=false,hitSounds};
}
test('an exact armed kill guarantees its held weapon, keeps its roll until picked and never writes over unrelated save fields',()=>{
 const f=run({kit:{gold:12,chapelCleared:true,toolshopSupply:{stock:6}}});
 assert.equal(f.c.poiArmedEnemyLoot(f.enemy,{...f.state,hp:1},()=>0),false);
 assert.equal(f.c.poiArmedEnemyLoot(f.enemy,f.state,()=>.50),true);
 assert.equal(f.kit().armedDrops[0].type,'equipBoneSword');assert.equal(f.kit().armedDrops[0].durability,55);
 assert.equal(f.c.poiArmedEnemyLoot(f.enemy,f.state,()=>.9),false);
 assert.equal(f.count(),1);
 assert.equal(f.c.poiArmedPickup(110,56),true);
 assert.equal(f.kit().armedDrops.length,0);assert.equal(f.kit().slots[0].durability,55);
 assert.equal(f.kit().toolshopSupply.stock,6);assert.equal(f.kit().chapelCleared,true);
});
test('full bags leave their guaranteed roll on the ground; staff find is once per save',()=>{
 const f=run({full:true});
 assert.equal(f.c.poiArmedEnemyLoot(f.enemy,f.state,()=>0),true);
 assert.equal(f.c.poiArmedPickup(110,56),false);assert.equal(f.kit().armedDrops[0].durability,30);
 const g=run();assert.equal(g.c.poiArmedPickup(80,75),true);
 assert.equal(g.kit().fireWandFound,true);assert.equal(g.c.poiArmedPickup(80,75),false);
});
test('ranged armed foes trace diagonal lanes, stop at wall flanks and stay in encounter areas',()=>{
 const f=run({block:true}),o={type:'monsterSkelArcher',x:105,z:86,y:0};
 assert.equal(f.c.poiArmedBound(o,100,86),false);
 assert.equal(f.c.poiArmedBound(o,104,86),true);
 assert.equal(f.c.poiArmedAim(o,{x:105,z:86},102,86),null);
 const diag=f.c.poiArmedAim(o,{x:105,z:86},106,87);
 assert.equal(diag?.angular,true);
 assert.deepEqual(Array.from(diag.tiles,t=>[t.x,t.z]),[[106,87]]);
 assert.equal(run({diagonalFlank:true}).c.poiArmedAim(o,{x:105,z:86},106,87),null);
 const clear=run();
 assert.equal(clear.c.poiArmedAim(o,{x:105,z:86},108,86)?.tiles.length,3);
});
