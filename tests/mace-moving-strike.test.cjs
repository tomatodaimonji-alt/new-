const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)}
function play(id){
 const weapon={held:id},o={type:'monsterSlime',x:11,z:10,y:0},s={x:11,z:10,hp:100};
 const calls=[];
 const c={world:[],poiMonsterStates:new Map([[o,s]]),facilitySite:null,poiWalkActive:true,poiWalkLevel:0,poiWalkFacing:1,
  poiWalkX:10,poiWalkZ:10,poiWalkFromX:10,poiWalkFromZ:10,poiWalkStarted:0,poiWalkStepMs:160,POI_WALK_MS:160,
  poiFreePose:{x:10.1,z:10,angle:-Math.PI/2,level:0,walking:true},poiWalkActionStarted:0,poiWalkActionWeapon:null,poiAttackReady:0,
  validPos:()=>true,isWallId:t=>t==='wall',poiWalkPassableDoor:t=>t==='door',
  poiMonsterPose:()=>({x:11.38,z:10.5}),terrainY:()=>0,document:{hidden:false,querySelector:()=>null},
  poiWalkAvatar(){},poiSound(){},poiDamageNumber(){},poiEquippedWeapon:()=>weapon.held,poiEquipmentSpendWeapon:w=>(calls.push(w),true),
  poiMonsterMeshDirty:false,pineGameActive:false,pineAIActive:false,performance:{now:()=>1000}};
 const js=cut('const POI_SWORD_POSES=','// END PLAYER WEAPON PROFILES');
 const api=vm.runInNewContext(js+';({begin:poiPlayerStartProfile,frame:poiPlayerWeaponFrame,profile:poiPlayerWeaponProfile,pose:poiPlayerProfilePose,pending:()=>poiPlayerWeaponPending,visual:()=>poiPlayerWeaponVisual})',c);
 function move(){
  c.poiWalkX=13;c.poiWalkZ=9;c.poiWalkFacing=0;c.poiFreePose={x:13.2,z:9.25,angle:Math.PI,level:0,walking:true};
 }
 return {weapon,o,s,c,api,move,calls};
}
test('moving across cells and rotating the thumb does not cancel mace pose or committed original hit from live body',()=>{
 const {api,s,c,move,calls}=play('equipStoneMace');
 const p=api.profile('equipStoneMace');a.deepEqual([p.range,p.damage,p.hit,p.ready,p.pose],[1,32,380,760,620]);
 a(api.begin('equipStoneMace',1000));a.equal(c.poiAttackReady,1760);
 const shot=api.pending();a(Math.abs(shot.dx-1)<1e-6);
 move();c.poiFreePose.x=10.4;c.poiFreePose.z=10;api.frame(1110);
 a.equal(c.poiWalkActionStarted,1000,'pose continues on the genuine action clock');
 a.equal(api.pending(),shot,'queued hit stays committed to its initial bearing at new origin');
 a(api.pose('equipStoneMace',1110-c.poiWalkActionStarted).strike>0);
 api.frame(1379);a.equal(s.hp,100);a.equal(calls.length,0);
 api.frame(1380);a.equal(s.hp,68);a.equal(calls.length,1);a.equal(api.pending(),null);
 a(api.pose('equipStoneMace',1400-c.poiWalkActionStarted),'normal recovery pose also remains');
 api.frame(1450);a.equal(s.hp,68);a.equal(calls.length,1);
});
test('bow and mace still cancel when changing gear or floor',()=>{
 for(const type of ['equipWoodBow','equipStoneMace']){
  const h=play(type);
  a(h.api.begin(type,1000));h.move();
  h.weapon.held='equipWoodSword';
  h.api.frame(1100);
  a.equal(h.api.pending(),null);
  a.equal(h.api.visual(),null);
  a.equal(h.s.hp,100);
 }
 const h=play('equipStoneMace');h.api.begin('equipStoneMace',1000);h.c.poiWalkLevel=1;h.api.frame(1100);
 a.equal(h.api.pending(),null);a.equal(h.s.hp,100);
});

