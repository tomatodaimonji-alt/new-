const {beforeAbandonedMine,beforeNorthFort}=require('./mine-history-v165.cjs');
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function load(s){
 const a=s.indexOf('const FACILITY_SITES=Object.freeze('),b=s.indexOf('function workshopResumeDecode(',a);
 return vm.runInNewContext(s.slice(a,b)+';buildFacilitySite');
}
const view=load(html);
const clean=s=>JSON.parse(JSON.stringify(s));
const base=beforeAbandonedMine(beforeNorthFort(clean(view('base'))));
const k=(x,z)=>x+','+z;
const byCell=new Map();
for(const o of base.map.world.filter(o=>o.y===0)){
 const key=k(o.x,o.z);if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(o.type);
}
function trace(points){
 const cells=[];let [x,z]=points[0];cells.push([x,z]);
 for(const [a,b] of points.slice(1)){
  assert(x===a||z===b);
  while(x!==a||z!==b){x+=Math.sign(a-x);z+=Math.sign(b-z);cells.push([x,z]);}
 }
 return cells;
}
test('extension keeps every old Game World tile and all other POIs intact',()=>{
 const northBuild=' const northFort=extendTownWorldNorthFort(expanded.map.world,northTrail);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort};';
 const oldBuild=' return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad};';
 const portBuild=' const southPort=extendTownWorldSouthPort(expanded.map.world);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort};';
 const northReturn=' return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort};';
 const forestBuild=' const southForest=extendTownWorldSouthForest(expanded.map.world,southPort);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort,southForest};';
 const portReturn=' return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort};';
 const templeBuild=' const davidTemple=extendTownWorldDavidTemple(expanded);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort,southForest,davidTemple};';
 const forestReturn=' return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort,southForest};';
 const westBuild=' const sacredForest=extendTownWorldSacredForest(expanded,davidTemple);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort,southForest,davidTemple,sacredForest};';
 const westReturn=' return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad,northFort,southPort,southForest,davidTemple};';
 const preWest=html.replace(westBuild,westReturn);
 if(html.includes('const sacredForest=extendTownWorldSacredForest('))assert.notEqual(preWest,html,'strip only the exact final sacred forest authoring call');
 const preTemple=preWest.replace(templeBuild,forestReturn);
 if(preWest.includes('const davidTemple=extendTownWorldDavidTemple('))assert.notEqual(preTemple,preWest,'strip only the exact final temple authoring call');
 const preForest=preTemple.replace(forestBuild,portReturn);
 if(preTemple.includes('const southForest=extendTownWorldSouthForest('))assert.notEqual(preForest,preTemple,'strip only the exact final forest authoring call');
 const prePort=preForest.replace(portBuild,northReturn);
 if(preForest.includes('const southPort=extendTownWorldSouthPort('))assert.notEqual(prePort,preForest,'strip only the exact final port authoring call');
 const preFort=prePort.includes(northBuild)?prePort.replace(northBuild,oldBuild):prePort;
 const oldSource=preFort.replace(' const margin=10,expanded=shift(site,margin);\n extendTownWorldOutside(expanded,margin);\n const mine=extendTownWorldMine(expanded),otherworld=extendTownWorldOtherworld(expanded);\n extendTownWorldMineEntry(mine,expanded.map.world);\n const chapel=extendTownWorldChapel(expanded),armedEncounters=extendTownWorldArmedEncounters(expanded.map.world);\n const northTrail=extendTownWorldNorthTrail(expanded.map.world);\n extendTownWorldForestWatchPost(northTrail,expanded.map.world);\n extendTownWorldPondMarsh(northTrail,expanded.map.world);\n extendTownWorldWayfarer(northTrail,expanded.map.world);\n extendTownWorldOtherworldDepths(otherworld,expanded.map.world);\n extendTownWorldChapelWest(chapel,expanded.map.world);\n extendTownWorldMinePrep(mine,expanded.map.world);\n extendTownWorldChapelApproach(chapel,expanded.map.world);\n const southRoad=extendTownWorldSouthRoad(expanded);\n extendTownWorldMineApproach(mine,expanded.map.world);\n southRoad.creek=extendTownWorldSouthCreek(expanded);\n southRoad.town=extendTownWorldSouthTown(expanded,southRoad);\n return {...expanded,townOffset:townOffset+margin,mine,otherworld,chapel,armedEncounters,northTrail,southRoad};',' return {...site,townOffset};');
 assert.notEqual(oldSource,preFort,'inverse the exact final outlying append order');
 const old=load(oldSource.replace("[id==='base'?1:6,8,'poiPottedPlant']","[6,8,'poiPottedPlant']"));
 const framed=clean(old('base'));
 const shift=v=>Array.isArray(v)?v.map(shift):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([f,x])=>[f,
  /^(?:x|z|x1|x2|z1|z2)$/.test(f)&&typeof x==='number'?x+10:shift(x)])):v;
 assert.deepEqual([base.map.width,base.map.height,base.townOffset],[128,96,22]);
 assert.deepEqual([framed.map.width,framed.map.height,framed.townOffset],[108,68,12]);
 assert.deepEqual(base.map.world.filter(o=>o.x>=10&&o.x<118&&o.z>=10&&o.z<78),shift(framed.map.world));
 assert.deepEqual(base.creek.deep.filter(o=>o.x<118),shift(framed.creek.deep));
 assert.deepEqual({...base.creek,deep:[]},{...shift(framed.creek),deep:[]});
 assert.deepEqual(base.canal,shift(framed.canal));
 assert.deepEqual(base.spawn,shift(framed.spawn));assert.deepEqual(base.buildings,shift(framed.buildings));
 assert.deepEqual(base.map.terrainHeights,shift(framed.map.terrainHeights));
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop'])
  assert.deepEqual(clean(view(id)),clean(old(id)),id);
 assert(base.map.world.length-framed.map.world.length<360,'low authored budget');
});
test('actual paths cross all four former map edges without trees or deep water in the walking line',()=>{
 const walk=/^(?:grass\w*|earth|road\w+|poiFortGate|flowerField|tallGrass)$/;
 for(const p of [
  [[41,69],[41,84],[57,84],[57,88],[76,88],[76,91],[97,91],[97,85],[112,85]],
  [[93,60],[95,60],[95,64],[98,64],[98,66],[124,66],[124,72]],
  [[34,22],[34,4],[39,4],[39,2]],[[23,49],[4,49],[4,43],[2,43]]
 ])for(const [x,z] of trace(p)){
  const cell=byCell.get(k(x,z))||[];
  assert(cell.every(o=>walk.test(o)),[x,z,cell]);
  if(x<10||z<10||x>=118||z>=78)assert(cell.some(o=>o==='earth'||o==='grassTrampled'),[x,z,cell]);
 }
});
test('the eastern river continuation is connected to the old outlet and leaves the new edge naturally',()=>{
 const oldExit=k(117,74),wet=new Set(base.creek.deep.map(p=>k(p.x,p.z))),found=new Set([oldExit]),visited=[[117,74]];
 for(let i=0;i<visited.length;i++){
  const [x,z]=visited[i];
  for(const [dx,dz] of [[-1,0],[1,0],[0,1],[0,-1]]){
   const a=x+dx,b=z+dz,t=k(a,b);
   if(a<117||!wet.has(t)||found.has(t))continue;
   found.add(t);visited.push([a,b]);
  }
 }
 const added=base.creek.deep.filter(o=>o.x>=118);
 assert(added.length===20);
 assert(added.every(o=>found.has(k(o.x,o.z))&&byCell.get(k(o.x,o.z)).includes('river')));
 assert.deepEqual(added.filter(o=>o.x===127).map(o=>o.z),[78,79]);
});

