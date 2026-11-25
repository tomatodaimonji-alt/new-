import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const src=readFileSync(process.argv[2]??new URL('./world-editor.html',import.meta.url),'utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(src.split(anchor).length,2);
const html=src.replace(anchor,anchor+`
 scoutReportQA:(run=false)=>{
  const a=poiTownNpcActors.find(q=>q.role.id==='northscout');
  if(!a||facilitySite?.id!=='base'||!poiWalkActive)return null;
  const state=()=>({gl:!!gl&&!gl.isContextLost(),pos:[a.x,a.z,a.y],minute:poiTownClockSnapshot().minute,
    report:poiTownScoutReport(poiTownClockSnapshot()),dialogue:poiTownDialogueSnapshot()});
  if(!run)return state();
  const start=performance.now()+32,visited=new Set();let stamp=start,first=null;
  for(let i=0;i<2450;i++){
   stamp=start+i*128;
   poiTownClockFrame(stamp);
   if(a.actorLeg)poiTownNpcActorRun(a,stamp,poiTownNpcGraph());
   const clock=poiTownClockSnapshot();
   if(i%3===0)poiTownDutyRoutine(a,clock,stamp,{plans:2});
   if(a.x===a.role.work.x&&a.z===a.role.work.z&&poiTownNpcStepT(a,stamp)===1)visited.add('camp');
   if(a.x===a.role.gate.x&&a.z===a.role.gate.z)visited.add('gate');
   if(first===null&&a.northReport?.leg===8)first={m:clock.minute,pos:[a.x,a.z,a.y]};
   if(clock.minute>=1010)break;
  }
  // Keep RAF, controls and renderer on the same production time line
  // once the accelerated patrol window ends; no motion state is changed.
  window.__scoutOffset=stamp-window.__scoutRealNow();
  poiTownClockSave(true);
  return {...state(),first,visited:[...visited]};
 },
 `);
for(const [,js] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))if(js.trim())new vm.Script(js);
if(process.argv.includes('--syntax-only')){console.log('PASS: exact injected scout app parsed');process.exit(0)}
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed route</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page,checkpoint='launch';
const errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await ctx.addInitScript(()=>{
  window.__scoutRealNow=performance.now.bind(performance);window.__scoutOffset=0;
  performance.now=()=>window.__scoutRealNow()+window.__scoutOffset;
 });
 page=await ctx.newPage();const origin='http://127.0.0.1:'+server.address().port;
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2}');
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:450*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:34,z:31,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 const ready=async()=>{
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(()=>window.__editorTest?.scoutReportQA()?.gl,null,{timeout:12000});
 };
 const actualTalk=async()=>{
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?._talkActor?.role?.id==='northscout',null,{timeout:10000});
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiNpcMenu [data-npc-action="talk"]').tap();
  const line=page.locator('#poiMessagePanel [data-kind="dialogue"]');
  await line.waitFor({state:'visible',timeout:7000});
  const text=await line.textContent();
  assert.match(text,/今日は北門から野営地まで往復した。砦の中までは見ていない。/);
  assert.doesNotMatch(text,/安全|敵はいない/);
 };
 checkpoint='actual briefing, outbound, return';await page.goto(origin+'/?resume=1&test=1');await ready();
 assert.equal((await page.evaluate(()=>window.__editorTest.scoutReportQA())).report,null);
 const result=await page.evaluate(()=>window.__editorTest.scoutReportQA(true));
 console.log('actual scout report timing',JSON.stringify(result));
 assert(result.visited.includes('gate')&&result.visited.includes('camp'));
 assert.deepEqual(result.first?.pos,[34,30,0]);assert(result.first.m>=900&&result.first.m<1010);
 checkpoint='real scout greeting and Talk';await actualTalk();
 checkpoint='cold world still exposes the actual stored report';await page.reload();await ready();await actualTalk();
 assert.deepEqual(errors,[]);
 console.log('PASS: physical scout round trip and exact honest Talk text survive a cold world');
}catch(e){console.error(checkpoint,JSON.stringify(page?await page.evaluate(()=>window.__editorTest?.scoutReportQA()).catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r));}
