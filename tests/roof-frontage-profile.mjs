import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const r=(x,y)=>{assert.equal(h.split(x).length,2,x);h=h.replace(x,y)};
r(' houseFacadeDetails(m,visible,wallFade?(o,start)=>{',' const __oldFrontStart=m.p.length;\n houseFacadeDetails(m,visible,wallFade?(o,start)=>{');
r(' guildAtriumRailing(m,visible,sharedParts?', ' if(window.__wallCostWatch)window.__wallCostTrim=(m.p.length-__oldFrontStart)*12;\n guildAtriumRailing(m,visible,sharedParts?');
const anchor='  if(isWallId(o.type)||/^poiDavidWall/.test(o.type))pineBakeWallWarmth(m,start,o,pineShadows,pineWarmLamps);';
r(anchor,anchor+`
  if(window.__wallCostWatch&&o.y>=0&&m.p.length/3>start){
   const lookup=o.type,aperture=/(?:wall|Wall)(?:Door|Window)/.test(lookup),fort=/^poiFort/.test(lookup);
   const group=aperture?'aperture':fort?'fort':isWallId(lookup)?'wall':null;
   if(group){
    const sides=wallFaceState(o,wallLookup),box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for(let i=start*3;i<m.p.length;i+=3)for(let d=0;d<3;d++){box[d]=Math.min(box[d],m.p[i+d]);box[d+3]=Math.max(box[d+3],m.p[i+d])}
    (window.__wallCostMembers??=[]).push({group,type:lookup,n:m.p.length/3-start,box,x:o.x,y:o.y,z:o.z,
     exterior:!!sides?.exterior&&Object.values(sides.exterior).some(Boolean)});
   }
  }
`);
const begin=h.indexOf('function facilityDrawRoofs(vp){'),e=h.indexOf('function facilityInvalidateScenes(',begin);
assert(begin>0&&e>begin);
h=h.slice(0,begin)+h.slice(begin,e).replace('function facilityDrawRoofs(vp){','function facilityDrawRoofs(vp){\n const __ts=poiWallNow();window.__roofCostFrame=[];')
 .replace('  const spans=poiOcclusionFrame.roofFades?.[i];',`  const spans=poiOcclusionFrame.roofFades?.[i],roof=facilityRoofMeshes[i];
  if(roof?.count)window.__roofCostFrame.push({n:roof.count,owner:facilitySite.buildings[i]?.id,occlusion:spans?.length??0});`)
 .replace(/\n}\s*$/,'\n window.__roofCostMs=poiWallNow()-__ts;\n}\n')+h.slice(e);
r(' requestAnimationFrame(render);', ' requestAnimationFrame(render);\n window.__frontageStart=poiWallNow();');
r(' poiScreenNoteCaptureFrame();',` poiScreenNoteCaptureFrame();
 (window.__frontageFrames??=[]).push([window.__frontageStart,poiWallNow(),window.__roofCostMs]);
 if(window.__frontageFrames.length>80)window.__frontageFrames.shift();
`);
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
r(api,api+`
 roofCostQA:()=>{
  const p=parameters(),m=sceneMesh,all=window.__wallCostMembers??[],seen=all.filter(s=>poiOverlandBoxVisible(p.vp,s.box));
  const sum=(src)=>{
   const bins={};for(const o of src){const a=bins[o.group]??={n:0,b:0,objects:0,exterior:0};
    a.n+=o.n;a.b+=o.n*36;a.objects++;a.exterior+=Number(o.exterior);}
   return bins;
  };
  const allRoof=facilityRoofMeshes.reduce((n,r)=>n+r.count,0),roof=window.__roofCostFrame??[];
  return {pose:[poiWalkViewX,poiWalkViewZ],stream:poiOverlandDrawing,wallActive:poiHybridWallActive,roof,
   roofResident:allRoof*36,roofSubmittedUpper:roof.reduce((n,q)=>n+q.n,0)*36,
   atlas:m?.count*36,topLand:m?.ground?.count*36,facadeExtra:window.__wallCostTrim,
   resident:sum(all),visiblePotential:sum(seen),roofTime:window.__roofCostMs,
   frames:window.__frontageFrames,err:gl.getError()};
 },
 `);
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.OUTDOOR_PARSE_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright'),s=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)
});await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;
const loc=process.env.EXTERIOR_SITE??'center',[x,z]={center:[41,43],gate:[41,55]}[loc],opt=process.env.EXTERIOR_OPT!=='reference';let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await b.newPage({viewport:{width:844,height:390},deviceScaleFactor:.68,isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>{window.__wallCostWatch=true});
 await p.goto(url+'/seed');
 await p.evaluate(({x,z})=>{localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.16,orbitDistance:5.6}}));},{x,z});
 await p.goto(url+'/?resume=1&test=1&uniform-outdoor=1&uniform-shell=1&uniform-split=1&hybrid-gate=1&hybrid-wall=1'+(opt?'&hybrid-wall-opt=1':''));
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 await p.waitForFunction(()=>window.__editorTest?.roofCostQA()?.frames?.length>=30,null,{timeout:30000,polling:125});
 const q=await p.evaluate(()=>window.__editorTest.roofCostQA());assert.deepEqual(q.pose,[x,z]);assert(!q.stream&&q.wallActive&&q.err===0,JSON.stringify(q));
 assert(q.atlas>0&&q.roof.length&&q.visiblePotential.wall?.n>0&&q.visiblePotential.aperture?.n>0,JSON.stringify(q));
 assert.deepEqual(errors,[]);
 function p95(nums){const s=[...nums].sort((a,b)=>a-b);return s[Math.floor((s.length-1)*.95)];}
 const a=q.frames.slice(-19),stats={body:p95(a.map(v=>v[1]-v[0])),roof:p95(a.map(v=>v[2]).filter(Number.isFinite)),
  frame:p95(a.slice(1).map((v,i)=>v[0]-a[i][0]))};
 delete q.frames;console.log(JSON.stringify({loc,opt,...q,stats}));
 if(process.env.FACILITY_SCREENSHOTS){mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+loc+(opt?'-opt':'-ref')+'.png'});}
}finally{await b?.close();await new Promise(r=>s.close(r))}
