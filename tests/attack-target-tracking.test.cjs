const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,a);return h.slice(i,j)};
function fixture(){
 const obj={type:'monsterSlime',x:3,z:0,y:0},s={hp:100,x:3,z:0},alt={type:'monsterGoblin',x:4,z:2,y:0},sa={hp:100,x:4,z:2};
 const c={world:[],facilitySite:{},poiAimAttack:null,poiMonsterStates:new Map([[obj,s],[alt,sa]]),obj,s,alt,sa,
  weapon:()=>({profile:{range:8},type:'equipWoodBow',started:0,y:0}),pose:{x:0,z:0,y:0,dir:{x:1,z:0}},poiWalkLevel:0,
  poiAimOrigin:()=>c.pose,poiCombatLockUpdate:()=>c.lock,poiMonsterPose:(_o,s)=>({x:s.x+.5,z:s.z+.5,y:0}),
  poiAimTargetList:()=>[...c.poiMonsterStates].filter(([o,s])=>s.hp>0&&o.y===c.pose.y).map(([id,state])=>({id,state,x:state.x,z:state.z,y:0})),
  poiAimWall:()=>((x,z)=>!c.wall||x<=0),poiPlayerFlightMs:(_p,n)=>n,poiSound(){},poiPlayerWeaponVisual:null,poiPlayerWeaponPending:null};
 c.lock={id:obj,state:s,x:s.x,z:s.z};
 const tail=cut('function poiAimNewShot(', '// BEGIN OVERSIZED MELEE BODY');
 const addition=h.includes('// BEGIN COMMITTED ATTACK TRACKING')?cut('// BEGIN COMMITTED ATTACK TRACKING','// END COMMITTED ATTACK TRACKING'):'';
 vm.createContext(c);vm.runInContext(cut('const POI_AIM_EPS=', 'function poiAimChooseLock')+tail+addition+cut('function poiAimTrace(', 'function poiAimFlightFrame('),c);
 return {c,r:x=>vm.runInContext(x,c)};
}
test('accepted identity follows live moving target and strafing origin, never passes through an alternate body',()=>{
 const {c,r}=fixture();
 r("a=poiAimNewShot({...weapon(),type:'kitchenKnife'},0)");
 c.pose={x:2,z:2,y:0,dir:{x:-1,z:0}};c.s.x=2;c.s.z=2.84;c.sa.x=2;c.sa.z=2.42;
 c.lock={id:c.alt,state:c.sa,x:c.sa.x,z:c.sa.z};
 let j=r('contact=poiAimTrack(a,100); poiAimTrace(contact,1,100)');assert.equal(j.monster,null);
 assert.equal(r('contact.dz'),1);
 c.sa.x=2.7;
 j=r('poiAimTrace(poiAimTrack(a,110),1,110)');assert.equal(j.monster[0],c.obj);
 c.wall=true;assert.equal(r('poiAimTrace(poiAimTrack(a,120),1,120).monster'),null);
});
test('lost target never reacquires a closer alternate; no-lock attack uses original yaw from live origin',()=>{
 const {c,r}=fixture();
 r('a=poiAimNewShot(weapon(),0)');c.s.hp=0;c.sa.x=1;c.sa.z=0;
 assert.equal(r('poiAimTrace(poiAimTrack(a,200),8,200).monster'),null);
 c.s.hp=100;assert(r('poiAimTrack(a,210).lockedMiss'));
 c.lock=null;r('b=poiAimNewShot(weapon(),220)');
 c.pose={x:.2,z:0,y:0,dir:{x:0,z:1}};
 assert.equal(r('poiAimTrace(poiAimTrack(b,230),8,230).monster[0]'),c.alt);
});
test('bow follows to actual release and immediately seals fixed direction',()=>{
 const {c,r}=fixture();
 r('a=poiAimNewShot(weapon(),0)');c.s.x=4;c.s.z=4;
 r('poiAimFlightBegin(a,325)');
 const a=r('poiPlayerWeaponPending');assert(Math.abs(a.dz-Math.SQRT1_2)<1e-6);
 c.s.x=1;c.s.z=-1;
 assert.equal(r('poiAimTrack(poiPlayerWeaponPending,330).dz'),a.dz);
});
