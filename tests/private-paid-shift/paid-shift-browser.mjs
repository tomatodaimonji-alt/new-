import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const source=readFileSync(process.argv[2]??new URL('./world-editor.html',import.meta.url),'utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(source.split(anchor).length,2,'frozen editor test anchor');
const html=source.replace(anchor,anchor+`
 paidShiftQA:(run=false)=>{
  const get=id=>poiTownNpcActors.find(a=>a.role.id===id);
  const yuris=get('resadventurer'),marta=get('diningkeeper'),ines=get('towncook');
  if(facilitySite?.id!=='base'||!poiWalkActive||!yuris||!marta||!ines)return null;
  const state=()=>({
   webgl:!!gl&&!gl.isContextLost()&&String(gl.getParameter(gl.VERSION)).startsWith('WebGL'),
   clock:poiTownClockSnapshot(),purse:poiTownNpcPurseRead(),
   actors:[yuris,marta,ines].map(a=>({id:a.role.id,x:a.x,z:a.z,y:a.y,activity:a.activity,coins:poiTownNpcStatus(a).coins,hp:a.hp})),
   herb:poiTownNpcStatus(yuris).herbs
  });
  if(!run)return state();
  const before=state(), route=new Set(), writes=localStorage.getItem(POI_HOTBAR_KEY);
  const start=performance.now()+40;
  let after=before;
  for(let i=0;i<800;i++){
   const now=start+i*48;
   // Real shared clock schedules every resident. No teleports, no manual
   // role activity and no direct sale API. Each production motion frame
   // is exercised; we only omit repeated expensive GPU presentation.
   poiTownClockFrame(now);
   poiTownResidentsFrame(now);
   route.add(yuris.x+','+yuris.z+','+yuris.y);
   if(i%8!==0)continue;
   after=state();
   if(after.purse.shift.served||after.clock.minute>=985)break;
  }
  return {before,after,path:[...route],playerUnchanged:localStorage.getItem(POI_HOTBAR_KEY)===writes};
 },
 `);
for(const [,js] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))if(js.trim())new vm.Script(js);
if(process.argv.includes('--syntax-only')){
 console.log('PASS: exact injected complete game script parses');process.exit(0);
}
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Paid shift fixture</title>':html);
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
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:914*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:50,z:43,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:.37,orbitPitch:.24,orbitDistance:5.5}}));
  // The staged world has five previous +3G kills and one genuine 6G herb
  // purchase. This is the transaction's only seeded history; no sale,
  // wage, worker state, served portion or XP is inserted by the fixture.
  localStorage.setItem('world-workshop-base-npc-purse-v1',JSON.stringify({version:1,issued:15,
   guestadventurer:{coins:0,herbs:0,night:-1},resadventurer:{coins:9,herbs:1,night:-1},
   toolkeeper:6,innkeeper:0,towncook:0,food:{inn:2,supplier:8,day:-1,eaten:0,northMeal:-1},procDay:-1,procSerial:0,order:null}));
 });
 const ready=async()=>{
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(()=>window.__editorTest?.paidShiftQA()?.webgl,null,{timeout:12000});
 };
 await page.goto(origin+'/?resume=1&test=1');await ready();
 const report=await page.evaluate(()=>window.__editorTest.paidShiftQA(true));
 console.log('actual paid restaurant shift',JSON.stringify(report));
 const {before,after}=report;
 assert.equal(before.webgl&&after.webgl,true);
 assert.deepEqual(before.actors.map(a=>a.coins),[9,0,0]);
 assert.deepEqual(after.actors.map(a=>a.coins),[6,2,1],'real existing NPC status values');
 const [buyer,marta,ines]=after.actors;
 assert.deepEqual([buyer.x,buyer.z,buyer.y],[32,38,0]);
 assert.deepEqual([marta.x,marta.z,marta.y,ines.x,ines.z,ines.y],[31,36,0,26,42,0]);
 assert.equal(marta.activity,'work');assert.equal(ines.activity,'work');
 assert(report.path.some(mark=>['33,39,0','31,41,0'].includes(mark)),'a real dining door crossed');
 assert(report.path.length>=15,'not placed at the staffed counter');
 assert.equal(after.herb,before.herb);assert.equal(buyer.hp,before.actors[0].hp);
 assert.equal(report.playerUnchanged,true);
 assert.deepEqual([after.purse.issued,after.purse.food.supplier,after.purse.food.inn,after.purse.shift.served,after.purse.shift.xp],[15,7,2,1,1]);
 await page.reload();await ready();
 const cold=await page.evaluate(()=>window.__editorTest.paidShiftQA());
 assert.deepEqual(cold.purse,after.purse);assert.deepEqual(cold.actors.map(a=>a.coins),[6,2,1]);assert.equal(cold.herb,1);
 assert.deepEqual(errors,[]);
 console.log('PASS: staffed meal sale, real wage and cooking experience persist once');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
