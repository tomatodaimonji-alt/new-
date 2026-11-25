const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2],'utf8'),block=h.match(/\/\/ BEGIN FRONTIER LANDSCAPE\n([\s\S]+?)\/\/ END FRONTIER LANDSCAPE/);
a(block); const start=h.indexOf('function frontierHomeGeometry('),end=h.indexOf('function poiValdiaHouseDoorAt(',start);
a(start>=0&&end>start,'houses have independent frontier art');
const ctx={mesh:()=>({p:[],n:[],c:[],boxes:[],faces:[]}),cube:(m,x,y,z,w,h,l,c)=>m.boxes.push({x,y,z,w,h,l,c}),
 tri:(m,...v)=>m.faces.push(v),quad:(m,...v)=>m.faces.push(v)};
const builder=h.slice(h.indexOf('function extendTownWorldDavidTemple('),h.indexOf('function poiDavidTempleEnclosedAt('));
const qa=vm.runInNewContext(builder+'\n'+block[1]+h.slice(start,end)+';({site:frontierSite(),geo:poiValdiaHomeGeometry})',ctx);
a.equal(qa.site.buildings.length,4);
const old={frontierHouse:[43,49,21,26,46],frontierStore:[36,40,23,26,38],frontierWoodworker:[39,44,34,37,41]};
const shapes=new Set();
for(const b of qa.site.buildings.slice(0,3)){
 a.equal([b.x1,b.x2,b.z1,b.z2,b.door.x].join(),old[b.id].join());a.equal(b.z2,b.door.z);
 a(b.cutToFloor&&b.enterable);
 a(b.furniture.length>=3,'more than a procedural default table');
 a(!b.furniture.some(([x,z])=>x===b.door.x||z<=b.z1||z>=b.z2||x<=b.x1||x>=b.x2),'door aisle remains clear');
 for(const [x,z,kind,tile] of b.furniture)a(qa.site.map.world.some(o=>o.x===x&&o.z===z&&o.type===tile),kind+' has matched game footprint');
 const shape=qa.geo({...b,h:b.floorHeight*1.4},0),cut=qa.geo({...b,h:b.floorHeight*1.4},1);
 a(shape.boxes.length>45&&shape.faces.length>18);a(cut.boxes.length>24);
 a(shape.boxes.every(o=>[o.x,o.y,o.z,o.w,o.h,o.l,...o.c].every(Number.isFinite)&&o.h>0&&o.w>0&&o.l>0));
 a(Math.max(...shape.faces.flatMap(f=>f.slice(0,-1).map(v=>v[1])))>b.floorHeight*1.4+.65);
 a(Math.max(...cut.faces.flatMap(f=>f.slice(0,-1).map(v=>v[1])))<2.45,'roof removed from cutaway');
 shapes.add(shape.faces.length);
}
a.equal(shapes.size,3,'purpose-specific silhouettes');
for(const m of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
console.log('Three unique Frontier house shapes, all matched furniture blocks, all door/footprint/cutaway checks passed.');
