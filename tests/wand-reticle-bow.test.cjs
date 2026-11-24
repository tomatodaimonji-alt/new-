const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){
 const x=h.indexOf(a),y=h.indexOf(b,x+1);assert(x>=0&&y>x,a);return h.slice(x,y);
}
test('shortcut equips a wand cursor immediately, even with no target, and clears it on weapon switch',()=>{
 const marker={hidden:true,style:{},dataset:{},setAttribute(){}}, projected=[];
 const slots=[{type:'fireWand',charges:2},{type:'equipWoodSword'}], layer={append(){}};
 let kit={weapon:'equipWoodSword'},lock=null;
 const b={hidden:true},menu={hidden:true}, doc={hidden:false,createElement:()=>marker,querySelector:()=>null};
 const o={x:10,z:10,y:0,dir:{x:1,z:0}};
 const c={document:doc,canvas:{clientWidth:600,clientHeight:600},poiWalkActive:true,pineAIActive:false,poiPlayerDying:()=>false,poiTownDialogue:null,
  POI_HOTBAR_SIZE:6,POI_BAG_SAVED:18,POI_FIRE_WAND:'fireWand',POI_INVENTORY_HERB:'herb',POI_CANNED:'canned',POI_AIM_EPS:1e-6,
  poiInventoryAllowed:()=>true,poiStorageIndexExists:i=>i>=0&&i<24,poiHotbarHasKit:()=>true,poiHotbarRead:()=>kit,
  poiInventorySlots:()=>slots,poiInventorySlot:(_,i)=>slots[i]?.type,poiGoldHotbarSlot:()=>5,
  poiHotbarWeaponForType:t=>t==='equipWoodSword'?t:null,poiStorageActionResult:r=>({reason:r}),
  poiEconomyWrite:x=>{kit=x;return true},poiBagSetOpen(){},poiShopSync(){},poiWalkAvatar(){},poiHotbarRender(){},
  $(id){return id==='poiLandscapeMenu'?menu:b},poiAimOrigin:()=>o,poiCombatLockUpdate:()=>lock,
  poiCombatLockVisible:()=>!c.occluded,POI_ENEMY_HEAD_HEIGHT:{},poiMonsterPose:()=>({x:14.5,y:0,z:10.5}),
  poiWorldToScreen:(_,x,y,z)=>{projected.push({x,y,z});return {x:x*20,y:200-y*50}},
  poiAimUnit:(x,z)=>{const len=Math.hypot(x,z);return len?{x:x/len,z:z/len}:null},poiAimWall:()=>()=>true,poiAimWallLimit:(_o,_dir,range)=>Math.min(range,c.wall??Infinity),terrainY:()=>0,facilitySite:null
 };
 const a=vm.runInNewContext('let poiAimMarker=null;\n'+cut('function poiSacredInteriorHostileVisible(','let poiSacredInteriorVbo')+cut('let poiArmedWand=null;','function poiUseBagItem(')+cut('function poiHotbarUse(','function poiCombatActorMake(')+cut('const POI_COMBAT_TORSO_HEIGHT=','// BEGIN PLAYER WEAPON PROFILES')+';({use:poiHotbarUse,draw:poiAimRenderMarker,armed:poiArmedWandIndex})',c);
 const draw=()=>{projected.length=0;a.draw(1000,null,layer);return projected.at(-1)};
 draw();assert.equal(marker.hidden,true);
 a.use(0);assert.equal(a.armed(),0);
 const p=draw();assert.equal(marker.dataset.aim,'wand','arming the shortcut selects a wand-specific reticle');assert.equal(marker.hidden,false);
 assert(p.x>10.5&&p.x<=11.5);assert.equal(p.z,10.5);
 c.wall=.2;assert(draw().x<p.x,'no aim point beyond a wall');
 lock={x:14,z:10,id:{type:'monsterSlime'},state:{}};assert.deepEqual(draw(),{x:14.5,y:.44,z:10.5});
 c.occluded=true;assert(draw().x<11,'occluded lock falls back to the actual wall-clamped wand bearing');
 c.occluded=false;menu.hidden=false;draw();assert.equal(marker.hidden,true);menu.hidden=true;
 a.use(1);assert.equal(a.armed(),null,'selecting the already equipped sword shortcut also disarms the wand');
 draw();assert.equal(marker.hidden,false);assert.notEqual(marker.dataset.aim,'wand');
 a.use(0);a.use(0);assert.equal(a.armed(),null);
});
test('player bow releases the actual pending attack at 325 ms and has synchronized follow-through',()=>{
 const launches=[],c={poiWalkActive:true,document:{hidden:false},poiWalkLevel:0,poiWalkX:7,poiWalkZ:3,poiWalkFacing:1,
  poiEquippedWeapon:()=> 'equipWoodBow',poiPlayerWeaponFlightBegin:(a,now)=>{launches.push(now);a.phase='flight'}};
 const api=vm.runInNewContext(cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('function poiPlayerWeaponFrame(','// A shoulder-led flat cut')+cut('function poiPlayerProfilePose(','// Visual release only:')+
  ';({weapon:poiPlayerWeaponProfile,frame:poiPlayerWeaponFrame,pose:poiPlayerProfilePose,set:s=>{poiPlayerWeaponPending=s}})',c);
 const p=api.weapon('equipWoodBow');api.set({type:'equipWoodBow',profile:p,started:1000,x:7,z:3,facing:1,y:0});
 api.frame(1324);assert.deepEqual(launches,[]);
 api.frame(1325);assert.deepEqual(launches,[1325]);
 assert.equal(api.pose('equipWoodBow',324).bowReleased,false);assert.equal(api.pose('equipWoodBow',325).bowReleased,true);
 assert.equal(p.pose-p.hit,200);assert.equal(p.ready,1030);
});
