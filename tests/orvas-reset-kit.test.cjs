const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),K='kit',C='clock',R='resume',B='world-workshop-game-reset-backup-v1',F='world-workshop-game-reset-first-backup-v1';
const items=['equipOrvasHead','equipOrvasGreatsword','equipOrvasTwinGreatswords'];
function run({old=true}={}){
 const prior=JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:23,z:92,y:0}});
 const map=new Map([[C,'clock bytes'],[R,prior],['notes','keep']]);if(old)map.set(K,'old kit bytes');
 const storage={getItem:k=>map.get(k)??null,removeItem:k=>map.delete(k),setItem(k,v){map.set(k,v)}};
 const ctx={localStorage:storage,POI_HOTBAR_KEY:K,POI_TOWN_CLOCK_KEY:C,WORKSHOP_RESUME_KEY:R,POI_HOTBAR_SIZE:9,POI_BAG_SAVED:18,
  POI_INVENTORY_SWORD:'equipWoodSword',POI_INVENTORY_HERB:'herb',POI_HOTBAR_POTION_START:3,POI_FRESH_ARMOR:{head:null,torso:null,legs:null,feet:null},
  poiCompanionType:id=>id==='orvasSoul'?{hp:1050}:null,poiEquipmentDurabilityMax:t=>items.indexOf(t)+90,poiInventoryOrdinarySlots:kit=>[{type:'equipWoodSword',count:1},{type:'herb',count:kit.potions},...Array(25).fill(null)],
  workshopResumeDecode:r=>JSON.parse(r??'null')};
 vm.runInNewContext(h.split('// BEGIN GAME WORLD RESET')[1].split('// END GAME WORLD RESET')[0],ctx);
 return {ctx,storage,map,prior};
}
test('explicit reset writes one full-condition instance of each test weapon; old and new baseline behavior is untouched without opt-in',()=>{
 const f=run();a.equal(f.map.get(K),'old kit bytes');
 const res=f.ctx.poiGameResetStorage(f.storage,true);a(res.ok);
 const seed=JSON.parse(f.map.get(K)),slots=seed.slots;
 a.equal(slots.length,27);a.equal(seed.weapon,null);a.equal(seed.potions,3);
 a.deepEqual(slots.slice(0,2),[{type:'equipWoodSword',count:1},{type:'herb',count:3}]);
 a.deepEqual(slots.slice(2,5),items.map((type,i)=>({type,count:1,durability:90+i})));
 a.deepEqual(slots[5],{type:'orvasSoul',count:1,durability:1050});a.equal(seed.companionSoul,undefined);
 a(slots.slice(6).every(s=>s===null));a.equal(f.map.get('notes'),'keep');
 a.equal(JSON.parse(f.map.get(F)).before[K],'old kit bytes');a.equal(JSON.parse(f.map.get(B)).before[R],f.prior);
 const again=f.ctx.poiGameResetStorage(f.storage,true);a(again.ok);a.deepEqual(JSON.parse(f.map.get(K)),seed);
 const plain=run();a(plain.ctx.poiGameResetStorage(plain.storage).ok);a.equal(plain.map.get(K),undefined);
});
test('prepared seed journal restores exact old inventory or removes transaction seed if inventory did not exist',()=>{
 for(const old of [true,false]){
  const f=run({old}),before=Object.fromEntries([K,C,R].map(k=>[k,f.storage.getItem(k)]));
  const priorStorage=f.storage.setItem;
  f.storage.setItem=(k,v)=>{if(k===B&&JSON.parse(v).phase==='complete')throw Error('disk');priorStorage(k,v)};
  const res=f.ctx.poiGameResetStorage(f.storage,true);
  a.equal(res.ok,false);a.equal(res.reason,'storage');
  for(const k of [K,C,R])a.equal(f.storage.getItem(k),before[k]);
  a.equal(JSON.parse(f.map.get(B)).phase,'restored');
 }
});

test('legacy weapon-only prepared transactions still restore intact',()=>{
 const f=run(),seed=JSON.parse(f.ctx.poiGameResetKit());seed.slots[5]=null;
 const archived=JSON.stringify({version:1,phase:'prepared',before:{[K]:'old kit bytes',[C]:'clock bytes',[R]:f.prior},seed:JSON.stringify(seed)});
 f.map.set(B,archived);f.map.set(K,JSON.stringify(seed));f.map.delete(C);f.map.delete(R);
 a(f.ctx.poiGameResetRecover(f.storage));a.equal(f.map.get(K),'old kit bytes');a.equal(f.map.get(R),f.prior);
});
