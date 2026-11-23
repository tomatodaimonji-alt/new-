import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/function poiTownDailyPlan\(/,'the native build includes the living-town planner');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const clockHook='function poiTownClockFrame(now){';
const testHook="  townResidents:()=>typeof poiTownResidentsSnapshot==='function'?poiTownResidentsSnapshot():null,";
// Hold only the simulation clock in this fixture. Residents still walk,
// animate, enter doors, and draw through the actual runtime.
const fixture=inject(inject(html,clockHook,clockHook+'if(window.__holdTownClock)return;'),testHook,testHook+`
  dailyLifeNativeQA:()=>{
   const p=parameters(),snapshot=poiTownResidentsSnapshot();
   return {clock:poiTownClockSnapshot(),actors:snapshot.actors.map(a=>{
    const b=a.visual,o=b&&poiWorldToScreen(p.vp,b.x+.5,terrainY(a.x,a.z)+a.y*1.4+.85,b.z+.5);
    return {id:a.id,x:a.x,z:a.z,y:a.y,recessed:a.recessed,activity:a.activity,visual:b,
     visible:!!o&&o.x>=0&&o.x<=canvas.clientWidth&&o.y>=0&&o.y<=canvas.clientHeight};
   })};
  },`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Town schedule fixture</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const roles={guildkeeper:[56,27,0],innkeeper:[41,30,0],diningkeeper:[31,36,0],workshopkeeper:[80,32,0],toolkeeper:[71,35,0],stablekeeper:[35,61,0]};
const point=a=>[a.x,a.z,a.y];
let browser,context,checkpoint='launch',page;
const errors=[];
async function load(minute){
 await page.goto(origin+'/seed');
 await page.evaluate(minute=>{
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:minute*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:45,z:41,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:.9,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 },minute);
 await page.goto(origin+'/?resume=1&test=1');
 await ready();
}
async function ready(){
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.__editorTest?.dailyLifeNativeQA().actors.length,
  null,{polling:50,timeout:10000});
}
const qa=()=>page.evaluate(()=>window.__editorTest.dailyLifeNativeQA());
const change=m=>page.evaluate(m=>window.__editorTest.setTownTime(m),m);
async function service(minute){
 checkpoint='service at '+minute;await load(minute);
 await page.waitForFunction(roles=>{
  const {actors}=window.__editorTest.dailyLifeNativeQA();
  return Object.entries(roles).every(([id,[x,z,y]])=>actors.some(a=>a.id===id&&!a.recessed&&a.activity==='work'&&a.x===x&&a.z===z&&a.y===y));
 },roles,{polling:50,timeout:11000});
}
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 context=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.75,isMobile:true,hasTouch:true});
 page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.__holdTownClock=true});
 await service(450); // 07:30, first minute of original public service.
 await service(1079); // 17:59, original closing edge not shortened.
 checkpoint='day visitor actually walks to the market';
 await load(715);
 const snapshot=await qa(),visitor=snapshot.actors.find(a=>a.id==='westpeddler');
 assert(visitor&&!visitor.recessed,'day visitor is an embodied resident before an errand');
 const start=point(visitor);assert.notDeepEqual(start,[52,44,0]);
 assert.equal(await change(850),true);
 await page.waitForFunction(([x,z,y])=>{
  const a=window.__editorTest.dailyLifeNativeQA().actors.find(a=>a.id==='westpeddler');
  return a?.visual&&(a.x!==x||a.z!==z||a.y!==y)&&(a.x!==52||a.z!==44||a.y!==0);
 },start,{polling:30,timeout:10000});
 await page.waitForFunction(()=>{
  const a=window.__editorTest.dailyLifeNativeQA().actors.find(a=>a.id==='westpeddler');
  return a?.activity==='market-browse'&&!a.recessed&&a.x===52&&a.z===44&&a.y===0;
 },null,{polling:50,timeout:16000});
 checkpoint='night public activity visible & deterministic across reload';
 await load(1240);
 async function evening(){
  await page.waitForFunction(()=>{
   const a=window.__editorTest.dailyLifeNativeQA().actors.find(a=>a.id==='nightporter');
   return a&&!a.recessed&&a.visible&&a.visual&&a.activity==="lamp-check"&&a.x===40&&a.z===39&&a.y===0;
  },null,{polling:50,timeout:9000});
  const {clock,actors}=await qa(),a=actors.find(a=>a.id==='nightporter');
  assert.equal(clock.minute,1240);
  assert(a.y===0&&a.x>=38&&a.x<=42&&a.z>=35&&a.z<=42,'real night porter is in the inn-side public area');
  assert(actors.some(a=>a.id==='northwatchworker'&&!a.recessed),'unrelated night gate duty still coexists');
  return [a.activity,...point(a)];
 }
 const eveningOne=await evening(); await page.reload();await ready();
 assert.deepEqual(await evening(),eveningOne,'cold reload at same time retains the actual night schedule');
 assert.deepEqual(errors,[]);
 console.log('PASS real town public hours, continuous day errand, visible night porter and stable reload');
}catch(e){console.error(checkpoint,JSON.stringify((page?await qa().catch(()=>null):null)),errors);throw e}
finally{await context?.close();await browser?.close();await new Promise(r=>server.close(r))}
