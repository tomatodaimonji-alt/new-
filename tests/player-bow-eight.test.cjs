const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(begin,end)=>{const x=h.indexOf(begin),y=h.indexOf(end,x+1);a(x>=0&&y>x,begin);return h.slice(x,y)};
function runtime(){
 const c={poiWalkLevel:0,poiWalkX:20,poiWalkZ:20,poiWalkFacing:1,poiWalkFromX:20,poiWalkFromZ:20,poiWalkStarted:-1000,poiWalkStepMs:240,
  poiFreePose:null,poiWalkActive:true,pineGameActive:false,document:{hidden:false},performance:{now:()=>0},world:[],facilitySite:null,
  poiMonsterStates:new Map(),poiAttackReady:0,poiWalkActionWeapon:null,poiWalkActionStarted:0,
  poiEquippedWeapon:()=> 'equipWoodBow',validPos:()=>true,isWallId:id=>id==='wall',poiWalkPassableDoor:id=>id==='door',terrainY:()=>0,
  poiMonsterPose:(_id,s)=>({x:s.x+.5,z:s.z+.5,y:0}),sounds:[],poiSound(s){c.sounds.push(s)},poiWalkAvatar(){},
  wear:0,poiEquipmentSpendWeapon(){c.wear++;return true},dmg:[],poiInventoryStack:()=>1,poiEquipmentDurabilityPercent:()=>null,
  poiArmorCategory:()=>false};
 vm.createContext(c);
 // Use existing angular tracking, draw, flight, intercept and damage/wear
 // dispatch; observe only the damage reducer and art append boundaries.
 let src=slice('// BEGIN ANGULAR COMBAT MATH','function poiAimRenderMarker(')+slice('// BEGIN PLAYER WEAPON PROFILES','// END PLAYER WEAPON PROFILES');
 const start=src.indexOf('function poiPlayerDamageTarget('),end=src.indexOf('function poiPlayerWeaponResolve(',start);
 a(start>=0&&end>start);
 src=src.slice(0,start)+'function poiPlayerDamageTarget(entry,x,z,n,type,theme){dmg.push({x,z,n,type,theme});entry[1].hp-=n}\n'+src.slice(end);
 vm.runInContext(src+slice('function poiItemDetailDescription(','function poiItemDetailClose('),c);
 const run=s=>vm.runInContext(s,c);
 const add=(dx,dz)=>{const id={x:20+dx,z:20+dz,y:0,type:'monsterSlime'},s={x:id.x,z:id.z,hp:50};c.poiMonsterStates.set(id,s);return s};
 const draw=()=>{c.poiPlayerStartProfile('equipWoodBow',1000);c.poiPlayerWeaponFrame(1324);
  a.equal(run('poiPlayerWeaponVisual'),null);c.poiPlayerWeaponFrame(1325);
  const v=run('poiPlayerWeaponVisual');a(v);a.equal(v.started,1325);return v};
 const point=t=>run('poiAimProjectileSample(poiPlayerWeaponVisual,'+t+')');
 return {c,run,add,draw,point};
}
test('player wood bow shows the actual long reach without changing damage, 325ms draw, 65ms/tile or wand',()=>{
 const {c,run}=runtime(),p=c.poiPlayerWeaponProfile('equipWoodBow');
 a.deepEqual([p.range,p.damage,p.hit,p.cellMs,p.ready,p.pose,p.speed,p.reach],[8,22,325,65,1030,525,1,5]);
 a.equal(run('POI_COMBAT_LOCK_RANGE'),8);
 a.equal(c.poiPlayerWeaponProfile('fireWand').range,8);
 a.match(c.poiItemDetailDescription({type:'equipWoodBow',count:1}),/射程：8マス/);
});
test('native angular flight reaches exact eighth tile, visible head stays on its shot, never tags a ninth-tile body',()=>{
 for(const [dx,dz] of [[8,0],[4,4*Math.sqrt(3)]]){
  const {c,add,draw,point,run}=runtime(),target=add(dx,dz);
  const v=draw();a.equal(v.travel,520);a.equal(run('poiAimLocked.state.hp'),50);
  c.poiPlayerWeaponFrame(1325+455);
  const head=point(1325+455),ux=dx/8,uz=dz/8;
  a(Math.abs(head.x-20.5-7*ux)<1e-6);a(Math.abs(head.z-20.5-7*uz)<1e-6);a.equal(target.hp,50);
  c.poiPlayerWeaponFrame(1325+520);
  a.equal(target.hp,28);a.equal(c.wear,1);
  const hit=Math.hypot(point(1900).x-20.5,point(1900).z-20.5);
  a(hit>=7.65&&hit<=8+1e-6);
 }
 for(const distance of [8.001,9]){
  const {c,add,draw,point,run}=runtime(),target=add(distance,0);
  draw();a.equal(run('poiAimLocked'),null);
  c.poiPlayerWeaponFrame(1325+520);
  a.equal(point(1900).x,28.5);a.equal(target.hp,50);a.equal(c.wear,0);
 }
});
test('wall blocks new distant target, even when added during an already visible shot',()=>{
 for(const after of [false,true]){
  const {c,add,draw,point}=runtime(),target=add(8,0),wall={type:'wall',x:26,z:20,y:0};
  if(!after)c.world.push(wall);
  const v=draw();
  if(after){c.poiPlayerWeaponFrame(1325+4*65);c.world.push(wall)}
  else a.equal(v.limit,5.5);
  c.poiPlayerWeaponFrame(1325+520);
  a.equal(point(1900).x,26);a.equal(target.hp,50);a.equal(c.wear,0);
 }
});
