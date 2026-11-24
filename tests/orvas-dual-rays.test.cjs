const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const s=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const portion=(a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
function engine(){
 const grounds=new Map();for(let z=-3;z<4;z++)for(let x=-2;x<16;x++)grounds.set(x+','+z,'roadAncientFull');
 const boss={},scene={davidTemple:{boss}};
 const c=vm.createContext({facilitySite:scene,poiWalkActive:true,poiWalkLevel:0,terrainY:()=>0,
  poiDavidFractureFloors:()=>grounds,poiDavidFractureRoadHeight:()=>.13,
  poiAimWall:()=>()=>true,poiAimWallLimit:(o,d,n)=>d.x>0?Math.min(n,(6.50-o.x)/d.x):n,
  poiDavidIn:()=>true,poiDavidRoomRay:(q,b,r,n)=>n,
  mesh:()=>({p:[],c:[],n:[]}),tri:(m,a,b,c,k)=>{m.p.push(...a,...b,...c);m.c.push(...k,...k,...k)},
  quad:(m,a,b,c,d,k)=>{for(const p of [a,b,c,a,c,d]){m.p.push(...p);m.c.push(...k)}}
 });
 vm.runInContext(portion(s.includes('// BEGIN ORVAS SEPARATED OPTICAL TUBES')?'// BEGIN ORVAS SEPARATED OPTICAL TUBES':'function poiDavidThermalBeam(','function poiDavidBeamReduced(')+portion('// BEGIN ORVAS TRANSIENT GROUND TRACES','// END ORVAS TRANSIENT GROUND TRACES'),c);
 return {c,grounds};
}
const xyz=m=>Array.from({length:m.p.length/3},(_,i)=>m.p.slice(i*3,i*3+3));
test('on straight and rotated beams the two cores stay separated from physical eyes to tip',()=>{
 const {c}=engine();
 for(const d of [{x:1,z:0},{x:.6,z:.8}]){
  const mesh=c.poiDavidThermalBeam({sx:0,sz:0,y:0},d,8,500);
  for(const w of [[.2,1.65],[2,5],[6.5,8.1]]){
   const pts=xyz(mesh).map(([x,y,z])=>[(x-.5)*d.x+(z-.5)*d.z,(x-.5)*d.z-(z-.5)*d.x]).filter(p=>p[0]>w[0]&&p[0]<w[1]);
   assert(pts.some(p=>p[1]<-.08)&&pts.some(p=>p[1]>.08));
   assert(pts.every(p=>Math.abs(p[1])>.036),'no glow geometry bridges the gap anywhere');
  }
 }
});
test('short ordinary room ray safely lands both separate tips on real ground before its wall',()=>{
 const {c}=engine(),o={x:0,z:0,y:0},d={x:1,z:0};
 const rays=[{x:.48,z:-.151,end:6.02,h:2.5},{x:.48,z:.151,end:6.02,h:2.5}];
 assert(c.poiOrvasPlayerGroundImpact(o,rays,d,120,undefined,6.02,-1));
 assert(rays.every(r=>r.groundDrop&&r.groundDrop.at<r.end&&r.groundDrop.at>r.end-1.0));
 assert(rays.every(r=>r.groundDrop.h<.17));
 const m=c.poiDavidThermalBeam({sx:0,sz:0,y:0,opticalRays:rays,opticalCenter:6.02},d,6.32,0,true);
 const verts=xyz(m);
 for(const r of rays){
  const rows=new Map();
  for(const [x,y,z] of verts)if(Math.sign(z-.5)===Math.sign(r.z)){
   const at=x-r.x-.5,key=at.toFixed(6);const row=rows.get(key)??{at,lo:Infinity,hi:-Infinity};
   row.lo=Math.min(row.lo,y);row.hi=Math.max(row.hi,y);rows.set(key,row);
  }
  assert(rows.size>=6);
  for(const {at,lo,hi} of rows.values())
   assert(Math.abs((lo+hi)*.5-(r.h+(r.groundDrop.h-r.h)*at/r.groundDrop.at))<.006,'every rendered section lies on the same eye-to-ground line');
  assert(Math.abs(Math.max(...Array.from(rows.values(),r=>r.at))-r.groundDrop.at)<1e-8);
 }
 const targetRays=rays.map(({groundDrop,visualEnd,...r})=>({...r,end:2,visualLimit:6.02}));
 assert(c.poiOrvasPlayerGroundImpact(o,targetRays,d,120,undefined,6.02));
 assert(targetRays.every(r=>r.groundDrop.at>r.end+3&&r.groundDrop.at<r.visualLimit));
 const close=targetRays.map(r=>({...r,end:.85,visualLimit:.85}));
 assert.equal(c.poiOrvasPlayerGroundImpact(o,close,d,120,undefined,.85,-1),false);
});

test('the same committed sweep draws cut vegetation and a soil gouge using actual floor material',()=>{
 const {c,grounds}=engine(),q={sx:0,sz:0,dx:1,dz:0,y:0,kind:'sweep'},p={range:5.25};
 for(const [type,red,green] of [['grassMeadow',.18,.16],['earth',.20,.112]]){
  for(const key of grounds.keys())grounds.set(key,type);
  assert(c.poiOrvasPlayerCutTrace(q,p,100,0));
  const part=vm.runInContext('poiOrvasGroundTraces.at(-1).parts[0]',c);
  assert(part.c.some((v,i)=>i%3===0&&v===red&&part.c[i+1]===green));
 }
});

const slab=(s,a,ray,max)=>{
  let lo=0,hi=max;
  for(let i=0;i<3;i++){
   if(Math.abs(ray[i])<1e-9){if(a[i]<s.min[i]||a[i]>s.max[i])return Infinity;continue}
   const v=[(s.min[i]-a[i])/ray[i],(s.max[i]-a[i])/ray[i]].sort((a,b)=>a-b);
   lo=Math.max(lo,v[0]);hi=Math.min(hi,v[1]);if(lo>hi)return Infinity;
  }
  return lo;
 };
test('opaque wall impact uses its actual forward face; no ground trail is fabricated',()=>{
 const {c}=engine(),s={min:[-.5,0,-.5],max:[.5,3,.5],tris:null};
 c.poiWallCameraSlab=slab;
 c.poiWallCameraCandidates=()=>[{x:6.5,y:0,z:.5,s}];
 const ray={x:.40,z:.151,h:2,end:5.15,visualLimit:5.15},d={x:1,z:0};
 assert(c.poiOrvasPlayerGroundImpact({x:0,z:0,y:0},[ray],d,16,undefined,5.15));
 assert(ray.wallImpact>5&&ray.visualEnd<ray.wallImpact&&!ray.groundDrop);
 const report=vm.runInContext('poiOrvasGroundTraces.at(-1)',c);
 assert.equal(report.parts.length,1);assert([...report.cells][0].startsWith('wall:'));
 const rContact=ray.h+(ray.visualHeight-ray.h)*ray.wallImpact/ray.visualEnd;
 assert(rContact<ray.h-.10);
 assert(xyz(report.parts[0]).every(([x,y,z])=>Math.abs(x-5.986)<.001&&y>rContact-.31&&y<rContact+.31));
});
test('a steep downward ray stops at a wall below its eye line and cannot scorch the floor beyond it',()=>{
 const {c}=engine(),d={x:1,z:0};
 c.poiWallCameraSlab=slab;
 c.poiWallCameraCandidates=()=>[{x:4,y:0,z:.5,s:{min:[-.5,0,-.5],max:[.5,1.18,.5],tris:null}}];
 const o={x:0,z:0,y:0},ray={x:.45,z:.15,h:2,end:5.9};
 assert.equal(c.poiOrvasWallContact(ray.x,ray.h,ray.z,d,5.9,0),null);
 assert(c.poiOrvasPlayerGroundImpact(o,[ray],d,16,undefined,5.9));
 assert(ray.wallImpact>2.5&&ray.wallImpact<2.60&&!ray.groundDrop);
 assert(ray.visualHeight<1.18&&ray.visualHeight>.90);
 const event=vm.runInContext('poiOrvasGroundTraces.at(-1)',c);
 assert([...event.cells].every(x=>x.startsWith('wall:')));
});
test('an endpoint remaining in empty air above no real surface cannot create a mark',()=>{
 const {c,grounds}=engine();grounds.clear();
 const rays=[{x:.40,z:-.151,h:2,end:5.15},{x:.40,z:.151,h:2,end:5.15}];
 assert.equal(c.poiOrvasPlayerGroundImpact({x:0,z:0,y:0},rays,{x:1,z:0},16,undefined,5.15),false);
 assert(rays.every(r=>!r.groundDrop&&!r.wallImpact));
 assert.equal(vm.runInContext('poiOrvasGroundTraces.length',c),0);
});
