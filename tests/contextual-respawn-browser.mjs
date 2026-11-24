import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const install=(a,b)=>{assert.equal(h.split(a).length,2,a);h=h.replace(a,b)};
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";


install(mark,`
 window.__deathArea={
  frame:()=>render(),
  save:()=>workshopResumeWrite(),
  lethal:()=>{
   poiPlayerHP=1;
   return poiMobHitPlayer({type:'monsterSlime',y:poiWalkLevel},performance.now(),100);
  },
  state:()=>{
   const save=JSON.parse(localStorage.getItem('world-workshop-resume-v1'));
   return {now:performance.now(),p:[poiWalkX,poiWalkZ,poiWalkLevel,poiWalkFacing],id:facilitySite?.id,
    home:facilitySite?.spawn,snowPending:poiSnowPassPending,hp:poiPlayerHP,
    save,death:poiPlayerDeathSnapshot(),entered:poiDefeatEntry?.area??null};
  }
 }; `+mark);
install(' requestAnimationFrame(render);',' if(!window.__finishManual)requestAnimationFrame(render);');
for(const [,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.DEFEAT_AREA_PARSE_ONLY){console.log('Exact defeat-area browser fixture parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<title>Seed</title>':h)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));
const root='http://127.0.0.1:'+srv.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const mode of ['home','mine','chapel','snow','snow-old','snow-corrupt']){
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(20000);
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
  const seeds={home:{x:115,z:66,y:0},mine:{x:116,z:63,y:0},chapel:{x:124,z:82,y:0},snow:{x:49,z:127,y:0},
   'snow-old':{x:12,z:5,y:0},'snow-corrupt':{x:88,z:77,y:0}};
  await p.goto(root+'/seed');await p.evaluate(({mode,position})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
   version:1,route:'facility',id:'base',play:true,position:{...position,facing:2},...(mode==='snow-old'||mode==='snow-corrupt'?{region:'snowpass',regionHp:100}:{}),townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}
  })),{mode,position:seeds[mode]});
  await p.goto(root+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+150));
  await p.evaluate(()=>{window.__finishManual=true});


  const qa=()=>p.evaluate(()=>window.__deathArea.state()),frame=async(ms=120)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__deathArea.frame());};
  const until=async(check,limit=25)=>{let q=await qa();for(let i=0;i<limit&&!check(q);i++){await frame();q=await qa()}assert(check(q),JSON.stringify(q));return q};
  const step=async key=>{await p.keyboard.press(key);for(let i=0;i<4;i++)await frame();return qa()};
  if(mode==='mine'){
   await step('ArrowUp');await until(q=>q.p[2]===-1);
   await step('ArrowUp');await step('ArrowUp');
  }
  if(mode==='chapel'){
   await step('ArrowUp');await until(q=>q.p[2]===-1);
   await step('ArrowUp');
  }
  if(mode==='snow'){
   await step('ArrowDown');await until(q=>q.id==='snowpass'&&!q.snowPending);await step('ArrowDown');await step('ArrowDown');
  }
  const before=await qa();assert.equal(before.id,mode==='snow'||mode==='snow-old'?'snowpass':'base',mode);
  if(mode==='snow')assert.equal(before.entered,'region:snowpass');
  if(mode==='mine'||mode==='chapel')assert.equal(before.entered,mode);
  if(mode==='snow-old'||mode==='snow-corrupt')assert.equal(before.entered,null);
  assert(await p.evaluate(()=>window.__deathArea.lethal()));
  const dead=await qa();assert.equal(dead.hp,0);assert.equal(dead.death?.opacity,0);
  const want=mode==='mine'?[116,61,-1]:mode==='chapel'?[78,88,-1]:
   mode==='snow'||mode==='snow-old'?[12,0,0]:[before.home.x,before.home.z,0];
  await p.evaluate(()=>window.__deathArea.save());
  const during=await qa();
  assert.deepEqual([during.save.position.x,during.save.position.z,during.save.position.y],want);
  if(mode==='snow'||mode==='snow-old')assert(during.save.regionHp>0);
  const end=await until(s=>s.death?.relocated);
  assert.deepEqual(end.p.slice(0,3),want,JSON.stringify({mode,before,end}));
  assert(end.hp>0&&end.death.blackAt-dead.death.start>=1650);
  assert.deepEqual([end.save.position.x,end.save.position.z,end.save.position.y],want);
  assert.equal(end.save.region,mode==='snow'||mode==='snow-old'?'snowpass':undefined);
  const cleared=await until(q=>!q.death);assert.deepEqual(cleared.p,end.p);
  assert.deepEqual(errors,[]);
  console.log('Actual contextual death',mode,JSON.stringify({from:before.p,to:end.p,region:end.save.region??null,delay:end.death.blackAt-dead.death.start}));
  await ctx.close();
 }
}finally{await browser?.close();await new Promise(r=>srv.close(r))}
