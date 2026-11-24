const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
site.id='base';
const c=vm.createContext({facilitySite:site,terrainY:()=>0,tri:(m,...ps)=>m.y.push(...ps.slice(0,3).map(v=>v[1])),quad:(m,...ps)=>m.y.push(...ps.slice(0,4).map(v=>v[1]))});
vm.runInContext(cut('// BEGIN SACRED FOREST LOCAL','// END SACRED FOREST LOCAL')+cut('const POI_SKY_COLOR=','let poiSkyBackdropKey='),c);
test('eastern exterior and nearby inward directions have distance shielding independent of map region',()=>{
 for(const [x,z] of [[41,75],[41,77],[38,79]]){
  a.equal(c.poiSacredForestContains(site,x,z,0),false);
  a.equal(c.poiSacredFogStrength(site,x,z,0),0);
  a(c.poiSacredEdgeFog(site,x,z,0)>.9);
 }
 for(const [x,z,y] of [[23,49,0],[12,56,0],[41,69,0],[61,94,0],[24,125,0],[24,132,0],[41,77,-1]])a.equal(c.poiSacredEdgeFog(site,x,z,y),0);
 let max=0;for(let z=67;z<=117;z+=.25)max=Math.max(max,Math.abs(c.poiSacredEdgeFog(site,41,z,0)-c.poiSacredEdgeFog(site,41,z-.25,0)));
 a(max<.075);
 const night=Array.from(c.poiSacredEdgeHorizon(1281)),day=Array.from(c.poiSacredEdgeHorizon(690));
 a(night.every((v,i)=>v<day[i]));a(night[0]<.41);a(day[2]>.70);
 a.match(h,/parcel\*smoothstep\(11\.0,41\.0,distanceToPlayer\)/);
});
test('real lower needles physically interrupt the tall canopy void without covering paths or raising tree budget',()=>{
 const f=site.sacredForest,rows=f.undergrowth;
 a(f.trees.length<=96&&rows.length>=7&&rows.length<=10);
 const member=p=>f.trees.find(o=>o.x===p.x&&o.z===p.z);
 for(const p of rows){
  a(member(p));
  a(f.routes.flat().every(o=>Math.hypot(p.x-o.x,p.z-o.z)>=2.25));
  const m={y:[]};c.poiSacredTreeGeometry(m,member(p));
  a(Math.max(...m.y)>=4.4&&Math.max(...m.y)<6);
  a(m.y.some(v=>v>=.5&&v<1.1),'foliage actually reaches the bare lower trunk space');
 }
});
