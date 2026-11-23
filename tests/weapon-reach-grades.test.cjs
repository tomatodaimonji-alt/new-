const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(f,g){const x=h.indexOf(f),y=h.indexOf(g,x+1);a(x>=0&&y>x,f);return h.slice(x,y)}
function rt(){
 const hits=[],wear=[],targets=[];
 const c={POI_PLAYER_ATTACK:16,POI_HOTBAR_SWORD_BONUS:12,POI_KNIFE_BONUS:12,performance:{now:()=>0},
  poiAimWall:()=>c.wall,wall:()=>true,poiAimTargetList:(o,r)=>targets.filter(q=>Math.hypot(q.x-o.x,q.z-o.z)<=r+1e-7),
  poiEquipmentSpendWeapon:(id)=>{wear.push(id);return true},poiSound(){},
  poiPlayerDamageTarget:(pair,x,z,damage,type,now,silent=false,atContact=false)=>hits.push({id:pair[0],damage,type,atContact})};
 const api=vm.runInNewContext(cut('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  cut('const POI_COMBAT_TORSO_HEIGHT=','function poiAimRenderMarker(')+cut('function poiAimTrace(','function poiAimFlightBegin(')+cut('// BEGIN PLAYER WEAPON PROFILES','function poiPlayerWeaponCancel(')+
  cut('function poiPlayerWeaponResolve(','function poiPlayerStartProfile(')+
  ';({trace:poiAimTrace,profile:poiPlayerWeaponProfile,grades:poiPlayerWeaponGrades,sword:poiSwordResolve,contact:poiPlayerWeaponResolve})',c);
 const shot=(type,dx=1,dz=0)=>({type,profile:api.profile(type),aim:{x:0,z:0,y:0},dx,dz});
 const put=(x,z)=>targets.push({x,z,y:0,id:targets.length+1,state:{hp:100}});
 return {api,shot,put,hits,wear,c};
}
const grades=p=>[p.speed,p.reach];
test('knife keeps precise close baseline with distinct faster timing and canonical editable pair',()=>{
 const {api,shot,put,hits}=rt(),knife=api.profile('kitchenKnife'),wood=api.profile('equipWoodSword');
 a.equal(knife.range,1);a(knife.ready>=220&&knife.ready<=230&&knife.ready<wood.ready);
 a(knife.hit>0&&knife.hit<wood.hit&&knife.pose<wood.pose);
 a.deepEqual(grades(api.grades('kitchenKnife')),[4,1]);
 a.deepEqual(grades(api.grades('equipWoodSword')),[3,2]);
 a.deepEqual(grades(api.grades('equipWoodSpear')),[2,3]);
 put(1.001,0);a.equal(api.trace(shot('kitchenKnife'),1,0).monster,null);
 put(1,0);const l=api.trace(shot('kitchenKnife'),1,0);a(l.monster);
 api.contact(shot('kitchenKnife'),0,l);a.equal(hits[0].damage,28);a.equal(hits[0].atContact,true,'knife sound is not scheduled a second time after contact');
});
test('all sword variants use identical timing and sweep width with independent forward reach',()=>{
 for(const [id,bound] of [['equipWoodSword',1.3],['equipBoneSword',1.55],['equipIronSword',2]]){
  const {api,shot,put,hits,wear,c}=rt(),s=shot(id);
  a.equal(s.profile.range,bound);a.equal(s.profile.hit,108);a.equal(s.profile.ready,350);
  a.deepEqual(grades(api.grades(id)),[3,2]);
  put(bound,1.5);put(bound+.01,0);put(bound-.1,1.51);put(-.1,0);put(bound*.8,-.6);
  c.wall=(_,z)=>z>=0;
  api.sword(s,0);
  a.deepEqual(hits.map(x=>x.id),[1]);a.deepEqual(wear,[id]);
 }
});
test('spear hits straight through true 3 only, with 24 at the final .75 forward and 18 otherwise',()=>{
 const {api,shot,put,hits,c}=rt(),weapon='equipWoodSpear',s=shot(weapon,.8,.6);
 a.equal(s.profile.range,3);a.equal(s.profile.hit,240);a.equal(s.profile.ready,540);
 put(2.24*.8,2.24*.6);
 put(2.6*.8,2.6*.6);
 const first=api.trace(s,s.profile.range,0);
 a(Math.abs(first.forward-2.24)<1e-6);
 api.contact(s,0,first);a.equal(hits.at(-1).damage,18);
 // Actual intersecting circle with its center slightly to one side:
 // radial distance enters the tip band but forward projection does not.
 const off=rt(),angled=off.shot(weapon,.8,.6);
 off.put(.8*2.24-.6*.30,.6*2.24+.8*.30);
 const offLine=off.api.trace(angled,3,0);
 a(offLine.monster&&offLine.distance>2.25&&offLine.forward<2.25);
 off.api.contact(angled,0,offLine);a.equal(off.hits.at(-1).damage,18);
 const fake={monster:[99,{}],x:2,z:2,distance:2.26,forward:2.24};
 api.contact(s,0,fake);a.equal(hits.at(-1).damage,18);
 api.contact(s,0,{...fake,forward:2.25});a.equal(hits.at(-1).damage,24);
 api.contact({...s,aim:undefined},0,{...fake,distance:3,forward:undefined});a.equal(hits.at(-1).damage,24);
 c.wall=()=>false;a.equal(api.trace(s,3,0).monster,null);
});
test('spear retains an exact center target at 3 tiles but not farther',()=>{
 for(const t of [3,3.001]){
  const {api,shot,put}=rt();put(t,0);
  a.equal(!!api.trace(shot('equipWoodSpear'),3,0).monster,t===3);
 }
});
