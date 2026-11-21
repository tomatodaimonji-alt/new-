const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
function setup(initial=null){
 let raw=initial&&JSON.stringify(initial),fail=false,writes=0;
 const x={poiWalkActive:true,pineAIActive:false,facilitySite:{id:'base'},poiWalkLevel:0,poiWalkX:0,poiWalkZ:0,
  poiWildExterior:()=>true,poiWalkCanStep:()=>true,poiHotbarRender(){},toast(){},
  localStorage:{getItem:()=>raw,setItem(k,v){if(fail)throw Error('quota');writes++;raw=v}}};
 vm.createContext(x);
 vm.runInContext(cut('const POI_HOTBAR_KEY=','function poiHotbarSwordIcon('),x);
 return {x,save:()=>JSON.parse(raw),writes:()=>writes,fail:v=>{fail=v}};
}
test('old kit inventory works and purchase updates gold and potion stock atomically',()=>{
 const o=setup({version:1,weapon:'equipWoodSword',potions:2,gold:9});const x=o.x;
 assert.equal(x.poiEconomyGold(),9);assert.equal(o.writes(),0);
 const result=x.poiEconomyBuyPotion();assert.equal(result.ok,true);assert.equal(o.writes(),1);
 assert.deepEqual(o.save(),{version:1,weapon:'equipWoodSword',potions:3,gold:3});
 assert.equal(x.poiEconomyBuyPotion().reason,'funds');assert.equal(o.writes(),1);
 const k=setup({version:1,weapon:null,potions:8,gold:20});k.fail(true);
 assert.equal(k.x.poiEconomyBuyPotion().reason,'storage');assert.equal(k.x.poiEconomyGold(),20);
 assert.equal(k.x.poiHotbarRead().potions,8);assert.equal(k.writes(),0);
 k.fail(false);assert.equal(k.x.poiEconomyBuyPotion().potions,9);
 assert.equal(k.x.poiEconomyBuyPotion().reason,'full');assert.equal(k.writes(),1);
 k.x.facilitySite=null;assert.equal(k.x.poiEconomyBuyPotion().reason,'unavailable');
 const fresh=setup({version:1,weapon:'equipWoodSword',potions:1});
 assert.equal(fresh.x.poiEquippedWeapon(),'equipWoodSword');assert.equal(fresh.x.poiHotbarRead().potions,1);
 assert.equal(fresh.x.poiEconomyGold(),0);assert.equal(fresh.writes(),0);
 assert.equal(setup().x.poiHotbarRead().potions,3);
});
test('unclaimed caches and wild slime drops are walk-over pickups, with retry after storage failure',()=>{
 const o=setup(),x=o.x;
 x.poiEconomyStart();
 let model=x.poiEconomySnapshot(),cache=model.caches[0];
 assert.equal(model.caches.length,3);assert.equal(o.writes(),0);
 assert.equal(x.poiEconomyCollect(cache.x+1,cache.z),false);o.fail(true);
 assert.equal(x.poiEconomyCollect(cache.x,cache.z),false);assert.equal(x.poiEconomySnapshot().caches.length,3);
 o.fail(false);assert(x.poiEconomyCollect(cache.x,cache.z));assert.equal(x.poiEconomyGold(),3);
 assert.deepEqual(o.save().claimedCaches,[cache.id]);
 assert.equal(x.poiEconomyCollect(cache.x,cache.z),false);
 const next=setup(o.save());next.x.poiEconomyStart();assert.equal(next.x.poiEconomySnapshot().caches.length,2);
 const slime={type:'monsterSlime',y:0},actor={wildSpawn:true,x:72,z:42,hp:0};
 x.poiEconomyDrop(slime,{...actor,wildSpawn:false});assert.equal(x.poiEconomySnapshot().drops.length,0);
 x.poiEconomyDrop(slime,actor);x.poiEconomyDrop(slime,actor);
 assert.equal(x.poiEconomySnapshot().drops[0].amount,3);assert.equal(x.poiEconomyGold(),3);
 x.poiWalkLevel=1;assert.equal(x.poiEconomyCollect(actor.x,actor.z),false);x.poiWalkLevel=0;
 assert(x.poiEconomyCollect(actor.x,actor.z));assert.equal(x.poiEconomyGold(),6);
 assert.equal(x.poiEconomySnapshot().drops.length,0);
 x.poiEconomyStop();assert.equal(x.poiEconomySnapshot().caches.length,0);
});
