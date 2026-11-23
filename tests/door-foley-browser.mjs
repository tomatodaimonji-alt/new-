import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const audio='function poiSound(kind,weapon=null,defeated=false,atContact=false){',random=' const p=poiWildPick(rng);';
const played=' poiPlayImpactBuffer(poiRecordedFoley(id),when,level);';
const clip='function poiTryRecordedFoley(id,when,level){';
const inject=(h,anchor,extra)=>{assert.equal(h.split(anchor).length,2);return h.replace(anchor,anchor+extra);};
const fixture=inject(inject(inject(html,audio,"\n if(window.__doorQACues&&kind.startsWith('door-'))window.__doorQACues.push([kind,weapon]);"),
 clip,`
 window.__recordedQAPlay=(...args)=>poiSound(...args);
 `),
 played,`
 if(window.__recordedQACues){
  const buf=poiRecordedFoley(id);
  window.__recordedQACues.push({id,ms:Math.round(buf.duration*1000),rate:buf.sampleRate,channels:buf.numberOfChannels,level});
 }
 `)
 .replace(random,' const p=null;');
assert.equal(html.split(random).length,2);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":2,"gold":18,"claimedCaches":["glade"]}';
let browser,ctx;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
 ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.addInitScript(()=>{window.__doorQACues=[];window.__recordedQACues=[]});
 await page.goto(origin+'/seed');
 await page.evaluate(({kit,kitKey,resumeKey})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:41,z:34,y:0,facing:0},
   townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,
    orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{kit,kitKey,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 const cues=()=>page.evaluate(()=>window.__doorQACues);
 const pos=()=>page.evaluate(()=>window.__editorTest.facility().position);
 const closed=await page.evaluate(()=>window.__editorTest.data().world.some(o=>o.x===41&&o.z===33&&o.y===0&&o.type.endsWith('Door')));
 assert(closed,'actual inn threshold is an authored closed leaf');
 async function step(key,z){
  await page.keyboard.press(key);
  await page.waitForFunction(z=>window.__editorTest.facility().position.z===z,z);
  assert.deepEqual(await pos(),{x:41,z,level:0});
  await page.waitForTimeout(250);
 }
 assert.deepEqual(await pos(),{x:41,z:34,level:0});
 assert.deepEqual(await cues(),[],'startup cannot produce a hypothetical sound');
 await step('ArrowUp',33);
 assert.deepEqual(await cues(),[['door-open','wood']],'standing at the threshold does not repeatedly play');
 await step('ArrowUp',32);
 assert.deepEqual(await cues(),[['door-open','wood'],['door-close','wood']]);
 await step('ArrowDown',33);await step('ArrowDown',34);
 assert.deepEqual(await cues(),[['door-open','wood'],['door-close','wood'],['door-open','wood'],['door-close','wood']]);
 const recordings=()=>page.evaluate(()=>window.__recordedQACues);
 const ids=async()=> (await recordings()).map(c=>c.id);
 assert.deepEqual(await ids(),['doorOpen','doorClose','doorOpen','doorClose'],'actual above-ground threshold starts real cached recorded audio, once per physical transition');
 await page.evaluate(()=>{
  // The actual WebAudio events are invoked through the production routing API
  // in the active hosted game; the native physical door step above is not injected.
  const invoke=window.__recordedQAPlay;
  invoke('attack','equipIronSword');
  invoke('hit','kitchenKnife',false,true);
  invoke('attack','equipWoodSpear');
  invoke('hit','equipWoodSword',false,true);
  invoke('item-pickup','coin');
  invoke('item-pickup','healingHerb');
  invoke('chest-pickup','healingHerb');
 });
 assert.deepEqual(await ids(),['doorOpen','doorClose','doorOpen','doorClose','steelSwing','steelImpact','itemPickup','itemPickup']);
 assert.deepEqual((await recordings()).map(c=>c.ms),[500,270,500,270,328,547,425,425]);
 for(const c of await recordings()){
  assert.equal(c.rate,24000);assert.equal(c.channels,1);
  assert.ok(c.level>.5&&c.level<.8);
 }
 assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
 assert.deepEqual(errors,[]);
 console.log('PASS physical inn passage plays distinct recorded hinge and latch; live decoded steel and noncoin pickup route to the same effects mixer');
}finally{await ctx?.close();await browser?.close();await new Promise(r=>server.close(r))}
