import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function replace(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=replace(html,hook,hook+`
  hitFlashQA:{
   seed:()=>{
    poiMonsterStates.clear();if(typeof poiCombatLockReset==='function')poiCombatLockReset();
    const x=poiWalkX+1,z=poiWalkZ,y=poiWalkLevel,obj={x,z,y,type:'monsterSlime',rot:0},state=poiCombatActorMake(obj);
    state.hp=80;state.townOwned=true;poiMonsterStates.set(obj,state);poiMonsterMeshDirty=true;
    window.__flashProbe={obj,state};window.__flashDraws=[];
   },
   hurt:()=>poiMobHitPlayer(window.__flashProbe.obj,performance.now()),
   status:()=>({player:poiPlayerHP,enemy:window.__flashProbe?.state.hp,draws:window.__flashDraws||[],now:performance.now()})
  },`);
fixture=replace(fixture,'function poiDrawHitFlashSpan(mesh,vp,first,count,amount){',`function poiDrawHitFlashSpan(mesh,vp,first,count,amount){
 if(window.__flashDraws&&amount>0&&window.__flashDraws.length<240)
  window.__flashDraws.push({kind:mesh===poiWalkMesh?'player':'monster',amount,first,count,now:performance.now()});`);
fixture=replace(fixture,' const p=poiWildPick(rng);',' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Hit flash QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base='http://127.0.0.1:'+server.address().port;
 await page.goto(base+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',potions:0}));
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:575000}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
    top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(base+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.pineStartup&&!pineStartup.loading);
 await page.evaluate(()=>window.__editorTest.hitFlashQA.seed());
 const state=()=>page.evaluate(()=>window.__editorTest.hitFlashQA.status());
 const prior=await state();assert.equal(prior.draws.length,0);
 await page.locator('#poiWalkAction').tap();
 await page.waitForFunction(()=>window.__editorTest.hitFlashQA.status().draws.some(x=>x.kind==='monster'));
 assert.equal((await state()).enemy,52);
 await page.evaluate(()=>window.__editorTest.hitFlashQA.hurt());
 await page.waitForFunction(()=>window.__editorTest.hitFlashQA.status().draws.some(x=>x.kind==='player'));
 assert((await state()).player<prior.player);
 await page.waitForTimeout(250);
 const cleared=await state();
 assert(cleared.draws.every(x=>x.amount>0&&x.amount<=.23&&x.count>0));
 await page.waitForTimeout(120);
 assert.equal((await state()).draws.length,cleared.draws.length,'flashing does not persist');
 assert.deepEqual(errors,[]);
 console.log('PASS real player and monster HP changes tint their actual draw paths briefly in WebGL');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
