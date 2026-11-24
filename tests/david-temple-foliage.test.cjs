const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
const {map,davidTemple:d,sacredForest:f}=site;
test('tall natural woodland belongs to the approach, not the paved apron or battle circle',()=>{
 a.equal(d.depth,1);
 a(f.trees.length>=72&&f.trees.length<=96);
 const route=new Set([...f.routes.flat(),...d.approach,...d.interior.path].map(p=>p.x+','+p.z));
 a(f.trees.every(o=>o.y===0&&!route.has(o.x+','+o.z)&&Math.hypot(o.x-d.ring.x,o.z-d.ring.z)>20));
 const way=map.world.slice(d.authored.index,d.authored.index+d.authored.count).filter(o=>o.type==='poiDavidWaystone');
 a.deepEqual(Array.from(way,o=>[o.x,o.z,o.y]),[[21,126,0],[27,126,0]]);
 for(const w of way)a(!route.has(w.x+','+w.z));
});
test('authored visual vegetation and flank waystones retain low-poly geometry',()=>{
 const c=vm.createContext({terrainY:()=>0,tri:(m,p,q,r)=>m.p.push(...p,...q,...r),quad:(m,p,q,r,t)=>m.p.push(...p,...q,...r,...p,...r,...t),
  cube:(m,x,y,z,w,h,d)=>{m.count+=36;m.top=Math.max(m.top,y+h)}});
 vm.runInContext(cut('// BEGIN SACRED FOREST LOCAL','// END SACRED FOREST LOCAL')+
  cut('const POI_DAVID_TEMPLE_ARCH=','// END ROUND DAVID TEMPLE ART'),c);
 const m={p:[]};for(const o of f.trees)c.poiSacredTreeGeometry(m,o);
 a(m.p.length/3>9000&&m.p.length/3<=96*180);
 for(const x of [21,27]){
  const q={count:0,top:0};c.poiDavidTempleArchitecture(q,'poiDavidWaystone',x,0,126,0);
  a(q.count>100&&q.count<500&&q.top<1.4);
 }
});
