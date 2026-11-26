const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8');
function cut(a,b){const i=h.indexOf(a),j=h.indexOf(b,i);assert(i>=0&&j>i,'missing marker: '+a);return h.slice(i,j);}
const helpers=cut('const FRONTIER_NORTH_X','function frontierNorthGroundMesh(');
const meadow=cut('function frontierMeadowNoise(','function frontierSlopeShade(');
const greens=cut('function frontierNorthFloraLane(','let frontierNorthMeshes=');
const env={facilitySite:null,frontierHeight:()=>0,frontierSmooth:(a,b,n)=>{const t=Math.max(0,Math.min(1,(n-a)/(b-a)));return t*t*(3-2*t);},
 mesh:()=>({p:[],c:[],n:[]}),tri:(m,a,b,c,t)=>{m.p.push(...a,...b,...c);m.c.push(...t,...t,...t);m.n.push(0,1,0,0,1,0,0,1,0);}};
const f=vm.runInNewContext(helpers+meadow+greens+';({draw:frontierNorthFlora,lane:frontierNorthFloraLane,water:frontierNorthPoolDistance})',env);
const polygons=(x,z)=>{const m=env.mesh();f.draw(m,x,z,x+16,z+16);return m;};
let total=0,flower=0,near=0,meadowCount=0,max=0;
for(let z=-64;z<0;z+=16)for(let x=64;x<128;x+=16){
 const {p,c}=polygons(x,z);assert.deepEqual(p,polygons(x,z).p,'procedural painting must be deterministic');
 assert(p.every(Number.isFinite)&&c.every(Number.isFinite));
 assert(p.length===c.length&&p.length%9===0);
 total+=p.length/3;max=Math.max(max,p.length/3);
 for(let i=0;i<p.length;i+=9){
  const xx=(p[i]+p[i+3]+p[i+6])/3,zz=(p[i+2]+p[i+5]+p[i+8])/3;
  assert(xx>=x-.08&&xx<=x+16+.08&&zz>=z-.08&&zz<=z+16+.08);
  const d=f.water(xx,zz,3).edge;
  assert(d>-.025,'no flowers or grass rooted over water '+[xx,zz,d]);
  assert(f.lane(xx,zz)>.35,'no dense vegetation obscuring the walking line');
  if(c[i]>.62&&c[i+2]>.24)flower++;
  if(d<1.7)near++;else meadowCount++;
 }
}
assert(total>=4500&&total<=28000&&max<=3200,'fixed world and parcel budget: '+[total,max]);
assert(flower>=250&&near>=250&&meadowCount>=1200,'visible flowers and pond margins: '+[flower,near,meadowCount]);
assert(h.includes('stockAtlasOutside(vp,box))draw(gpu,vp)'));
for(const [,s]of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(s);
console.log({total,flower,near,meadowCount,max},'deterministic northern flora, wet/track clearance and draw budget pass');
