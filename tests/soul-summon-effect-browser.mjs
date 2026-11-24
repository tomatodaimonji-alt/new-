import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const ins=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
ins(api,api+`
 summonEffect:{
  frame:()=>render(),
  state:()=>{
   const a=poiCompanionActor,now=performance.now(),e=poiCompanionSummonEvent,k=poiHotbarRead();
   return {active:k.companionSoul?.active??null,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,now,exists:!!a,
    species:a?.id??null,hp:poiInventorySlots(k).find(c=>c?.type==='orvasSoul')?.durability??null,
    scale:a?poiCompanionWorldPose(a,now).scale:null,alpha:a?poiCompanionSummonOpacity(a,now):1,
    at:e?{x:e.x,z:e.z,height:e.height,start:e.start}:null,
    gl:window.__summonDraw??[],fade:window.__summonFade??[],audio:window.__summonAudio??[],
    dirs:['n','s','e','w'].map(k=>poiCameraRelativeStep(k))};
  }
 },
`);
ins(' requestAnimationFrame(render);',' if(!window.__summonManual)requestAnimationFrame(render);');
ins('try{gl.blendColor(0,0,0,alpha);draw(poiCompanionSummonGpu,q);}',
 'try{gl.blendColor(0,0,0,alpha);draw(poiCompanionSummonGpu,q);(window.__summonDraw??=[]).push({count:poiCompanionSummonGpu.count,age,alpha,r});}');
ins('try{gl.blendColor(0,0,0,summon);draw(poiCompanionMesh,vp);}',
 'try{gl.blendColor(0,0,0,summon);draw(poiCompanionMesh,vp);(window.__summonFade??=[]).push({alpha:summon,n:poiCompanionMesh.count});}');
ins(' poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));',`
 poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));
 if(buffer===poiCompanionSummonPcm)(window.__summonAudio??=[]).push({time:when,state:source.context.state,duration:buffer.duration,cap,
  connected:gain.context===poiAudioEffects.context,loop:source.loop});
`);
ins('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.SUMMON_PARSE_ONLY){console.log('Native summon fixture syntax valid');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((r,s)=>{s.setHeader('Content-Type','text/html; charset=utf-8');s.end(r.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--autoplay-policy=no-user-gesture-required','--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 async function load(active){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(url+'/seed');await p.evaluate(active=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:887};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,slots,potions:0,
    ...(active?{companionSoul:{version:1,active:'orvasSoul',mode:'fight'}}:{})}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:102,z:93,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1}));
  },active);
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  await p.clock.install();await p.clock.pauseAt(await p.evaluate(()=>Date.now()+200));
  await p.evaluate(()=>{window.__summonManual=true;});
  const tick=async(ms=35)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.summonEffect.frame());return read();};
  const read=()=>p.evaluate(()=>window.__editorTest.summonEffect.state());
  return {ctx,p,tick,read,errors};
 }
 let q=await load(false),p=q.p,s=await q.tick();
 const slot=p.locator('#poiHotbar [data-hotbar-slot="1"]'),confirm=p.locator('#poiCompanionCommands [data-companion-command="summon"]');
 const noEffect=s=>!s.at&&!s.gl.length&&!s.fade.length&&!s.audio.length;
 assert(noEffect(s));await slot.tap();
 assert.equal(await confirm.textContent(),'オルヴァスを呼ぶ');
 s=await q.tick();assert(noEffect(s)&&!s.exists);
 await p.locator('#poiCompanionCommands [data-companion-command="back"]').tap();
 s=await q.tick();assert(noEffect(s)&&!s.exists);
 await slot.tap();await confirm.tap();
 s=await q.tick();
 assert(s.at&&s.scale===1&&s.hp===887&&s.alpha<.15,JSON.stringify(s));
 const at=s.at,{x,z}=s;
 const dir=s.dirs.findIndex(v=>v[0]===1&&v[1]===0);
 assert(dir>=0);await p.keyboard.press(['ArrowUp','ArrowDown','ArrowRight','ArrowLeft'][dir]);
 s=await q.tick(185);
 assert.equal(Math.abs(s.x-x)+Math.abs(s.z-z),1,"one trusted movement step during the fade");assert.deepEqual(s.at,at);
 assert(s.gl.length>=2&&s.gl.at(-1).r>s.gl[0].r&&s.gl.at(-1).count>150);
 assert(s.fade.length>=2&&s.fade.at(-1).alpha>s.fade[0].alpha);
 assert.equal(s.audio.length,1);assert(s.audio[0].state==='running'&&s.audio[0].connected&&!s.audio[0].loop&&s.audio[0].duration<.60,JSON.stringify(s.audio));
 s=await q.tick(680);assert(!s.at&&s.exists&&s.alpha===1&&s.audio.length===1);
 const draws=s.gl.length;await q.tick(180);assert.equal((await q.read()).gl.length,draws);
 assert.deepEqual(q.errors,[]);await q.ctx.close();
 q=await load(true);s=await q.tick(150);
 assert(s.active==='orvasSoul'&&s.exists&&s.alpha===1&&s.hp===887&&noEffect(s),JSON.stringify(s));
 assert.deepEqual(q.errors,[]);await q.ctx.close();
 console.log('Native explicit summon: single running SE, truly advancing ring and actor fade, walking preserved, cancel/cold save inert');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
