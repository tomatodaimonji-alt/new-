const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  scene:()=>{
   const at=(x,z,cave)=>{if(!workshopResumeRestorePosition({x,z,y:0,facing:3,cave}))throw Error('fixture '+x+','+z+' cave '+cave)};
   const step=(dx,dz)=>{poiWalkNextReady=0;poiWalkStep(dx,dz);return [poiWalkX,poiWalkZ,frontierPlayCave]};
   const surface=[];
   at(17,37,false);
   for(let i=0;i<3;i++)surface.push(step(1,0));
   const ground=frontierWalkSurface(20.5,37.5),surfaceMap=poiLocalFrame.scope,monsterAbove=!!poiMonsterAt(20,37,true);
   at(33,29,false);
   const crossing=[step(-1,0),step(-1,0)];
   for(let x=30;x>=21;x--)crossing.push(step(-1,0));
   const cave=[poiWalkX,poiWalkZ,frontierPlayCave,frontierWalkSurface(21.5,29.5),poiOrbitDungeonLookUp(),poiLocalFrame.scope];
   at(18,38,true);const wall=step(-1,0);
   at(5,48,true);const gate=step(0,1);
   at(31,29,true);const exit=step(1,0);
   at(20,37,false);workshopResumeWrite();
   const record=JSON.parse(localStorage.getItem(WORKSHOP_RESUME_KEY));
   return {surface,ground,surfaceMap,monsterAbove,crossing,cave,wall,gate,exit,saved:record.position,gl:gl.getError()};
  },
  inspect:()=>({x:poiWalkX,z:poiWalkZ,layer:frontierPlayCave,scope:poiLocalFrame.scope})
 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 const e=await p.evaluate(()=>window.__editorTest.qa398.scene());console.log(e);
 a.deepEqual(e.surface,[[18,37,false],[19,37,false],[20,37,false]]);
 a(e.ground>=0&&e.surfaceMap==='frontier:0:surface'&&!e.monsterAbove);
 a.deepEqual(e.crossing.slice(0,3),[[32,29,false],[31,29,true],[30,29,true]]);
 a.deepEqual(e.cave.slice(0,3),[21,29,true]);a(e.cave[3]<-3&&e.cave[4]&&e.cave[5]==='frontier:0:west-ruins');
 a.deepEqual(e.wall,[18,38,true]);a.deepEqual(e.gate,[5,48,true]);a.deepEqual(e.exit,[32,29,false]);
 a.equal(e.saved.cave,false);a.equal(e.gl,0);
 await p.reload({waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 a.deepEqual(await p.evaluate(()=>window.__editorTest.qa398.inspect()),{x:20,z:37,layer:false,scope:'frontier:0:surface'});
 console.log('PASS real surface crossing over a live underground enemy, continuous descent/exit, blocked underground walls and gate, surface restored');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
