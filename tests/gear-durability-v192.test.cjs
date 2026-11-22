const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cells=(n,i,value)=>Array.from({length:n},(_,j)=>i===j?value:null), chest=(type,durability)=>({version:1,slots:cells(18,3,{type,durability,count:1})});
function fixture(saved=null){
 let raw=saved&&JSON.stringify(saved),writes=0;
 const progress={},el={hidden:true,style:{},querySelector:()=>progress},canvas={clientWidth:320,clientHeight:480};
 const point={x:150,y:220},cells={};
 const c=vm.createContext({facilitySite:{id:'base',mine:{vault:{chest:{x:121,z:43,y:-1}}},otherworld:{chest:{x:100,z:74,y:-1}}},
  poiWalkLevel:-1,poiWalkActive:true,pineAIActive:false,world:[],canvas,terrainY:()=>0,
  poiWorldToScreen:(_vp,x,y,z)=>{cells.position=[x,y,z];return point},$:(id)=>id==='poiMineUnlockProgress'?el:null,poiWalkAvatar(){},
  localStorage:{getItem:()=>raw,setItem(_k,v){writes++;raw=v}},document:{querySelectorAll:()=>[]}});
 vm.runInContext(html.slice(html.indexOf('const POI_HOTBAR_KEY='),html.indexOf('function poiResetCombat(')),c);
 return {c,writes:()=>writes,raw:()=>JSON.parse(raw),el,progress,point,cells};
}
const W='equipWoodSword',K='kitchenKnife',weapon=(type,durability)=>({type,durability,count:1});
test('both weapons start with twice the capacity; legacy slots and B1 drops migrate once with read-only loading',()=>{
 const f=fixture({version:1,weapon:W,potions:0,wornDurability:{torso:30},
  slots:cells(27,0,weapon(W,34)),drops:[{...weapon(K,7),x:109,z:55,y:-1}]});
 const a=f.c.poiHotbarRead();
 assert.equal(f.c.poiEquipmentDurabilityMax(W),160);assert.equal(f.c.poiEquipmentDurabilityMax(K),40);
 assert.equal(a.slots[0].durability,68);assert.equal(a.drops[0].durability,14);assert.equal(a.wornDurability.torso,30);
 assert.equal(f.writes(),0);
 assert.equal(f.c.poiEquipmentSpendWeapon(W),true);
 assert.equal(f.raw().weaponDurabilityVersion,2);
 assert.equal(fixture(f.raw()).c.poiHotbarRead().slots[0].durability,67);
 assert.equal(fixture(f.raw()).c.poiHotbarRead().drops[0].durability,14);
});
test('legacy weapons in all three chest stores and locked bag migrate; broken wood stays broken',()=>{
 const releases=[['kitchenChest',{}],['mineTreasureChest',{mineGateCleared:true}],['otherworldChest',{otherworldCleared:true}]];
 for(const [key,flags] of releases){
  const f=fixture({version:1,weapon:null,potions:0,sword:false,woodSwordBroken:true,...flags,[key]:chest(K,10)});
  assert.equal(f.c.poiHotbarRead()[key].slots[3].durability,20);
  assert.equal(f.c.poiHotbarRead().woodSwordBroken,true);
  assert(!f.c.poiInventorySlots(f.c.poiHotbarRead()).some(x=>x?.type===W));
  assert.equal(f.writes(),0);
 }
 const f=fixture({version:1,weapon:null,potions:0,slots:cells(27,18,weapon(W,15))});
 assert.equal(f.c.poiHotbarRead().slots[18].durability,30);assert.equal(f.writes(),0);
});
test('progress has no visible caption; follows each actual chest and hides offscreen/cancelled',()=>{
 assert.doesNotMatch(html,/<div id="poiMineUnlockProgress"[^>]*>\s*<strong>/);
 const f=fixture(),{c,el,progress,point}=f;
 vm.runInContext("poiMineUnlock={key:'mineTreasureChest',elapsed:1400}",c);
 c.poiMineUnlockDraw([]);
 assert.equal(el.hidden,false);assert.equal(progress.value,1400);assert.equal(el.style.left,'150px');
 assert.equal(f.cells.position[0],121.5);assert.equal(f.cells.position[2],43.5);
 vm.runInContext("poiMineUnlock.key='otherworldChest'",c);point.x=190;point.y=202;
 c.poiMineUnlockDraw([]);assert.equal(el.style.left,'190px');
 assert.equal(f.cells.position[0],100.5);assert.equal(f.cells.position[2],74.5);
 point.x=321;c.poiMineUnlockDraw([]);assert.equal(el.hidden,true);
 c.poiMineUnlockCancel();assert.equal(el.hidden,true);assert.equal(progress.value,0);
});
