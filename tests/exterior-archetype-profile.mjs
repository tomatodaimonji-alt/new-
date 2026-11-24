import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const first=h.indexOf('function* poiOverlandChunkRows('),last=h.indexOf('function poiOverlandUpload(',first);
assert(first>=0&&last>first);
let functionSource=h.slice(first,last);
const patch=(a,b)=>{assert.equal(functionSource.split(a).length,2,a);functionSource=functionSource.replace(a,b)};
patch(' const m=mesh(),{floors}=region.index,id=q.i+', ' const m=mesh();m.exteriorProfile=[];const {floors}=region.index,id=q.i+');
patch('  const t=o.type,y=o.y*1.4+height(o.x,o.z)*TERRAIN_STEP;', '  const t=o.type,y=o.y*1.4+height(o.x,o.z)*TERRAIN_STEP,start=m.p.length;');
patch('  yield;\n }\n for(const group of region.roofGroups.get(id)||[]){',
 `  if(m.p.length>start){
   const key=poiExteriorArchetypeKey(m,start,[o.x+.5,y,o.z+.5]);
   const owner=region.layout===facilitySite?facilityFloorOwner(o.x,o.z,o.y,true):null;
   const family=isWallId(t)?'wall':isFloor(t)?'upper-floor':facilityIsRoofPiece(o)?'roof':/^tree/.test(t)?'tree':
    /^poiFort/.test(t)?'fort':BRIDGE_IDS.has(t)?'bridge':'decoration';
   m.exteriorProfile.push({id:t,family,key,bytes:(m.p.length-start)*12,inside:owner!==null||undefined,x:o.x,z:o.z,y:o.y,
     owner:owner===null?null:region.layout.buildings[owner]?.id??null});
  }
  yield;
 }
 for(const group of region.roofGroups.get(id)||[]){
  const start=m.p.length;`);
patch('  if(!local||!pineGuildFantasyRoof(m,group))residentialRoofGeometry(m,group,region.roofLookup,true);\n  yield;',
 `  if(!local||!pineGuildFantasyRoof(m,group))residentialRoofGeometry(m,group,region.roofLookup,true);
  if(m.p.length>start)m.exteriorProfile.push({id:group[0].type,family:'roof-assembled',bytes:(m.p.length-start)*12,
   x:group[0].x,z:group[0].z,y:group[0].y,key:poiExteriorArchetypeKey(m,start,[group[0].x+.5,group[0].y*1.4,group[0].z+.5])});
  yield;`);
h=h.slice(0,first)+`
 // Audit candidate local-space archetype reuse. Keep exact RGB/normal
 // quantization and context-produced shape. This is not a renderer rewrite.
 function poiExteriorArchetypeKey(m,start,base){
  let a=2166136261,b=610674390;
  function bit(x){a=Math.imul(a^(x|0),16777619);b=Math.imul(b^(x|0),1597334677);}
  for(let i=start;i<m.p.length;i++){
   bit(Math.round((m.p[i]-base[i%3])*1e7));bit(Math.round(m.n[i]*1e7));bit(Math.round(m.c[i]*1e7));
  }
  return [m.p.length-start,a>>>0,b>>>0].join(':');
 }
`+functionSource+h.slice(last);
const needle="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(h.split(needle).length,2);
h=h.replace(needle,needle+`
 exteriorBudget:async()=>{
  const worldId=facilitySite.id,areas=poiOverlandAreas(),g=poiOverlandGlobal(worldId,poiWalkX,poiWalkZ);
  const keep=new Set(poiOverlandQueue(areas,...g).map(a=>a.key)),byId=new Map(areas.map(a=>[a.id,a]));
  const q=new Map(),r=18,S=POI_OVERLAND_CHUNK;
  for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){
   if(dx*dx+dz*dz>r*r)continue;
   const x=g[0]+dx,z=g[1]+dz,id=poiOverlandSquareOwner(x,z),spec=byId.get(id);
   if(!spec)continue;
   const [lx,lz]=poiOverlandLocal(id,x,z),i=Math.floor(lx/S),j=Math.floor(lz/S),key=id+':'+i+','+j;
   if(!q.has(key))q.set(key,{id,key,i,j,x0:i*S,z0:j*S,x1:Math.min(spec.width,(i+1)*S),z1:Math.min(spec.height,(j+1)*S),nearCells:0});
   q.get(key).nearCells++;
  }
  const rows=[],ranges=[];
  for(const p of q.values()){
   const begin=poiWallNow(),spec=byId.get(p.id),g=poiOverlandChunkRows(p,spec);
   let f=g.next();while(!f.done)f=g.next();
   const m=f.value,n=m.p.length/3,obs=(spec.batches.get(p.i+','+p.j)||[]).filter(o=>o.y>=0);
   ranges.push(...m.exteriorProfile);
   rows.push({...p,nearKept:keep.has(p.key),floorVerts:m.propsFirst,verts:n,bytes:n*36,bakeMs:poiWallNow()-begin,
    roofGroups:spec.roofGroups.get(p.i+','+p.j)?.length??0,roofTiles:obs.filter(facilityIsRoofPiece).length,
    gates:obs.filter(o=>o.type==='poiFortGate').length,trees:obs.filter(o=>/^tree/.test(o.type)).length});
   await new Promise(r=>setTimeout(r,0));
  }
  const sum=(rows,k)=>rows.reduce((v,r)=>v+(r[k]??0),0),adj=rows.filter(r=>r.nearKept);
  const summarize=(fn,src)=>{const out={};for(const o of src){const key=fn(o),e=out[key]??={bytes:0,count:0};e.bytes+=o.bytes;e.count++}return Object.entries(out).sort((a,b)=>b[1].bytes-a[1].bytes)};
  const families=summarize(o=>o.family,ranges),types=summarize(o=>o.id,ranges),owner=summarize(o=>o.owner??'not cert interior',ranges);
  const inDecor=ranges.filter(o=>o.family==='decoration'&&o.owner);
  const possible = inDecor.filter(o=>/^(sack|barrel|bookshelf|chairWood|roundTableWood|wardrobe|benchWood|table|bathWood|crate|bed|displayShelf|chest)$/.test(o.id));
  const reuse=(rs)=>{
   const seen=new Map();for(const o of rs){
    const k=o.id+';'+o.key;
    if(!seen.has(k))seen.set(k,{bytes:o.bytes,count:0,id:o.id});seen.get(k).count++;
   }
   const unique=[...seen.values()];
   return {objects:rs.length,archetypes:unique.length,sourceBytes:sum(rs,'bytes'),uniqueBytes:sum(unique,'bytes'),
    withInstanceBytes:sum(unique,'bytes')+rs.length*24,
    common:unique.sort((a,b)=>b.count*b.bytes-a.count*a.bytes).slice(0,12)};
  };
  const wallReuse=reuse(ranges.filter(o=>o.family==='wall'||/wall(?:Window|Door)$/.test(o.id))),staticReuse=reuse(ranges);
  return {profile:{wallReuse,staticReuse,safeFurnitureUpperBound:sum(possible,'bytes'),families,types:types.slice(0,24),owner,insideDecoration:summarize(o=>o.id,inDecor),insideDecorBytes:sum(inDecor,'bytes'),
   worst:ranges.slice().sort((a,b)=>b.bytes-a.bytes).slice(0,9)},worldId,g,cap:POI_OVERLAND_GPU_LIMIT,rows,all:{bytes:sum(rows,'bytes'),verts:sum(rows,'verts'),time:sum(rows,'bakeMs'),n:rows.length},
   old:{bytes:sum(adj,'bytes'),verts:sum(adj,'verts'),time:sum(adj,'bakeMs'),n:adj.length},glError:gl.getError()}
 },`);
const mark=' requestAnimationFrame(render);';
assert.equal(h.split(mark).length,2);h=h.replace(mark,' if(!window.__exteriorBudgetPause)requestAnimationFrame(render);');
for (const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
const choice=process.env.EXTERIOR_SITE??'gate';
const [worldId,x,z,yaw]={gate:['base',41,55,0],center:['base',41,43,0],port:['base',84,115,-.8],forest:['base',54,119,.29],snow:['snowpass',2,19,-Math.PI/2],seam:['base',60,138,0]}[choice];
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true}),p=await ctx.newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/seed');
 await p.evaluate(({worldId,x,z,yaw})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   ...(worldId==='snowpass'?{region:worldId,regionHp:100}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:5.6}})),{worldId,x,z,yaw});
 await p.goto(url+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 await p.waitForFunction(()=>!!window.__editorTest?.exteriorBudget,null,{timeout:15000});
 const data=await p.evaluate(async()=>{window.__exteriorBudgetPause=true;return window.__editorTest.exteriorBudget()});
 assert.equal(data.worldId,worldId);assert.deepEqual(data.g,worldId==='snowpass'?[x+48,z+139]:[x,z]);assert.equal(data.glError,0);
 assert(data.all.n>18&&data.rows.some(r=>!r.nearKept&&r.nearCells>0));
 assert(data.rows.every(q=>q.floorVerts>0&&q.verts>=q.floorVerts&&q.bytes===q.verts*36));
 console.log(JSON.stringify({choice,...data}));
 if(choice==='gate')assert(data.rows.some(r=>r.gates>0)&&data.rows.reduce((n,q)=>n+q.roofTiles,0)>20);
 assert.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>s.close(r))}
