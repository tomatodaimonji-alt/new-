const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';const s=buildFacilitySite("base");s.id="base";poiSnowPassSeam(s,s.map.world);s');
site.id='base';
const f=site.sacredForest,w=site.map.world,d=site.davidTemple,key=o=>[o.x,o.z,o.y].join(',');
test('open meadow, known original terrain and continuous authored paths to the remote temple',()=>{
 a.deepEqual([site.map.width,site.map.height],[128,182]);
 a.deepEqual([d.entrance.x,d.entrance.z,d.boss.x,d.boss.z],[24,128,24,158]);
 a.equal(crypto.createHash('sha256').update(JSON.stringify(w.slice(0,d.authored.index))).digest('hex'),'15535689893b8a631827467885930d45d786e0d3b559b74d6a2544267d03439a');
 a(w.every(o=>o.z<128||o.x<48||o.x<72&&o.z<139));
 a.deepEqual([f.route[0].x,f.route[0].z,f.route.at(-1).x,f.route.at(-1).z],[12,49,24,125]);
 a(f.route.length>=100);
 a(f.trees.length>=72&&f.trees.length<=96&&f.trees.every(o=>o.z>=73));
 a(f.canopy.length>=18);
 for(const route of f.routes){
  for(let i=1;i<route.length;i++)a.equal(Math.abs(route[i-1].x-route[i].x)+Math.abs(route[i-1].z-route[i].z),1);
  for(const p of route){
   a(!w.some(o=>key(o)===key(p)&&!/^(?:road|grass|earth|flower|tallGrass)/.test(o.type)),key(p));
  }
 }
 const forest=w.slice(f.authored.index);
 a.equal(new Set(forest.map(key)).size,forest.length);
 for(const node of [{x:49,z:127,y:0},{x:49,z:119,y:0}])a(w.some(o=>key(o)===key(node)&&/^road/.test(o.type)),'same snow outlet keeps original road');
});
test('foreground gameplay remains clear; depth steepens gradually and tall sparse foliage provides real occlusion',()=>{
 const g=vm.createContext({facilitySite:site,terrainY:()=>0,
  tri:(m,...p)=>m.p.push(...p[0],...p[1],...p[2]),
  quad:(m,p,q,r,t)=>m.p.push(...p,...q,...r,...p,...r,...t)});
 vm.runInContext(cut('// BEGIN SACRED FOREST LOCAL','// END SACRED FOREST LOCAL'),g);
 for(const [x,z,y] of [[12,56,0],[15,67,0],[41,69,0],[24,125,0],[24,130,0],[24,145,0],[18,109,-1],[105,101,0]])
  a.equal(g.poiSacredFogStrength(site,x,z,y),0,[x,z]);
 const progression=[[13,75],[13,85],[13,96],[18,109]].map(([x,z])=>g.poiSacredFogStrength(site,x,z,0));
 a(progression[0]>0&&progression[0]<.16);
 a(progression.every((v,i)=>!i||v>progression[i-1]));
 a(progression.at(-1)>.90);
 a.match(h,/smoothstep\(5\.1,25\.5,length\(vLootXZ-uSacredFog\.xy\)\)/);
 const all={p:[]};
 for(const o of f.trees)g.poiSacredTreeGeometry(all,o);
 const heights=all.p.filter((v,i)=>i%3===1);
 a(Math.max(...heights)>10.9&&Math.max(...heights)<12.2);
 a(all.p.length/3<=96*180,'new tall canopy stays inside original foliage budget');
});
test('deep stock save decoding accepts only the additional western lobe; public custom map height is unchanged',()=>{
 const c=vm.createContext({MAX_MAP:128,MAX_LEVEL:9,POI_SACRED_DEPTH_H:182,POI_SACRED_DEPTH_W:48});
 vm.runInContext(cut('function poiSnowSleeveOwn(','function poiSnowSleeveRoute(')+cut('function workshopResumeDecode(','function workshopResumePermitted(')+cut('function poiSacredDepthVoid(','function poiWalkCanStep('),c);
 const s=(x,z,hd,route='facility')=>c.workshopResumeDecode(JSON.stringify({version:1,route,id:'base',play:true,townLayout:5,townMapHeight:hd,
  position:{x,z,y:0,facing:2}})).position;
 a.equal(s(24,155,182).z,155);a.equal(s(49,155,182),null);a.equal(s(24,155,128),null);a.equal(s(24,155,182,'editor'),null);
 a.equal(s(49,127,128).x,49);a.equal(c.poiSacredDepthVoid(site,49,127),false);a.equal(c.poiSacredDepthVoid(site,49,128),false);a.equal(c.poiSacredDepthVoid(site,49,139),true);a.equal(s(60,138,182).z,138);
 a.match(h,/const MIN_MAP=12,MAX_MAP=128,POI_SACRED_DEPTH_H=182/);
});

test('old town grass/cobble uses the identical paint detail cutoff despite the southwestern depth',()=>{
 const c=vm.createContext({});vm.runInContext(cut('function poiSacredPaintArea(','function makeScene('),c);
 a.equal(c.poiSacredPaintArea(site,61,128,182),16384);
 a.equal(c.poiSacredPaintArea(site,127,128,182),16384);
 a.equal(c.poiSacredPaintArea(site,128,128,182),23296);
 a.equal(c.poiSacredPaintArea({id:'snowpass'},5,24,29),696);
});
