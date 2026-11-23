import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
assert.equal(html.split(anchor).length,2,'unique nearby gameplay test API anchor');
const fixture=html.replace(anchor,anchor+`
  northDutyQA:(id)=>{
   const v=poiTownResidentsSnapshot(),a=v.actors.find(a=>a.id===id);
   const body=a?.visual,point=body&&poiWorldToScreen(parameters().vp,body.x+.5,terrainY(a.x,a.z)+a.y*1.4+.8,body.z+.5);
   return {actor:a,visible:!!point&&point.x>=0&&point.x<=canvas.clientWidth&&point.y>=0&&point.y<=canvas.clientHeight,
    dialogue:v.dialogue,position:{x:poiWalkX,z:poiWalkZ,y:poiWalkLevel},party:v.actors.filter(a=>a.id.startsWith('north')).map(a=>[a.id,a.recessed,a.activity])};
  },`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Town duty QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Town duty browser stalled at '+checkpoint);process.exit(1)},65000);
const cases=[
 {id:'northwatchworker',name:'エダ',minute:0,player:[33,24,3],place:[32,24,0],label:'night-watch',other:'northgatekeeper'},
 {id:'northgatekeeper',name:'オルン',minute:12*60,player:[35,23,1],place:[36,23,0],label:'gate-watch',other:'northwatchworker'},
 {id:'northscout',name:'フィン',minute:11*60,player:[66,2,1],place:[67,2,0],label:'scout-camp',speech:/古い砦/}
];
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const c of cases){
  checkpoint=c.id+': real-time landscape boot';
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
  const state=()=>p.evaluate(id=>window.__editorTest?.northDutyQA(id),c.id);
  try{
   await p.goto(origin+'/seed');
   await p.evaluate(({minute,player:[x,z,facing]})=>{
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
    // Set the ordinary saved clock before launch; the real resident
    // scheduler and native WebGL draw run with no injected movement.
    localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:(24*60+minute)*500}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x,z,y:0,facing},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },c);
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'),null,{polling:40,timeout:6000});
   checkpoint=c.id+': embodied role on duty';
   await p.waitForFunction(({id,label,place:[x,z,y]})=>{
    const s=window.__editorTest.northDutyQA(id),a=s.actor;
    return s.visible&&a?.activity===label&&!a.recessed&&a.x===x&&a.z===z&&a.y===y&&a.visual;
   },c,{polling:40,timeout:6500});
   const s=await state();
   assert.deepEqual([s.position.x,s.position.z,s.position.y],[c.player[0],c.player[1],0]);
   assert.equal(s.actor.name,c.name);
   assert(Math.hypot(s.actor.visual.x-c.place[0],s.actor.visual.z-c.place[1])<=.08,'actual actor draw is at the authored stand');
   if(c.other)assert(s.party.some(([id,recessed])=>id===c.other&&recessed),'the opposite shift did not get a phantom duplicate');
   if(c.speech){
    checkpoint=c.id+': talk to actual scout';
    await p.locator('#poiWalkAction').tap();
    await p.waitForFunction(id=>window.__editorTest.northDutyQA(id).dialogue?.id===id,c.id,{polling:40,timeout:4500});
    const i=await state();assert.match(i.dialogue.text,c.speech,'scout gives the real fort clue at camp');
   }
   assert.deepEqual(errors,[]);
   console.log('PASS '+c.id+' embodied '+c.label+' at '+c.place.join(','));
  }catch(e){console.error(checkpoint,JSON.stringify(await state().catch(()=>null)),errors);throw e}
  finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
