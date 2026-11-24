const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('shared directed edge and coordinates round-trip; no non-adjacent, disconnected or cold seam handoff',()=>{
 const i=h.indexOf('// BEGIN COMPANION SEAM WALK'),j=h.indexOf('// END COMPANION SEAM WALK');
 a(i>0&&j>i);
 const c=vm.createContext({poiOverlandGlobal:(id,x,z)=>id==='base'?[x,z]:[x+48,z+139],
  poiOverlandLocal:(id,x,z)=>id==='base'?[x,z]:[x-48,z-139],
  poiSnowPassLink:(id,x,z,y,nx,nz)=>id==='base'&&x===60&&z===138&&nx===60&&nz===139?{region:'snowpass',x:12,z:0,y:0}:id==='snowpass'&&x===12&&z===0&&nx===12&&nz===-1?{region:'base',x:60,z:138,y:0}:null});
 vm.runInContext(h.slice(i,j),c);
 const plain=v=>JSON.parse(JSON.stringify(v));
 a.deepEqual(plain(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:0,facing:2})),{x:60,z:138,nx:60,nz:139});
 a.deepEqual(plain(c.poiCompanionSeamEdge('snowpass',{region:'base',x:60,z:138,facing:0})),{x:12,z:0,nx:12,nz:-1});
 a.equal(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:0,facing:1}),null);
 a.equal(c.poiCompanionSeamEdge('base',{region:'snowpass',x:12,z:2,facing:2}),null);
});
function rig(id,extras=[]){
 const begin=h.indexOf('// BEGIN COMPANION SEAM WALK'),end=h.indexOf('// END COMPANION SEAM WALK');
 const start=h.indexOf('// BEGIN FREE MOVEMENT SOLVER'),stop=h.indexOf('// END FREE MOVEMENT SOLVER');
 const base={id:'base'},snow={id:'snowpass'},a={site:base,travel:0,id,x:60,z:135,px:60,pz:135,y:0};
 const v=vm.createContext({a,base,snow,poiCompanionActor:a,facilitySite:base,travel:0,poiWalkLevel:0,poiWalkX:60,poiWalkZ:138,
  TERRAIN_STEP:1,MAP_W:128,MAP_H:182,POI_COMPANION_FREE_RADIUS:.2,world:extras,terrainHeights:new Map(),poiMonsterStates:new Map(),
  facilityCreekIndex:null,poiCompanionAllowed:()=>true,poiCompanionSame:(a,b)=>a.site===b.site&&a.travel===b.travel,
  poiCompanionPlace:()=>({site:v.facilitySite,travel:v.travel,y:0}),poiCompanionMeshKey:null,poiCompanionPosition:a=>({x:a.px,z:a.pz}),
  poiOverlandGlobal:(id,x,z)=>id==='base'?[x,z]:[x+48,z+139],poiOverlandLocal:(id,x,z)=>id==='base'?[x,z]:[x-48,z-139],
  poiSnowPassLink:(id,x,z,y,nx,nz)=>id==='base'&&x===60&&z===138&&nx===60&&nz===139?{region:'snowpass',x:12,z:0,y:0}:id==='snowpass'&&x===12&&z===0&&nx===12&&nz===-1?{region:'base',x:60,z:138,y:0}:null,
  poiSnowSleeveOwn:(x,z)=>x>=48&&x<64&&z<139,poiWalkCanStep:()=>true,poiCompanionSpeed:a=>a.id==='orvasSoul'?1/235:1/380,
  isFloor:t=>t==='grass',isWallId:t=>t==='wall',poiIsMonster:()=>false,poiWalkPassableDoor:()=>false,
  poiOverlandRealNeighbor:()=>true,terrainY:()=>0,staircaseRotation:()=>0,POI_COMPANION_FOLLOW_STOP:2,
  poiCompanionPlayerPoint:()=>({x:v.poiWalkX,z:v.poiWalkZ}),
  poiCompanionFollowWanted:(a,d)=>{if(d>=4)a.followLeader=true;else if(d<=2.00001)a.followLeader=false;return a.followLeader===true}});
 vm.runInContext(h.slice(start,stop)+h.slice(begin,end),v);
 const tick=(t,blocked)=>v.poiCompanionSeamFrame(t,blocked);
 const cross=()=>{
  const x=v.poiCompanionSeamCapture({region:'snowpass',x:12,z:0,facing:2},0,false);
  assertTruthy(x);v.facilitySite=snow;v.travel=1;v.poiWalkX=12;v.poiWalkZ=0;v.poiCompanionSeamCommit(x,0);
 };
 function assertTruthy(x){if(!x)throw new Error('no actual token for a recognized directed seam')}
 return{v,a,base,snow,tick,cross};
}
test('actual swept feet stay old while hero blocks real entry, then travel at each stock species rate around old wall',()=>{
 for(const [id,rate] of [['orvasSoul',1/235],['slimeSoul',1/380]]){
  const {v,a,base,snow,tick,cross}=rig(id,[{x:60,z:136,y:0,type:'wall'}]);
  assertCold();
  function assertCold(){if(v.poiCompanionSeamCapture({region:'snowpass',x:12,z:0,facing:2},0,true)!==null)throw Error('cold load kept old transient actor')}
  cross();
  let now=0,steps=0,detour=false;
  for(let i=0;i<70;i++){
   const [x,z]=[a.px,a.pz];now+=50;tick(now);
   const d=Math.hypot(a.px-x,a.pz-z);
   if(d>.01){steps++;if(Math.abs(a.px-60)>.5)detour=true}
   if(a.site!==base)throw Error('crossed into hero before actual open tile');
   if(d>50*rate+1e-7)throw Error('old side movement exceeded native speed');
  }
  if(steps<10||!detour||a.pz>=138.5)throw Error('no legal actual detour and bounded blocked stop');
  const view=v.poiCompanionSeamRender(a,{x:a.px+.5,z:a.pz+.5,y:0});
  if(Math.abs(view.z-(a.pz+.5-139))>1e-6)throw Error('pose does not project existing global feet');
  v.poiWalkZ=3;
  for(let i=0;i<40&&a.site!==snow;i++){now+=50;tick(now);}
  if(a.site!==snow||a!==v.poiCompanionActor||a.pz<-.5||a.pz>=0)throw Error('same actor never continuously crossed actual edge');
 }
});
test('reverse hero crossing before ally arrives rejoins the same untransposed body and clears stale cross intent',()=>{
 const {v,a,base,tick,cross}=rig('orvasSoul');cross();tick(50);
 const x=a.px,z=a.pz;
 const keep=v.poiCompanionSeamCapture({region:'base',x:60,z:138,facing:0},70,false);
 v.facilitySite=base;v.travel=2;v.poiCompanionSeamCommit(keep,70);
 if(tick(90)!==false||v.poiCompanionActor!==a||a.px!==x||a.pz!==z||a.travel!==2)throw Error('hero U-turn teleported or lost old follower');
});
