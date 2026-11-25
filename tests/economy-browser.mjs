import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const src=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(src.split(anchor).length,2);
const html=src.replace(anchor,anchor+`
 economyQA:(phase)=>{
  const a=poiTownNpcActors.find(x=>x.role.id==='resadventurer');
  const cook=poiTownNpcActors.find(x=>x.role.id==='towncook');
  const host=poiTownNpcActors.find(x=>x.role.id==='innkeeper');
  if(!a||!cook||!host)return null;
  const record=()=>({purse:poiTownNpcPurseRead(),actor:poiTownNpcStatus(a).coins,
   host:poiTownNpcStatus(host).coins,cook:poiTownNpcStatus(cook).coins,hp:a.hp,room:a.bedId});
  if(phase!=='play')return record();
  const clock={minute:730,absoluteMinute:730},now=performance.now()+50;
  const place=(actor,p)=>Object.assign(actor,p,{actorLeg:null,fromX:p.x,fromZ:p.z,fromY:p.y,path:null,nextPlan:0,goal:null,moveAt:-1000});
  // Isolate two real lethal contacts before testing the actual paid bed/food pathways.
  place(a,{x:45,z:72,y:0,facing:1});
  for(let n=0;n<2;n++){
   const mob={type:'monsterSlime',x:46,z:72,y:0};
   const state={x:46,z:72,hp:1,townOwned:true,townHunt:a.role.id};
   poiMonsterStates.set(mob,state);a.target=mob;a.hitAt=now+n;
   poiTownNpcResolve(a,now+n);
  }
  const earned=record();
  place(host,host.role.work);host.activity='work';
  place(a,POI_TOWN_INN.desk);a.hp=60;a.bedId=null;a.restUntil=null;
  const prior=poiTownNpcBook;
  poiTownNpcBook={bedId:'inn-south',until:1440};
  poiTownNpcRoutine(a,clock,now+50,{plans:2});
  const protectedRoom={bed:a.bedId,coins:a.coins,playerBed:poiTownNpcBook?.bedId};
  poiTownNpcBook=prior;
  const walk=(actor,t0,done)=>{
   const path=new Set();
   for(let tick=0;tick<880;tick++){
    const t=t0+tick*48;
    if(actor.actorLeg)poiTownNpcActorRun(actor,t,poiTownNpcGraph());
    path.add(actor.x+','+actor.z+','+actor.y);
    if(tick%8===0)poiTownNpcRoutine(actor,clock,t,{plans:2});
    if(done())return {path:[...path],at:t,done:true};
   }
   return {path:[...path],at:t0+880*48,done:false};
  };
  const lodging=walk(a,now+100,()=>a.hp===100&&a.coins===0);
  const afterBed=record();
  place(cook,POI_NPC_FOOD_KITCHEN);cook.recessed=false;cook.npcFoodTrip=false;
  const food=walk(cook,lodging.at+500,()=>poiTownNpcPurseRead()?.food.inn===4);
  return {earned,protectedRoom,lodging,afterBed,food,final:record()};
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
  await page.waitForFunction(()=>window.__editorTest?.economyQA(),null,{timeout:12000});};
 await page.goto(origin+'/?resume=1&test=1');await ready();
 const report=await page.evaluate(()=>window.__editorTest.economyQA('play'));
 console.log('physical trade outcome',JSON.stringify(report));
 assert.equal(report.earned.actor,6);
 assert.deepEqual(report.protectedRoom,{bed:null,coins:6,playerBed:'inn-south'});
 assert(report.lodging.done&&report.lodging.path.includes('40,30,1'));
 assert.deepEqual([report.afterBed.actor,report.afterBed.host,report.afterBed.hp],[0,6,100]);
 assert(report.food.done&&report.food.path.includes('42,31,0'));
 for(const gate of ['28,40,0','33,39,0','41,33,0'])assert(report.food.path.includes(gate),gate);
 assert.deepEqual([report.final.actor,report.final.host,report.final.cook,report.final.purse.issued],[0,2,4,6]);
 assert.deepEqual(report.final.purse.food,{inn:4,supplier:6,day:0});
 await page.reload();await ready();
 const again=await page.evaluate(()=>window.__editorTest.economyQA());
 assert.deepEqual([again.actor,again.host,again.cook],[0,2,4]);
 assert.deepEqual(again.purse.food,report.final.purse.food);
 assert.deepEqual(errors,[]);
 console.log('PASS: earned funds pay for a physical inn stay and kitchen delivery with same conserved cold-save currency');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
