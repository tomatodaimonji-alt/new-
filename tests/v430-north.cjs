const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const get=(x,y)=>{const i=h.indexOf(x);a.ok(i>=0,x);return h.slice(i,h.indexOf(y,i))};
const c=vm.createContext({facilitySite:{id:'frontier'},FRONTIER_W:256,FRONTIER_H:64,FRONTIER_WEST_OFFSET:64,POI_LOCAL_W:128,POI_LOCAL_H:182,frontierSmooth:(l,h,x)=>{const t=Math.max(0,Math.min(1,(x-l)/(h-l)));return t*t*(3-2*t)},frontierHeight:()=>.02,frontierEarthTint:()=>[.28,.4,.2],mesh:()=>({p:[],n:[],c:[]})});
vm.runInContext(get('// BEGIN FRONTIER NORTH MEADOW','// END FRONTIER NORTH MEADOW')+get('function poiLocalBit(','function poiLocalKnown(')+';globalThis.f={frontierNorthOwn,frontierNorthWet,frontierNorthGroundHeight,frontierNorthGroundMesh,poiLocalBit,FRONTIER_NORTH_POOLS};',c);
const {frontierNorthOwn:own,frontierNorthWet:wet,frontierNorthGroundHeight:height,frontierNorthGroundMesh:ground,poiLocalBit:bit,FRONTIER_NORTH_POOLS:pools}=c.f;
let count=0;const occupied=new Set();
for(let z=-65;z<64;z++)for(let x=0;x<256;x++){
 if(!own(x,z)&&z<0)continue;
 if(z<0)count++;
 const i=bit(x,z);a.ok(i>=0&&i<128*182);a.ok(!occupied.has(i));occupied.add(i);
}
a.equal(count,4096);a.equal(own(103,-1),true);a.equal(own(103,-65),false);a.equal(bit(64,0),0);
for(const [x,z,rx,rz,deep] of pools){a.equal(wet(x,z,true),deep);a.ok(height(x,z)<-.046)}
a.ok(Math.abs(height(108,0)-.02)<1e-9);
let verts=0;for(let x of [64,96])for(let z of [-64,-32]){const m=ground(x,z);verts+=m.p.length/3;a.equal(m.c.length,m.p.length);a.ok(m.p.every(Number.isFinite));}
a.equal(verts,24576);
console.log('PASS north ownership, preserved minimap indices, pond/puddle depth and collision, seam and fixed mesh budget');
