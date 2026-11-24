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
function stage(id){
 const g=play(id),{o,s,c,api}=g;
 const set=(x,z=10)=>{o.x=s.x=x;o.z=s.z=z;c.poiMonsterPose=()=>({x:x+.5,z:z+.5})};
 const move=(x,z=10)=>{c.poiWalkX=Math.round(x);c.poiWalkZ=Math.round(z);c.poiWalkFacing=0;
  c.poiFreePose={x,z,angle:Math.PI,level:0,walking:true}};
 const start=()=>a(api.begin(id,1000));
 const elapsed=api.profile(id).hit;
 return {...g,set,move,start,at:1000+elapsed};
}
test('walk into long-staff, spear, or sword range after starting the swing; one real damage/wear at contact only',()=>{
 for(const [id,damage] of [['equipLongStaff',20],['equipWoodSpear',24],['equipWoodSword',28]]){
  const g=stage(id);g.c.POI_PLAYER_ATTACK=20;g.c.POI_HOTBAR_SWORD_BONUS=8;
  g.set(14);g.start();
  const range=g.api.profile(id).range;
  g.move(14-range+.04);
  g.api.frame(g.at-1);
  a.equal(g.s.hp,100,'even an in-range target cannot take a pre-contact hit');
  g.api.frame(g.at);g.api.frame(g.at+60);
  a.equal(g.s.hp,100-damage,id);
  a.deepEqual(g.calls,[id]);
 }
});
test('stepping away or moving behind a solid wall before contact makes the committed strike miss',()=>{
 for(const blocked of [false,true]){
  const g=stage('equipLongStaff');g.set(11,10);g.start();
  if(blocked){
   g.move(10,11);g.set(12,11);g.c.world.push({x:11,z:11,y:0,type:'wall'});
  }else g.move(8,10);
  g.api.frame(g.at);g.api.frame(g.at+100);
  a.equal(g.s.hp,100);a.deepEqual(g.calls,[]);
 }
});
