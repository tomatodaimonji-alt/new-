import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const replace=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b)};
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=replace(source,hook,hook+`
  soulFxQA:{
   frame:()=>render(),
   slimes:()=>{const o={type:'monsterSlime',x:poiWalkX+1,z:poiWalkZ,y:poiWalkLevel,rot:0},s=poiCombatActorMake(o);
    s.hp=1;s.wildSpawn=true;s.nextAttack=performance.now()+9000;
    poiMonsterStates.set(o,s);poiWildActors.add(o);poiMonsterMeshDirty=true;},
   state:()=>({fx:poiCompanionFxSnapshot(),flight:!!poiCompanionSoulFlight(),health:poiPlayerHP,x:poiWalkX,z:poiWalkZ,
    view:[poiWalkViewX,poiWalkViewZ],tokens:poiHotbarRead().slots.filter(c=>c?.type==='slimeSoul').reduce((n,c)=>n+c.count,0),
    passes:window.__soulFxPhases||{},error:gl.getError()}),
  },
`);
const renderLoop=' requestAnimationFrame(render);';
const renderOpening=`function render(){
 if(window.pineStartup.failed)return;
`;
h=replace(h,renderOpening+renderLoop,renderOpening+' if(!window.__soulManual)requestAnimationFrame(render);');
const roll='function poiCompanionMonsterDefeated(o,s,now,debris,rng=Math.random){';
h=replace(h,roll,roll+'\n rng=()=>.01; // deterministically qualify a real fresh kill only');
h=replace(h,'function poiWildSpawnFrame(now,rng=Math.random){','function poiWildSpawnFrame(now,rng=Math.random){return;');
const draw="  if(typeof poiCompanionFxDraw==='function')poiCompanionFxDraw(now,p.vp);";
h=replace(h,draw,`
  const beforeFx=poiCompanionFxSnapshot(),captureFx=beforeFx?.stage==='gather'&&!window.__fxPixelCount;
  let withoutFx;
  if(captureFx){
   withoutFx=new Uint8Array(gl.drawingBufferWidth*gl.drawingBufferHeight*4);
   gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,withoutFx);
  }
  poiCompanionFxDraw(now,p.vp);
  if(withoutFx){
   const after=new Uint8Array(withoutFx.length);
   gl.readPixels(0,0,gl.drawingBufferWidth,gl.drawingBufferHeight,gl.RGBA,gl.UNSIGNED_BYTE,after);
   window.__fxPixelCount=0;
   for(let i=0;i<after.length;i+=4)
    if(Math.abs(after[i]-withoutFx[i])+Math.abs(after[i+1]-withoutFx[i+1])+Math.abs(after[i+2]-withoutFx[i+2])+Math.abs(after[i+3]-withoutFx[i+3])>16)window.__fxPixelCount++;
  }
  const visual=poiCompanionFxSnapshot();
  if(visual){
   const log=window.__soulFxPhases??={};
   log[visual.stage]??={...visual,x:poiWalkX,z:poiWalkZ,
    tokens:poiHotbarRead().slots.filter(c=>c?.type==='slimeSoul').reduce((n,c)=>n+c.count,0)};
  }
`);
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SOUL_FX_SYNTAX_ONLY){console.log('exact native fixture scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Soul FX QA</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await(await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75})).newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(origin+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',slots,gold:3,potions:0}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const cdp=await p.context().newCDPSession(p);
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
 await p.evaluate(()=>{window.__soulManual=true;window.__editorTest.soulFxQA.slimes()});
 const state=()=>p.evaluate(()=>window.__editorTest.soulFxQA.state());
 async function until(test,max=4400){
  let observation;
  for(let t=0;t<max;t+=38){
   await p.clock.fastForward(38);
   await p.evaluate(()=>window.__editorTest.soulFxQA.frame());
   observation=await state();
   if(test(observation))return observation;
  }
  throw Error('manual real draw did not reach phase: '+JSON.stringify(observation));
 }
 const q=await state();assert.deepEqual([q.x,q.z,q.tokens],[102,93,0]);
 const rect=await p.locator('#poiWalkAction').boundingBox();assert(rect);
 const pos={x:rect.x+rect.width/2,y:rect.y+rect.height/2,id:1};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[pos]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 let s=await until(v=>v.flight&&v.passes.fracture);
 assert.equal(s.passes.fracture.tokens,0,'pouch stays empty at captured fracture');
 assert.equal(s.passes.fracture.fragments>1,true);
 await p.keyboard.press('ArrowUp');
 await until(v=>v.z===92&&v.tokens===0);
 s=await until(v=>v.passes.flight);
 assert.equal(s.passes.flight.tokens,0,'first rendered orb has not awarded inventory');
 assert(s.passes.gather&&s.passes.silhouette&&s.passes.flight);
 assert(s.passes.flight.vertices<=120&&s.passes.flight.vertices>0);
 assert(await p.evaluate(()=>window.__fxPixelCount>20),'gather geometry changed actual framebuffer');
 s=await until(v=>v.tokens===1&&v.fx===null);assert.equal(s.z,92);assert.equal(s.error,0);assert.deepEqual(errors,[]);
 console.log('real walk and attack: reversing native debris, one traveling soul, durable token only after absorption');
}finally{await b?.close();server.close()}
