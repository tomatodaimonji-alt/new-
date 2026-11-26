const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa430:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&!!frontierNorthMeshes,
  setup:(z=4)=>{poiWildClear();poiNextMobTick=Infinity;poiTownNpcNext=Infinity;
   return workshopResumeRestorePosition({x:107,z,y:0,facing:0,cave:false})},
  state:()=>({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,site:facilitySite.id,cave:frontierPlayCave,
    region:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,0).name}),
  frame:()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))),
  walk:(dz)=>{poiWalkNextReady=0;return poiWalkStep(0,dz)},
  inspect:()=>{const m=frontierNorthMeshes,previous=window.__editorTest.qa430.mesh;
   window.__editorTest.qa430.mesh=m;
   return {same:previous===m,count:m.parcels.map(p=>p.gpu.count),water:m.water.count,
   pass:poiWalkCanStep(107,-1),blocked:!poiWalkCanStep(103,-19)&&!poiWalkCanStep(84,-34),
   shallows:poiWalkCanStep(116,-11),worldEdge:!poiWalkCanStep(107,-65)&&!poiWalkCanStep(128,-1),
   resume:workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'frontier',play:true,frontierWest:1,position:{x:107,z:-3,y:0,facing:0,cave:false}}))?.position,
   waterMap:poiLocalCapture(103,-16,0,facilitySite,null,null,false,[]).tile(103,-18)
  }},
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:70000});
 await p.waitForFunction(()=>window.__editorTest?.qa430?.ready(),null,{timeout:40000});
 const via=(m,arg)=>p.evaluate(([m,arg])=>window.__editorTest.qa430[m](arg),[m,arg]);
 a.equal(await via('setup',3),true);await via('frame');
 const initial=await via('inspect');
 const times=[[],[]];
 for(const d of [-1,1,-1,1]){
  for(let i=0;i<6;i++){
   const t=Date.now();const before=await via('state'); await via('walk',d);await via('frame');
   const after=await via('state');a.equal(after.z,before.z+d);a.equal(after.site,'frontier');a.equal(after.cave,false);
   times[before.z===0&&d===-1||before.z===-1&&d===1?1:0].push(Date.now()-t);
  }
 }
 const q=await via('inspect');a.deepEqual(q.count,[6144,6144,6144,6144]);a.equal(q.same,true);
 a.ok(q.water>200&&q.water<7000);a.ok(q.pass&&q.blocked&&q.shallows&&q.worldEdge);
 a.equal(q.resume.z,-3);a.equal(q.waterMap,4);a.deepEqual(errors,[]);
 console.log('PASS mobile viewport north/south traversal, water map, resume, no parcel re-upload');
 const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
 console.log('Boundary/other step two-frame median ms (software Chromium):',median(times[1]),median(times[0]));
 console.log('New ground/water vertices:',q.count.reduce((a,b)=>a+b,0),q.water,'initial same buffer:',initial.same);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
