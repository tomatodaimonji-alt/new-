const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  scene:()=>{
   const trail=[];
   if(!workshopResumeRestorePosition({x:69,z:30,y:0,facing:3}))throw Error('east side of forest');
   for(let x=68;x>=61;x--){
    poiWalkNextReady=0;poiWalkStep(-1,0);trail.push(poiWalkX);
   }
   const grass=world.filter(o=>o.x<63&&['flowerField','tallGrass','grassMeadow'].includes(o.type)&&o.y===0);
   const plants=grass.filter(o=>poiWalkCanStep(o.x,o.z,undefined,undefined,undefined,false,true));
   const heights=[62,63,64,65,66].map(x=>frontierWalkSurface(x+.5,30.5));
   return {trail,flora:grass.length,walkable:plants.length,heights,gl:gl.getError()};
  }
 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 await p.addInitScript(()=>{
  window.__saveWrites=0;const prior=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(String(k).endsWith('world-workshop-resume-v1'))window.__saveWrites++;return prior.call(this,k,v)};
 });
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 const out=await p.evaluate(()=>window.__editorTest.qa398.scene());console.log(out);
 a.deepEqual(out.trail,[68,67,66,65,64,63,62,61]);
 a(out.flora>30&&out.walkable>20);a.equal(out.gl,0);
 console.log('PASS across the west-village junction and on forest plant tiles');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
