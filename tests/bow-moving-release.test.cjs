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
test('moving bow releases from the new grip tile and keeps the captured firing direction',()=>{
 const {api,c,o,s,calls}=play('equipWoodBow');
 const p=api.profile('equipWoodBow');
 a.deepEqual([p.range,p.damage,p.hit,p.ready,p.cellMs],[8,22,325,1030,65]);
 s.hp=0;
 a(api.begin('equipWoodBow',1000));
 s.hp=100;o.x=12;o.z=11;s.x=12;s.z=11;c.poiMonsterPose=()=>({x:12.5,z:11.2});
 c.poiWalkX=11;c.poiWalkZ=11;c.poiWalkFacing=0;
 c.poiFreePose={x:10.85,z:10.7,angle:Math.PI,level:0,walking:true};
 api.frame(1324);
 a.equal(c.poiWalkActionStarted,1000,'bow stays drawn through displacement and turn');
 a.equal(api.pending().phase,undefined);
 api.frame(1325);
 const shot=api.visual();
 a.deepEqual([shot.aim.x,shot.aim.z,shot.dx,shot.dz,shot.started],[10.85,10.7,1,0,1325]);
 a.equal(s.hp,100);a.equal(calls.length,0);
 c.poiFreePose.x=15;c.poiFreePose.z=14;
 api.frame(1450);api.frame(1510);
 a.equal(s.hp,78);a.equal(calls.length,1);
});
test('wall ahead of new live bow origin clips flight without contact or wear',()=>{
 const {api,c,o,s,calls}=play('equipWoodBow');
 a(api.begin('equipWoodBow',1000));
 c.poiFreePose.z=11;c.poiFreePose.x=10.85;c.poiWalkZ=11;
 o.x=14;o.z=11;s.x=14;s.z=11;c.poiMonsterPose=()=>({x:14.5,z:11.5});
 c.world.push({x:12,z:11,y:0,type:'wall'});
 api.frame(1325);a.ok(api.visual()?.limit<1,'the arrow appears at release with a first-wall cap');
 api.frame(1500);
 a.equal(s.hp,100);a.equal(calls.length,0);
});
