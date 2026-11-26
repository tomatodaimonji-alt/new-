const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict');const h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const start=h.indexOf('// BEGIN FRONTIER AUTO BOUNDARY'),end=h.indexOf('// END FRONTIER AUTO BOUNDARY');
a.ok(start>=0&&end>start,'auto edge registry and renderer');
const c=vm.createContext({FRONTIER_SECTOR:64,FRONTIER_W:256,FRONTIER_H:64,FRONTIER_NORTH_X:64,FRONTIER_NORTH_EDGE:-64,FRONTIER_SOUTH_X:128,FRONTIER_SOUTH_Z:64,
 facilitySite:null,frontierHeight:()=>0,mesh:()=>({p:[],n:[],c:[]}),tri:(m,...v)=>{m.p.push(...v[0],...v[1],...v[2]);m.c.push(...v[3]);}});
vm.runInContext(h.slice(start,end)+';globalThis.api={frontierSectionOwn,frontierMapEdgePlan,frontierEdgeRockMesh,frontierEdgeCornerMesh,FRONTIER_SURFACE_SECTIONS};',c);
const u=c.api,S=u.FRONTIER_SURFACE_SECTIONS,p=u.frontierMapEdgePlan(S);
a.equal(S.length,6);a.equal(p.edges.length,14);
const at=(a,z,dx,dz)=>p.edges.some(e=>e.x===a&&e.z===z&&e.dx===dx&&e.dz===dz);
a.equal(at(64,0,0,-1),false,'northern meadow shares seam');
a.equal(at(128,0,0,1),false,'southern ruin parcel shares seam');
a.equal(at(0,0,0,-1),true);
a.ok(u.frontierSectionOwn(64,-1,S)&&u.frontierSectionOwn(128,64,S));
a.ok(!u.frontierSectionOwn(63,-1,S)&&!u.frontierSectionOwn(127,64,S));
const next=[...S,[0,-64]];
const newPlan=u.frontierMapEdgePlan(next);
a.ok(!newPlan.edges.some(e=>e.x===0&&e.z===0&&e.dx===0&&e.dz===-1));
a.ok(!newPlan.edges.some(e=>e.x===64&&e.z===-64&&e.dx===-1&&e.dz===0));
a.ok(u.frontierSectionOwn(16,-11,next));
let num=0;
for(const e of p.edges){
 const m=u.frontierEdgeRockMesh(e,0,16);
 a.ok(m.p.length>120&&m.p.every(Number.isFinite));
 num+=m.p.length/3;
 const ys=m.p.filter((_,i)=>i%3===1);a.ok(Math.min(...ys)<-1&&Math.max(...ys)>4.5,'mountain and buried toe');
}
for(const corner of p.corners){
 const m=u.frontierEdgeCornerMesh(corner);a.ok(m.p.length>=45&&m.p.every(Number.isFinite));
}
a.ok(num*4<23000,'bounded static vertex count');
console.log('PASS automatic non-shared perimeter, mountain heights/closed corners, removable interior seams and finite mesh budget');
