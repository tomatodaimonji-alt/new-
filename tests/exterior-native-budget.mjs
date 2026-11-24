import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
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
  const rows=[];
  for(const p of q.values()){
   const begin=poiWallNow(),spec=byId.get(p.id),g=poiOverlandChunkRows(p,spec);
   let f=g.next();while(!f.done)f=g.next();
   const m=f.value,n=m.p.length/3,obs=(spec.batches.get(p.i+','+p.j)||[]).filter(o=>o.y>=0);
   rows.push({...p,nearKept:keep.has(p.key),floorVerts:m.propsFirst,verts:n,bytes:n*36,bakeMs:poiWallNow()-begin,
    roofGroups:spec.roofGroups.get(p.i+','+p.j)?.length??0,
    gates:obs.filter(o=>o.type==='poiFortGate').length,trees:obs.filter(o=>/^tree/.test(o.type)).length});
   await new Promise(r=>setTimeout(r,0));
  }
  const sum=(rows,k)=>rows.reduce((v,r)=>v+(r[k]??0),0),adj=rows.filter(r=>r.nearKept);
  return {worldId,g,cap:POI_OVERLAND_GPU_LIMIT,rows,all:{bytes:sum(rows,'bytes'),verts:sum(rows,'verts'),time:sum(rows,'bakeMs'),n:rows.length},
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
const [worldId,x,z,yaw]={gate:['base',41,55,0],forest:['base',54,119,.29],snow:['snowpass',2,19,-Math.PI/2],seam:['base',60,138,0]}[choice];
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
 if(choice==='gate')assert(data.rows.some(r=>r.gates>0)&&data.rows.filter(r=>r.roofGroups).length>=4);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({choice,...data}));
}finally{await b?.close();await new Promise(r=>s.close(r))}
