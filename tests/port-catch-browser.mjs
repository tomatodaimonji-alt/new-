import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const src=readFileSync(process.argv[2]??new URL('./world-editor.html',import.meta.url),'utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(src.split(anchor).length,2);
const html=src.replace(anchor,anchor+`
 portCatchQA:(run=false)=>{
  const get=id=>poiTownNpcActors.find(q=>q.role.id===id);
  const n=get('portfisher'),c=get('portfishseller');
  if(!n||!c||!poiWalkActive||facilitySite?.id!=='base')return null;
  const point=a=>[a.x,a.z,a.y];
  const state=()=>({webgl:!!gl&&!gl.isContextLost(),fish:poiTownNpcPurseRead()?.fish,clock:poiTownClockSnapshot(),
    neri:[point(n),n.activity],claire:[point(c),c.activity],gold:poiTownNpcPurseRead()?.issued});
  if(!run)return state();
  const start=performance.now()+32,route=new Set(),before=state();
  const player=localStorage.getItem(POI_HOTBAR_KEY);
  let stamp=start,caught=null,delivered=null,settledStart=null;
  // Boot RAFs can already have accrued a minute before this probe.
  // Observe the production continuity tracker (never seed/rewrite it).
  const beforeTracking=n.portFishing&&{minute:n.portFishing.minute,span:n.portFishing.span};
  for(let i=0;i<690;i++){
   stamp=start+i*48;
   const previousSpan=n.portFishing?.span??0;
   poiTownClockFrame(stamp);poiTownResidentsFrame(stamp);
   route.add(point(n).join(','));
   const clock=poiTownClockSnapshot().absoluteMinute,fish=poiTownNpcPurseRead()?.fish;
   if(n.activity==='fishing'&&n.x===77&&n.z===117&&poiTownNpcStepT(n,stamp)>=1&&settledStart===null)settledStart=clock;
   if(fish?.held===2&&caught===null){
    const accrual=n.portFishing;
    caught={clock,point:point(n),activity:n.activity,previousSpan,
      creditMinute:accrual?.minute,accrued:accrual?.span};
   }
   if(fish?.stall){delivered={clock,point:point(n),claire:point(c),activity:c.activity};break}
  }
  window.__portOffset=stamp-window.__portNow();poiTownClockSave(true);
  return {before,after:state(),settledStart,beforeTracking,caught,delivered,route:[...route],playerUnchanged:localStorage.getItem(POI_HOTBAR_KEY)===player};
 },
 `);
for(const [,js] of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))if(js.trim())new vm.Script(js);
if(process.argv.includes('--syntax-only')){console.log('PASS: injected exact port game parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Port catch setup</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser,page,checkpoint='boot';
const errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await ctx.addInitScript(()=>{
  window.__portNow=performance.now.bind(performance);window.__portOffset=0;
  performance.now=()=>window.__portNow()+window.__portOffset;
 });
 page=await ctx.newPage();const origin='http://127.0.0.1:'+server.address().port;
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2}');
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:420*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:84,z:115,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 const ready=async()=>{await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
  await page.waitForFunction(()=>window.__editorTest?.portCatchQA()?.webgl,null,{timeout:12000});};
 const talk=async()=>{
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?._talkActor?.role?.id==='portfishseller',null,{timeout:10000});
  await page.locator('#poiWalkAction').tap();
  await page.locator('#poiNpcMenu [data-npc-action="talk"]').tap();
  const line=page.locator('#poiMessagePanel [data-kind="dialogue"]');
  await line.waitFor({state:'visible',timeout:7000});
  const text=await line.textContent();
  assert.match(text,/ネリが届けてくれた魚があるよ。これはまだ売りに出してないよ。/);
  assert.doesNotMatch(text,/今朝|今日|新鮮/);
 };
 await page.goto(origin+'/?resume=1&test=1');await ready();
 checkpoint='live port activity and real handoff';
 const q=await page.evaluate(()=>window.__editorTest.portCatchQA(true));console.log('actual port catch',JSON.stringify(q));
 assert.deepEqual(q.before.fish,{day:-1,held:0,stall:0,total:0});
 assert(q.settledStart!==null&&q.caught!==null,'settled fishing and real stock credit observed');
 assert(q.caught.previousSpan<24&&q.caught.accrued===24,'stock arrived exactly at the production accrual threshold');
 assert.equal(q.caught.creditMinute,q.caught.clock);
 const trueStart=q.caught.creditMinute-q.caught.accrued;
 assert(trueStart<=q.settledStart,'production tracking starts no later than the first observed eligible frame');
 assert.deepEqual(q.caught.point,[77,117,0]);assert.equal(q.caught.activity,'fishing');
 assert(q.route.length>4&&q.delivered.clock>q.caught.clock);
 assert.deepEqual(q.delivered.point,[83,117,0]);assert.deepEqual(q.delivered.claire,[84,117,0]);assert.equal(q.delivered.activity,'fish-stall');
 assert.deepEqual(q.after.fish,{day:0,held:1,stall:1,total:2});
 assert.equal(q.after.gold,q.before.gold);assert.equal(q.playerUnchanged,true);
 checkpoint='actual Claire greeting and Talk';await talk();
 checkpoint='cold conserved stock and actual repeated Talk';await page.reload();await ready();
 assert.deepEqual((await page.evaluate(()=>window.__editorTest.portCatchQA())).fish,q.after.fish);
 await talk();assert.deepEqual(errors,[]);
 console.log('PASS: physical timed fishing and staffed consignment survive cold reload; actual Talk reports only held stock');
}catch(e){console.error(checkpoint,JSON.stringify(page?await page.evaluate(()=>window.__editorTest?.portCatchQA()).catch(()=>null):null),errors);throw e}
finally{await browser?.close();await new Promise(r=>server.close(r))}
