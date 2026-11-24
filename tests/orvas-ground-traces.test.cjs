const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const source=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const begin='// BEGIN ORVAS TRANSIENT GROUND TRACES',end='// END ORVAS TRANSIENT GROUND TRACES';
const q={sx:0,sz:0,dx:1,dz:0,y:0,start:0,kind:'beam',executed:1};
function setup(){
 const grounds=new Map();
 for(let z=-14;z<=14;z++)for(let x=-14;x<=14;x++)grounds.set(x+','+z,'roadAncientFull');
 grounds.delete('2,0');
 const boss={},scene={davidTemple:{boss}};
 const c=vm.createContext({facilitySite:scene,poiWalkActive:true,poiWalkLevel:0,world:[],
  poiDavidIn:(b,p)=>p.y===0&&p.x<5.2&&p.z>-10&&p.z<10,
  poiAimWall:()=>()=>true,poiAimWallLimit:(o,d,n)=>d.x>0?Math.min(n,(5.2-o.x)/d.x):n,poiDavidBeamReach:(q,b,r)=>r.x>0?Math.min(14,5.2/r.x):14,
  poiDavidBeamRay:(q,t)=>({x:Math.cos(t),z:Math.sin(t)}),
  POI_DAVID_PATTERNS:{double:{hits:[720,1040]}},poiOrvasTwinPose:t=>({t}),poiPlayerWeaponHands:()=>({}),
  poiOrvasTwinBladeBasis:(arms,pose,i)=>({tip:[i?.38:-.38,.114,1.95]}),poiCreekPlayerHeight:()=>0,
  poiDavidFractureFloors:()=>grounds,poiDavidFractureRoadHeight:()=>.13,terrainY:()=>0,
  mesh:()=>({p:[],c:[],n:[]}),tri:(m,a,b,c,k)=>{m.p.push(...a,...b,...c);m.c.push(...k,...k,...k)},
  quad:(m,a,b,c,d,k)=>{for(const p of [a,b,c,a,c,d]){m.p.push(...p);m.c.push(...k)}}
 });
 assert.ok(source.includes(begin),'transient trace renderer not present');
 vm.runInContext(source.slice(source.indexOf('function poiOrvasDualTube('),source.indexOf('function poiDavidBeamReduced('))+source.slice(source.indexOf(begin),source.indexOf(end)),c);
 return c;
}
test('boss straight and swept burns mark only actual endpoints, never the intervening route',()=>{
 const c=setup(),make=(...a)=>c.poiOrvasBeamTrace(...a),shot={...q},boss={};
 assert.equal(make({...q,executed:0},boss,100),false);
 assert(make(shot,boss,100));
 const e=shot.orvasBeamGround,initial=e.parts.length;
 assert(initial>=1&&initial<=2);
 assert([...e.cells].every(k=>k.startsWith('floor:')));
 for(const part of e.parts)for(let j=0;j<part.p.length;j+=3){
  assert(part.p[j]>4.75&&part.p[j]<5.7,'no middle-route geometry: only the clipped tip');
  assert(part.p[j+1]>=.1439&&part.p[j+1]<=.1481,'no aerial beam decal');
 }
 for(let i=1;i<20;i++)make(shot,boss,101+i,i*.05);
 assert(e.parts.length>initial);assert(e.parts.length<=24);assert.equal(e.parts.length,e.cells.size);
});
test('two overhead contacts produce distinct blade-ground centers without changing planted stomp',()=>{
 const c=setup(),shot={...q,kind:'double',executed:2};
 const a=c.poiOrvasBladeTrace(shot,{},0,720),b=c.poiOrvasBladeTrace(shot,{},1,1040);
 assert(a&&b);assert.equal(a.start,720);assert.equal(b.start,1040);
 assert(Math.hypot(a.x-b.x,a.z-b.z)>1.2);
 for(const e of [a,b])for(const part of e.parts)for(let i=0;i<part.p.length;i+=3)
  assert(Math.hypot(part.p[i]-.5-e.x,part.p[i+2]-.5-e.z)<1.33);
 assert.equal(c.poiOrvasBladeTrace(shot,{},1,1090),false);
 assert.match(source,/if\(q.kind==='stomp'&&typeof poiDavidImpactStomp==='function'\)poiDavidImpactStomp\(q,now\);/);
});
test('player head optically continues beyond the first target but respects its lane wall; sword, twin and wear-independent trace constraints',()=>{
 const c=setup(),o={x:0,z:0,y:0},ray={x:.4,z:0,end:0};
 if(typeof c.poiOrvasPlayerGroundImpact==='function'){
  const ready={...ray,x:-9.35,end:8,h:1.8},d={x:1,z:0};
  const blockedNear={...ready,visualLimit:.7};
  assert.equal(c.poiOrvasPlayerGroundImpact({...o,x:-10},[blockedNear],d,0),false,'close solid wall leaves no real landing floor');
  assert.equal(blockedNear.groundDrop,undefined);
  const stoppedCenter={...ready,visualLimit:8};
  assert(c.poiOrvasPlayerGroundImpact({...o,x:-10},[stoppedCenter],d,1,undefined,7),'visible contact may occur before, never after, the actual center wall');
  assert(stoppedCenter.groundDrop.at<7);
  vm.runInContext('poiOrvasGroundTraces.length=0',c);
  const verified={...ready,end:2,visualLimit:8};
  assert(c.poiOrvasPlayerGroundImpact({...o,x:-10},[verified],d,100));
  assert(verified.groundDrop?.at>=7.75&&verified.groundDrop.at<8&&verified.groundDrop.at>verified.end+2);
  assert(verified.visualEnd<verified.groundDrop.at-.95);
  const terminal={p:[],c:[],n:[]};c.poiOrvasPlayerTraceTerminalMesh(terminal,{rays:[verified],d});
  assert(terminal.p.length>36);
  const low=Math.min(...terminal.p.filter((_,i)=>i%3===1));
  const high=Math.max(...terminal.p.filter((_,i)=>i%3===1));
  assert(low<.16&&high>1.8);
 }else{
  assert.equal(c.poiOrvasPlayerBeamTrace(o,[ray],{x:1,z:0},0),false);
  assert(c.poiOrvasPlayerBeamTrace(o,[{...ray,end:1.86}],{x:1,z:0},100));
  const first=vm.runInContext('poiOrvasGroundTraces[0]',c);
  for(const m of first.parts)for(let i=0;i<m.p.length;i+=3)assert(m.p[i]-.5<2.21);
 }
 const get=()=>vm.runInContext('poiOrvasGroundTraces',c);
 const e=get()[0];assert.equal(e.kind,'beam');assert(e.player&&e.cells.size>=1&&e.cells.size<4);assert(!e.cells.has('2,0'));
 assert(c.poiOrvasPlayerCutTrace({...q,sx:-2,kind:'sweep'},{range:5.25},150,0));
 assert(c.poiOrvasPlayerCutTrace({...q,sx:-2,kind:'double'},{range:3.55},200,0));
 assert(c.poiOrvasPlayerCutTrace({...q,sx:-2,kind:'double'},{range:3.55},520,1));
 const [,arc,a,b]=get();assert.equal(arc.kind,'sweep');assert(a.z!==b.z);assert.equal(b.start-a.start,320);
 for(const t of [a,b])for(const m of t.parts)for(let i=0;i<m.p.length;i+=3)
  assert(Math.hypot(m.p[i]-.5-t.x,m.p[i+2]-.5-t.z)<.75);
});
