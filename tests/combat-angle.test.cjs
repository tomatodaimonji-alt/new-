const {test}=require('node:test'),a=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const math=()=>vm.runInNewContext(html.slice(html.indexOf('// BEGIN ANGULAR COMBAT MATH'),html.indexOf('// END ANGULAR COMBAT MATH'))+
 ';({unit:poiAimUnit,circleEntry:poiAimCircleEntry,wallLimit:poiAimWallLimit,chooseLock:poiAimChooseLock,movingImpact:poiAimMovingImpact})');
test('arbitrary direction hits real circle at weapon world range',()=>{
 const m=math(),d=m.unit(2,1);
 a(Math.abs(d.z/d.x-.5)<1e-9);
 a.equal(m.circleEntry({x:0,z:0},d,{x:2,z:1},.3,2),null);
 a(Math.abs(m.circleEntry({x:0,z:0},d,{x:2,z:1},.3,3)-(Math.sqrt(5)-.3))<1e-8);
});
test('supercover never leaks through blocked flank or directed diagonal entry',()=>{
 const m=math(),o={x:0,z:0},d=m.unit(1,1);
 for(const can of [(x,z)=>x!==1||z!==0,(x,z,fx,fz)=>!(x===1&&z===1&&fx===0&&fz===1)])
  a(Math.abs(m.wallLimit(o,d,3,can)-Math.SQRT1_2)<1e-8);
 a.equal(m.wallLimit(o,d,3,()=>true),3);
});
test('lock uses strict range and LOS; nearest legitimate target wins',()=>{
 const m=math(),o={x:0,z:0},arr=[{id:'far',x:2,z:1},{id:'wall',x:1,z:0},{id:'valid',x:0,z:1.2}];
 a.equal(m.chooseLock(o,arr,1.5,d=>d.x>0?.5:1.5,null)?.id,'valid');
 a.equal(m.chooseLock(o,arr,1,d=>d.x>0?.5:1,null),null);
});
test('lock retains previous eligible target only for an exact tie',()=>{
 const m=math(),o={x:0,z:0},arr=[{id:'keep',x:0,z:1.2},{id:'best',x:1,z:0}];
 a.equal(m.chooseLock(o,arr,2,()=>2,'keep')?.id,'best');
 arr[0].z=1;
 a.equal(m.chooseLock(o,arr,2,()=>2,'keep')?.id,'keep');
 a.equal(m.chooseLock(o,arr,2,d=>d.z>.5?.7:2,'keep')?.id,'best');
});
test('moving targets are intercepted continuously and release does not home',()=>{
 const m=math();
 a(Math.abs(m.movingImpact({x:0,z:0},{x:2,z:0},{x:1,z:1},{x:1,z:-1},.2)-(.5-.2/Math.sqrt(8)))<1e-8);
 a.equal(m.movingImpact({x:0,z:0},{x:2,z:0},{x:1,z:1},{x:1,z:2},.2),null);
});

test('arming is transient and dropping/replacing the exact slot disarms safely',()=>{
 const start=html.indexOf('let poiArmedWand=null;'),end=html.indexOf('function poiInventorySpendFireWand',start);
 const c={POI_HOTBAR_SIZE:5,POI_BAG_SAVED:10,POI_FIRE_WAND:'fireWand',poiStorageIndexExists:()=>true,
  poiHotbarHasKit:()=>true,poiInventoryAllowed:()=>true,poiHotbarRead:()=>c.kit,poiInventorySlots:k=>k.slots,
  poiBagSetOpen:()=>{},poiShopSync:()=>{},poiWalkAvatar:()=>{},
  poiStorageActionResult:reason=>({ok:!reason,reason}),kit:{weapon:'equipWoodSword',slots:[{type:'fireWand',charges:2}]}};
 const m=vm.runInNewContext(html.slice(start,end)+';({arm:poiWandArm,index:poiArmedWandIndex})',c);
 const expected=JSON.stringify(c.kit);a.equal(m.arm(0).ok,true);
 a.equal(m.index(),0);a.equal(JSON.stringify(c.kit),expected);
 c.kit.slots[0]={type:'fireWand',charges:2};a.equal(m.index(),null);
});
function runFlight({range=3,before,after,blocked=()=>true,speed=1,now=2,limit=range,at=0,sampleAt=0}){
 const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
 const id={y:0},state={hp:100},make=p=>({id,state,...p});
 const ctx={poiAimWall:()=>blocked,poiAimTargetList:()=>[make(after)],poiPlayerWeaponImpactAngular:(s,t,p,n,c)=>ctx.hit={p,n,c}};
 const frame=vm.runInNewContext(take('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+take('function poiAimFlightFrame','function poiPlayerWeaponImpactAngular')+';poiAimFlightFrame',ctx);
 frame({aim:{x:0,z:0,y:0},started:0,sampleAt,at,dx:1,dz:0,limit,profile:{range,cellMs:speed,minFlight:0},targets:new Map([[id,make(before)]])},now);
 return ctx.hit??null;
}
test('shot validates range and reports target at swept contact rather than the later rendered position',()=>{
 const r=runFlight({range:2,before:{x:1,z:0},after:{x:2.2,z:0},limit:2,now:2});
 a(r?.c,'a target leaving range after contact was struck');
 a(Math.abs(r.c.x-1.99)<.001);
 const no=runFlight({range:2,before:{x:2.1,z:0},after:{x:1.99,z:0},limit:2,now:2});
 a.equal(no?.c??null,null,'target only enters weapon range after first contact');
});
test('swept LOS follows the target on the impact side of the wall',()=>{
 const blocked=(x,z)=>x!==1||z!==1;
 const r=runFlight({before:{x:1.3,z:-.25},after:{x:1.3,z:.65},blocked});
 a(r?.c,'target crosses into side-wall after projectile contact');
 a(r.c.z<.5);
 const no=runFlight({before:{x:1.3,z:-.9},after:{x:1.3,z:.65},blocked:(x,z)=>x!==1||z!==0});
 a.equal(no?.c??null,null,'projectile itself cannot cross a wall');
});
test('a candidate on another editor floor is excluded even without a facility site',()=>{
 const start=html.indexOf('function poiAimTargetList'),end=html.indexOf('function poiAimWall',start);
 const good={x:1,z:0,y:0},bad={x:1,z:0,y:1};
 const list=vm.runInNewContext(html.slice(start,end)+';poiAimTargetList',
  {poiMonsterStates:new Map([[bad,{hp:10,x:1,z:0}],[good,{hp:10,x:1,z:0}]]),facilitySite:null,poiMonsterPose:()=>({x:1.5,z:.5,y:0})});
 const result=list({x:0,z:0,y:0},3,0);
 a.equal(result.length,1);a.equal(result[0].id,good);
});
test('the contact origin follows analog precision or the current keyboard interpolation',()=>{
 const start=html.indexOf('function poiAimOrigin'),end=html.indexOf('function poiAimTargetList',start);
 a(start>=0&&end>start);
 const c={poiWalkX:4,poiWalkFromX:3,poiWalkZ:5,poiWalkFromZ:5,poiWalkLevel:0,poiWalkFacing:1,
  poiWalkStarted:100,poiWalkStepMs:200,poiAimUnit:(x,z)=>({x,z}),poiFreePose:null};
 const at=vm.runInNewContext(html.slice(start,end)+';poiAimOrigin',c);
 a.equal(at(150).x,3.25,'read current keyboard interpolation rather than next destination');
 a.equal(at(300).x,4);
 c.poiFreePose={x:3.88,z:5.2,angle:0,level:0};
 a.equal(at(150).x,3.88);a.equal(at(150).z,5.2);a.equal(at(150).analog,true);
 c.poiFreePose.level=-1;
 a.equal(at(150).x,3.25,'discard analog pose on a different floor');
});

test('a door closing behind the projectile does not undo traveled distance',()=>{
 const r=runFlight({before:{x:2.2,z:0},after:{x:2.2,z:0},at:1.5,sampleAt:1.5,now:2,
  blocked:(x,z)=>x!==1||z!==0});
 a(r?.c);a(Math.abs(r.c.x-2.2)<.01);
});
test('hidden off-axis body cannot suppress lock on a visible enemy',()=>{
 const m=math(),v={id:'visible',x:2,z:0},h={id:'hidden',x:1,z:.28};
 a.equal(m.chooseLock({x:0,z:0},[h,v],3,(d,n)=>d.z>.1?.3:n,null)?.id,'visible');
});
test('decorative enemy attack recoil does not push an adjacent locomotion body outside true melee reach',()=>{
 const take=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b));
 const id={x:1,z:0,y:-1,type:'monsterSkelWarrior'},enemy={hp:70,x:1,z:0,fromX:1,fromZ:0,moveStarted:-1000};
 const c={poiPlayerRayClear:()=>true,poiMonsterStates:new Map([[id,enemy]]),poiEnemyVisualAttack:()=>({dx:.11,dz:0,lift:0}),terrainY:()=>0,facilitySite:null,
  poiMonsterActorPoint:()=>({x:.85,z:.24,t:.5})};
 const targets=vm.runInNewContext(take('function poiMonsterPose','function poiMonsterFragmentTemplate')+
  take('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+
  take('function poiAimTargetList','function poiCombatLockUpdate')+
  take('function poiAimTrace','function poiAimFlightBegin')+';({targets:poiAimTargetList,pose:poiMonsterPose,trace:poiAimTrace})',c);
 a.equal(targets.pose(id,enemy,0).x,1.61,'render retains sword wind-up recoil');
 const [body]=targets.targets({x:0,z:0,y:-1},1,0);
 a(Math.abs(body.x-1)<1e-9,'ordinary adjacent range follows the actual body, not the cosmetic sway');
 const swing={aim:{x:0,z:0,y:-1},dx:1,dz:0};
 a.equal(targets.trace(swing,1,0).monster[0],id,'an exact one-tile narrow trace still hits');
 a.equal(targets.trace(swing,.99,0).monster,null,'no bonus reach');
 c.poiPlayerRayClear=()=>false;
 a.equal(targets.trace(swing,1,0).monster,null,'same-range body behind a blocking wall cannot be hit');
 enemy.actorFree={};const [moving]=targets.targets({x:0,z:0,y:-1},1,0);
 a(Math.abs(moving.x-.85)<1e-9&&Math.abs(moving.z-.24)<1e-9,'continuous underlying movement is still sampled');
});

