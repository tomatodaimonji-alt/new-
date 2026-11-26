const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  frame:(x,z,yaw,pitch)=>{
   if(!workshopResumeRestorePosition({x,z,y:0,facing:3}))throw Error('bad fixture '+x+','+z);
   poiCameraYaw=yaw;poiCameraPitch=pitch;
   return [poiWalkX,poiWalkZ];
  },
  lighting:()=>({error:gl.getError(),lights:Array.from([0,1,2,3],i=>Array.from(gl.getUniform(program,gl.getUniformLocation(program,'uFrontierTorchLights['+i+']')))),n:frontierFlameGpu?.count??0})
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
 fs.mkdirSync('screenshots',{recursive:true});
 for(const [name,x,z,yaw,pitch] of [
  ['01-forest-entrance',34,29,-Math.PI/2,.53],
  ['02-stone-tunnel',21,29,-Math.PI/2,.22],
  ['03-ruins-crossroads',6,28,Math.PI,.25],
  ['04-boss-hall',9,42,-Math.PI/2,.22],
 ]){
  console.log(name,await p.evaluate(args=>window.__editorTest.qa398.frame(...args),[x,z,yaw,pitch]));
  await p.waitForTimeout(550);
  if(name==='02-stone-tunnel'){
   const light=await p.evaluate(()=>window.__editorTest.qa398.lighting());
   a.equal(light.error,0);a(light.n>0&&light.lights.some(p=>p[3]>.3));
   await p.waitForTimeout(310);
   const after=await p.evaluate(()=>window.__editorTest.qa398.lighting());
   a(light.lights.some((u,i)=>Math.abs(u[3]-after.lights[i][3])>.01),'light must vary');
  }
  await p.screenshot({path:'screenshots/'+name+'.jpg',type:'jpeg',quality:89,timeout:30000});
 }
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
