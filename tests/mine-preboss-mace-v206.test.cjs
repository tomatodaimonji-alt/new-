const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const reward={id:'mine-preboss-mace',x:94,z:62,y:-1,type:'equipStoneMace',count:1,durability:100};
function launch(raw=null){
 let writes=0;
 const c={poiPlayerHP:100,POI_PLAYER_MAX_HP:100,facilitySite:{id:'base',mine:{preBossSupply:reward,sideFinds:[{id:'mine-storeroom',type:'cannedFood',count:1,x:107,z:56,y:-1}]}},
  poiWalkActive:true,pineAIActive:false,poiWalkLevel:-1,poiWalkX:reward.x,poiWalkZ:reward.z,world:[{x:reward.x,z:reward.z,y:-1,type:'stone'}],poiWalkCanStep:()=>true,validPos:()=>true,poiWalkAvatar(){},document:{querySelectorAll:()=>[]},$(){return null},toast(){},poiSound(){},
  localStorage:{getItem:()=>raw,setItem(_k,v){if(c.fail)throw Error('quota');writes++;raw=v}}};
 vm.createContext(c);const a=h.indexOf('const POI_HOTBAR_KEY='),b=h.indexOf('function poiResetCombat(',a);
 vm.runInContext(h.slice(a,b),c);return {c,raw:()=>raw,writes:()=>writes};
}
test('starter mine weapon is physically collected once, with durable condition, across reload',()=>{
 const f=launch(),c=f.c;
 assert.equal(c.poiMineFindList(c.poiHotbarRead()).some(p=>p.id===reward.id),true);
 assert.equal(c.poiMineFindPickup(reward.x,reward.z),true);assert.equal(f.writes(),1);
 const saved=JSON.parse(f.raw());
 assert.equal(saved.slots.find(s=>s?.type===reward.type).durability,100);
 assert.deepEqual(saved.mineFindClaims,[reward.id]);
 const newRun=launch(f.raw());assert.equal(newRun.c.poiMineFindPickup(reward.x,reward.z),false);
 assert.equal(newRun.c.poiMineFindList(newRun.c.poiHotbarRead()).some(p=>p.id==='mine-storeroom'),true);
 assert.equal(newRun.writes(),0);
});
test('wrong tile/site/floor, missing live stone, full inventory and quota failure leave no claim',()=>{
 const f=launch(),c=f.c;
 assert.equal(c.poiMineFindPickup(reward.x+1,reward.z),false);
 c.poiWalkLevel=0;assert.equal(c.poiMineFindPickup(reward.x,reward.z),false);c.poiWalkLevel=-1;
 c.facilitySite.id='inn';assert.equal(c.poiMineFindPickup(reward.x,reward.z),false);c.facilitySite.id='base';
 c.world[0].type='earth';assert.equal(c.poiMineFindPickup(reward.x,reward.z),false);c.world[0].type='stone';
 c.fail=true;assert.equal(c.poiMineFindPickup(reward.x,reward.z),false);c.fail=false;
 assert.equal(f.writes(),0);assert.equal(c.poiHotbarRead().mineFindClaims,undefined);
 const slots=Array(27).fill(null).map((_,i)=>i===0?{type:'equipWoodSword',count:1}:{type:'cannedFood',count:9});
 const full=launch(JSON.stringify({version:1,weapon:null,potions:0,slots}));
 assert.equal(full.c.poiHotbarRead().slots.length,27);assert.equal(full.c.poiMineFindPickup(reward.x,reward.z),false);assert.equal(full.writes(),0);
});
test('already carrying same type leaves supply available; ordinary pile stays independent',()=>{
 const slots=Array(27).fill(null),x=reward.x,z=reward.z,y=-1;
 const old={type:'equipStoneMace',count:1,durability:26};
 const drops=[{...old,x:x+1,z,y}];
 slots[0]={type:'equipWoodSword',count:1};slots[2]=old;
 const data={version:1,weapon:null,potions:0,slots,weaponDurabilityVersion:2};
 const held=launch(JSON.stringify(data));
 assert.equal(held.c.poiMineFindPickup(x,z),false);
 assert.equal(held.writes(),0);
 slots[2]=null;
 const found=launch(JSON.stringify({...data,drops}));
 assert.equal(found.c.poiMineFindPickup(x,z),true);
 const reread=launch(found.raw()).c.poiHotbarRead();
 assert.equal(reread.drops[0].durability,26);
 assert.equal(reread.slots.find(c=>c?.type===reward.type).durability,100);
});
