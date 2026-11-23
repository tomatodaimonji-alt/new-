const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function math(){
 const token='// BEGIN ACTOR FREE MOVEMENT',end=h.indexOf('// END ACTOR FREE MOVEMENT');
 const start=h.indexOf(token);
 assert(start>=0&&end>start,'actual shared actor movement math is present');
 const s=h.indexOf('// BEGIN FREE MOVEMENT SOLVER'),e=h.indexOf('// END FREE MOVEMENT SOLVER');
 return vm.runInNewContext(h.slice(s,e)+'\n'+h.slice(start,end)+';({advance:poiActorAdvance,segment:poiActorPickSegment,frameDt:poiActorFrameDt,grade:poiActorSameGrade,gait:poiActorGait})');
}
const open=()=>true;
test('actual monster position moves both x and z at an arbitrary angle towards its target',()=>{
 const {advance}=math(),start={x:0,z:0},target={x:2,z:1};
 const out=advance(start,target,.2,open,()=>true);
 assert(out.x>0&&out.z>0);
 assert(Math.abs(out.z/out.x-.5)<1e-6);
 assert(Math.abs(Math.hypot(out.x,out.z)-.2)<1e-6);
 assert.deepEqual(start,{x:0,z:0});
});
test('movement clipping cannot enter a blocked doorway corner or reserved center cell',()=>{
 const {advance}=math(),visited=[];
 const canStep=(x,z,fx,fz)=>{
  assert.equal(Math.abs(x-fx)+Math.abs(z-fz),1);
  assert([x,z,fx,fz].every(Number.isInteger));
  return x===0&&z===0||x===1&&z===1;
 };
 const out=advance({x:0,z:0},{x:2,z:2},1.4,canStep,(...d)=>{visited.push(d);return true;});
 assert(Math.abs(out.x)<.31&&Math.abs(out.z)<.31);
 assert.equal(visited.length,0);
});
test('NPC straightened route has a genuine non-axis angle but stops before pinned interactions',()=>{
 const {segment}=math(),start={x:0,z:0,y:0};
 const trail=[{x:1,z:0,y:0},{x:2,z:0,y:0},{x:2,z:1,y:0},{x:3,z:1,y:0}];
 const p=segment(start,trail,(_,i)=>i===3,open);
 assert.deepEqual({...p.target},trail[2]);
 assert.equal(p.used,3);
 const corner=segment(start,trail,()=>false,(x,z)=>x!==1||z!==1);
 assert(corner.used<4);
});

test('free movement pins an elevation change even when the legacy stair edge is legal',()=>{
 const {advance,grade}=math(),height=(x,z)=>x>=1?2:0;
 const seen=[];
 const p=advance({x:0,z:0},{x:2,z:1},1.4,(x,z,fx,fz)=>grade(x,z,fx,fz,height),(...cell)=>{seen.push(cell);return true});
 assert(p.x<.31);
 assert(seen.every(([x])=>x<1));
 assert.equal(grade(0,1,0,0,height),true);
 assert.equal(grade(1,1,0,1,height),false);
});
test('gait follows actual distance for long shortcut legs and alternates continuously',()=>{
 const {gait}=math(),leg={traveled:0,foot:1};
 assert.equal(gait(leg).stride,0);
 leg.traveled=.5;
 assert(Math.abs(gait(leg).stride-.12)<1e-9);
 leg.traveled=1.5;
 assert(Math.abs(gait(leg).stride+.12)<1e-9);
 assert.equal(gait(leg).phase,.5);
 leg.traveled=2;
 assert(Math.abs(gait(leg).stride)<1e-9);
});
test('resuming after a freeze advances only one bounded frame, never a full leg',()=>{
 const {frameDt}=math();
 assert.equal(frameDt(10,12,800),0);
 assert.equal(frameDt(120,100,800),20);
 assert.equal(frameDt(10000,100,800),64);
 assert.equal(frameDt(10000,100,7),7);
});
function monster(){
 const load=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b));
 const active=new Map(),ctx={poiMonsterStates:active};
 const api=vm.runInNewContext(load('// BEGIN FREE MOVEMENT SOLVER','// END ACTOR FREE MOVEMENT')+
   load('// BEGIN MONSTER FREE LEG','// END MONSTER FREE LEG')+`;
 let poiMonsterMeshDirty=false;
 ({start:poiMonsterActorStart,sync:poiMonsterActorSync,point:poiMonsterActorPoint,
   settle:poiMonsterActorSettle,occupied:poiMonsterActorOccupies});
 `,ctx);
 return {api,active};
}
test('hit follows the rendered center while every traversed tile remains reserved until settling',()=>{
 const {api,active}=monster(),o={},s={x:0,z:0,hp:10};active.set(o,s);
 api.start(o,s,100,{x:0,z:0},.8,.6,380,new Set(['0,0','1,0','1,1']));
 for(const [x,z] of [[0,0],[1,0],[1,1]])assert(api.occupied(s.actorFree,101,x,z,true));
 assert(api.occupied(s.actorFree,101,0,0,false));
 assert.equal(api.occupied(s.actorFree,101,1,1,false),false);
 assert(api.occupied(s.actorFree,355,1,0,false));
 api.sync(355);assert.deepEqual([s.x,s.z],[1,0]);
 api.sync(480);assert.deepEqual([s.x,s.z],[1,1]);
 assert(api.occupied(s.actorFree,480,1,1,true));
 assert.equal(api.occupied(s.actorFree,480,0,0,true),false);
});
test('transition from angled motion to legacy attack or fallback starts at rendered point and recenters',()=>{
 const {api,active}=monster(),o={},s={x:0,z:0,hp:10};active.set(o,s);
 api.start(o,s,100,{x:0,z:0},.8,.6,380,new Set(['0,0','1,0','1,1']));
 api.sync(480);
 const before=api.point(s.actorFree,480);
 assert(api.settle(o,s,480));
 assert(s.actorFree.settle);
 const begin=api.point(s.actorFree,480),mid=api.point(s.actorFree,480+s.actorFree.ms/2);
 assert.deepEqual([begin.x,begin.z],[before.x,before.z]);
 assert(mid.x>.8&&mid.x<1&&mid.z>.6&&mid.z<1);
 assert(api.occupied(s.actorFree,480,1,1,false));
 api.sync(800);
 assert.equal(s.actorFree,null);assert.deepEqual([s.x,s.z,s.fromX,s.fromZ],[1,1,1,1]);
});
test('NPC rejects a diverted candidate before committing its tile, then recenters',()=>{
 const p=h.indexOf('function poiTownNpcActorSettle'),q=h.indexOf('function poiTownNpcMove',p);
 const ctx={POI_TOWN_RESIDENT_TICK:380,poiActorFrameDt:(now,last,remaining)=>Math.min(now-last,remaining),
  poiTownNpcVersion:0,poiFreeCell:v=>Math.floor(v+.5),
  poiActorAdvance:(leg,target,d)=>leg.settle?{x:target.x,z:target.z,distance:d}:{x:.7,z:.2,distance:.5}};
 const run=vm.runInNewContext(h.slice(p,q)+';poiTownNpcActorRun;',ctx);
 const npc={x:0,z:0,path:[{}],actorLeg:{x:.25,z:.25,dx:1,dz:1,target:{x:1,z:1},duration:380,length:1.41,last:0,elapsed:50,traveled:.35,foot:1}};
 run(npc,40,{});
 assert.deepEqual([npc.x,npc.z,npc.actorLeg.x,npc.actorLeg.z],[0,0,.25,.25]);
 assert.equal(npc.path,null);assert.equal(npc.actorLeg.settle,true);
 run(npc,250,{});
 assert.equal(npc.actorLeg,null);assert.deepEqual([npc.x,npc.z],[0,0]);
});
test('settling clears an effectively reached endpoint even after a final tiny or zero tick',()=>{
 const p=h.indexOf('function poiTownNpcActorSettle'),q=h.indexOf('function poiTownNpcMove',p);
 const ctx={POI_TOWN_RESIDENT_TICK:380,poiActorFrameDt:(now,last,remaining)=>Math.max(0,Math.min(now-last,remaining)),
  poiTownNpcVersion:0,poiFreeCell:v=>Math.floor(v+.5),
  poiActorAdvance:(leg,target)=>({x:target.x,z:target.z,distance:1e-8})};
 const run=vm.runInNewContext(h.slice(p,q)+';poiTownNpcActorRun;',ctx);
 for(const elapsed of [79.999999,80]){
  const npc={x:0,z:0,actorLeg:{x:1e-8,z:0,dx:-1,dz:0,target:{x:0,z:0},duration:80,length:.1,last:150,elapsed,settle:true}};
  run(npc,180,{});
  assert.equal(npc.actorLeg,null);
  assert.deepEqual([npc.x,npc.z,npc.fromX,npc.fromZ],[0,0,0,0]);
 }
});
