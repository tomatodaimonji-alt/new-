import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const src=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(src.split(anchor).length,2);
const html=src.replace(anchor,anchor+`

 loopQA:(phase)=>{
  const get=id=>poiTownNpcActors.find(x=>x.role.id===id);
  const traveler=get('northtraveler'),courier=get('westbasketweaver'),cook=get('towncook'),host=get('innkeeper'),clerk=get('guildkeeper');
  if(!traveler||!courier||!cook||!host||!clerk)return null;
  if(phase!=='run')return poiTownNpcPurseRead();
  const before=poiTownNpcPurseRead();
  Object.assign(before,{issued:10,innkeeper:6,towncook:4});
  Object.assign(before.food,{inn:3,supplier:6,eaten:1,northMeal:0,day:0});
  if(!poiTownNpcPurseSave(before))throw Error('isolated ledger fixture cannot seed');
  const place=(a,p)=>Object.assign(a,p,{actorLeg:null,fromX:p.x,fromZ:p.z,fromY:p.y,path:null,nextPlan:0,goal:null,moveAt:-1000,recessed:false});
  const work=a=>{place(a,a.role.work);a.activity='work'};
  work(host);work(clerk);work(cook);place(traveler,traveler.role.work);
  const origin=performance.now()+50;
  const mealClock={minute:840,absoluteMinute:2280};
  let target=false,path=new Set();
  for(let i=0;i<700;i++){
   const at=origin+i*48;
   if(traveler.actorLeg)poiTownNpcActorRun(traveler,at,poiTownNpcGraph());
   path.add(traveler.x+','+traveler.z+','+traveler.y);
   if(i%8===0)poiTownNpcInnMeal(traveler,mealClock,at,{plans:2});
   if(poiTownNpcPurseRead().food.inn===2){target=true;break}
  }
  if(!target)throw Error('no actual meal '+JSON.stringify([...path]));
  const meal=poiTownNpcPurseRead(),setupLang={host:poiTownNpcStatus(host).coins,cook:poiTownNpcStatus(cook).coins};
  place(courier,courier.role.work);courier.gatewayStep=2;courier.npcProcAuthorized=null;
  place(traveler,traveler.role.work);
  const elapsed=origin+700*48+1000,route=new Set(),phases=new Set();
  let last;
  for(let i=0;i<1360;i++){
   const at=elapsed+i*48,min=590+Math.floor(i*48/500),clock={minute:min,absoluteMinute:2880+min};
   route.add(courier.x+','+courier.z+','+courier.y);
   if(courier.actorLeg)poiTownNpcActorRun(courier,at,poiTownNpcGraph());
   if(i%8===0)poiTownNpcRoutine(courier,clock,at,{plans:2});
   const l=poiTownNpcPurseRead();
   if(l.order)phases.add('funded');
   if(l.order?.claim)phases.add('claimed');
   if(l.order?.picked)phases.add('picked');
   if(l.food.inn===4){last=min;break}
  }
  return {meal,mealPath:[...path],route:[...route],phases:[...phases],last,
   after:poiTownNpcPurseRead(),shown:[poiTownNpcStatus(host).coins,poiTownNpcStatus(cook).coins],setupLang};
 },
 `);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<title>Seed</title>':html);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[],origin='http://127.0.0.1:'+server.address().port;
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":365000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:50,z:43,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:.37,orbitPitch:.24,orbitDistance:5.5}}));
 });
 const ready=async()=>{await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(()=>window.__editorTest?.loopQA(),null,{timeout:12000});};
 await page.goto(origin+'/?resume=1&test=1');await ready();

 const report=await page.evaluate(()=>window.__editorTest.loopQA('run'));
 console.log('real guild food loop',JSON.stringify(report));
 assert(report.mealPath.includes('41,33,0')&&report.mealPath.includes('43,31,0'));
 assert.deepEqual([report.meal.food.inn,report.meal.food.eaten],[2,2]);
 assert.deepEqual(report.phases,['funded','claimed','picked']);
 for(const marker of ['42,31,0','56,29,0','27,42,0'])assert(report.route.includes(marker),marker);
 assert(Number.isFinite(report.last)&&report.last<720,JSON.stringify(report));
 assert.deepEqual(report.shown,[2,8]);
 assert.deepEqual([report.after.issued,report.after.food.inn,report.after.food.supplier,report.after.food.eaten,report.after.order],[10,4,4,2,null]);
 await page.reload();await ready();
 const fresh=await page.evaluate(()=>window.__editorTest.loopQA());
 assert.deepEqual(fresh.food,report.after.food);assert.equal(fresh.order,null);
 assert.deepEqual(errors,[]);
 console.log('PASS: real meal, Guild approval, actual claimed delivery and exact stock persistence');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
