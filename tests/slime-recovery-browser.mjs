import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor='function poiEnemyCancelPlayer(){';
assert.equal(html.split(anchor).length,2);
const drawAnchor=' const p=parameters();';
assert.equal(html.split(drawAnchor).length,2);
const hitAnchor='  const timely=now-a.hit<poiEnemyContactTolerance(a);';
assert.equal(html.split(hitAnchor).length,2);
const fixture=html
 .replace(drawAnchor,drawAnchor.replace(' const p=parameters();',' if(window.__timingOnlySlimeFixture)return;\n const p=parameters();'))
 .replace(hitAnchor,hitAnchor+'\n  if(window.__observeSlimeResolve)window.__observeSlimeResolve(a,now,timely);')
 .replace(' const p=poiWildPick(rng);',' const p=null;').replace(anchor,`
let __recoveryFixture;
window.__observeSlimeResolve=(attack,now,timely)=>{
 if(__recoveryFixture?.first===attack)__recoveryFixture.resolved={now,timely};
};
window.__startSlimeAttack=()=>{
 const now=performance.now();
 const o={type:'monsterSlime',x:poiWalkX+1,z:poiWalkZ,y:poiWalkLevel,rot:0};
 const s={x:o.x,z:o.z,fromX:o.x,fromZ:o.z,moveStarted:-1e6,hp:35,nextAttack:0,facing:3};
 poiMonsterStates.set(o,s);
 if(!poiEnemyBeginPlayer(o,s,now))throw new Error('normal slime did not begin a strike');
 __recoveryFixture={o,s,first:s.playerAttack};return s.playerAttack.hit;
};
window.__slimeFrame=()=>{
 const {o,s,first}=__recoveryFixture, now=performance.now();
 return {now,hp:poiPlayerHP,position:[s.x,s.z],nextAttack:s.nextAttack,pending:first.pending,
  contact:first.visualHitAt,resolved:__recoveryFixture.resolved,target:[first.x,first.z],player:[poiWalkX,poiWalkZ],pose:poiSlimeAttackPose(s,now),attackStart:s.playerAttack?.start};
};
`+anchor);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Fixture</title>':fixture);
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:640,height:390},deviceScaleFactor:.65,hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(16000);
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2,"gold":18,"claimedCaches":["glade"],"armor":{"head":null,"body":null,"legs":null,"feet":null}}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:0},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 // Let the untouched app finish its initial 3D draw. GPU uploads in later
 // SwiftShader frames are deliberately omitted in this timing-only fixture;
 // the browser RAF, real game ticks, hit eligibility and keyboard stay live.
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.getElementById('pineStartupCover')?.hidden);
 const expected=await page.evaluate(()=>new Promise(resolve=>{
  window.__timingOnlySlimeFixture=true;
  requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(window.__startSlimeAttack())));
 }));
 await page.waitForFunction(()=>window.__slimeFrame().pending===false);
 const first=await page.evaluate(()=>window.__slimeFrame());
 assert(first.resolved?.timely&&first.contact>=expected,'the original real game frame must resolve timely contact: '+JSON.stringify({expected,first}));
 assert.equal(first.contact,first.resolved.now);
 assert(first.hp<100&&first.hp>=94);
 assert.equal(first.nextAttack-first.contact,1500);
 // Read actual frame loop for one second and move away with existing controls
 // so an old build would re-enter the chase before the pause is up.
 await page.keyboard.press('ArrowLeft');
 const rows=await page.evaluate(contact=>new Promise(resolve=>{
  const out=[];const frame=()=>{
   const s=window.__slimeFrame();out.push(s);
   if(s.now-contact>=1230)resolve(out);else requestAnimationFrame(frame);
  };requestAnimationFrame(frame);
 }),first.contact);
 assert.notEqual((await page.evaluate(()=>window.__editorTest.facility().position)).x,102,'real button dodge moved player after first strike');
 assert(rows.every(s=>s.hp===first.hp&&s.attackStart===first.attackStart&&s.position[0]===103&&s.position[1]===93));
 assert.deepEqual(errors,[]);
 console.log('PASS native normal slime commits one hit, then stays planted for the player to counter');
 await context.close();
}finally{await browser?.close();await new Promise(r=>server.close(r))}
