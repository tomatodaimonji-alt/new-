import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
function replaceOnce(text,from,to){assert.equal(text.split(from).length,2,'unique fixture anchor: '+from);return text.replace(from,to)}
let fixture=replaceOnce(html,hook,hook+`
  meleeReachQA:{
   seed:({points,wall})=>{
    // Isolate authored actors and the autonomous spawners; keep real map ray/physics.
    poiMonsterStates.clear();
    if(window.__qaMeleeWall)world=world.filter(o=>o!==window.__qaMeleeWall);
    poiCombatLockReset();
    const x=poiWalkX,z=poiWalkZ,y=poiWalkLevel,now=performance.now();
    const add=([forward,side,floor=0])=>{
     const level=y+floor;
     const fx=x+forward,fz=z+side,ix=poiFreeCell(fx),iz=poiFreeCell(fz);
     const obj={x:ix,z:iz,y:level,rot:0,type:'monsterSlime'};
     const state=poiCombatActorMake(obj),cells=new Set([ix+','+iz]);
     state.hp=100;state.townOwned=true;
     state.actorFree={fromX:fx,fromZ:fz,x:fx,z:fz,start:now-400,ms:380,cells,endCells:cells,heading:0};
     poiMonsterStates.set(obj,state);
     return {obj,state};
    };
    window.__qaMeleeTargets=points.map(add);
    window.__qaMeleeWall=wall?{x:x+wall[0],y,z:z+wall[1],rot:0,type:'wall'}:null;
    if(window.__qaMeleeWall)world.push(window.__qaMeleeWall);
    poiMonsterMeshDirty=true;poiAimLockAt=0;
   },
   status:()=>{
    const slot=poiInventorySlots(poiHotbarRead())[0];
    return {equipped:poiEquippedWeapon(),hps:window.__qaMeleeTargets?.map(({state})=>state.hp),at:poiWalkActionStarted,now:performance.now(),
     pending:!!poiPlayerWeaponPending,ready:poiAttackReady,durability:slot?.durability??poiEquipmentDurabilityMax(slot?.type)};
   }
  },`);
fixture=replaceOnce(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=replaceOnce(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html><title>Melee reach QA</title>':fixture);
});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base='http://127.0.0.1:'+server.address().port;
 const run=async (weapon,cases)=>{
  const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.setDefaultTimeout(14000);
  try{
   await page.goto(base+'/seed');
   await page.evaluate(weapon=>{
    const slots=Array(27).fill(null);
    slots[0]={type:weapon,count:1,...(weapon==='kitchenKnife'?{durability:40}:{})};
    if(weapon!=='equipWoodSword')slots[1]={type:'equipWoodSword',count:1};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon,potions:0,slots}));
    localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:575000}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },weapon);
   await page.goto(base+'/?resume=1&test=1');
   await page.waitForFunction(()=>window.__editorTest?.facility()?.active&&window.pineStartup&&!pineStartup.loading);
   await page.waitForFunction(()=>document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
   await page.locator('#pineStartupCover').waitFor({state:'hidden'});
   const status=()=>page.evaluate(()=>window.__editorTest.meleeReachQA.status());
   let cooldown;
   for(const [label,points,hps,wall] of cases){
    await page.waitForFunction(()=>{const s=window.__editorTest.meleeReachQA.status();return s.now>s.ready&&!s.pending});
    const before=await status();
    assert.equal(before.equipped,weapon,'fixture produced actual equipped weapon');
    await page.evaluate(args=>window.__editorTest.meleeReachQA.seed(args),{points,wall});
    await page.locator('#poiWalkAction').tap();
    await page.waitForFunction(prior=>{const s=window.__editorTest.meleeReachQA.status();return s.at>prior&&!s.pending},before.at);
    const after=await status();
    assert.deepEqual(after.hps,hps,weapon+': '+label);
    if(Number.isFinite(before.durability))assert.equal(after.durability,before.durability-(hps.some(h=>h<100)?1:0),weapon+': one wear per successful swing only');
    const ms=after.ready-after.at;
    if(cooldown!==undefined)assert(Math.abs(ms-cooldown)<.001,weapon+': cooldown is the same for hits and empty swings');
    cooldown=ms;
   }
   assert.deepEqual(errors,[]);
   return cooldown;
  }finally{await ctx.close()}
 };
 const wood=await run('equipWoodSword',[
  ['control: familiar 28 damage and reach 1.30',[[1.30,0]],[72]],
  ['control: does not hit outside 1.30',[[1.34,0]],[100]]
 ]);
 const knife=await run('kitchenKnife',[
  ['one tile at a non-cardinal angle',[[.8,.6]],[68]],
  ['strictly outside one tile',[[1.04,0]],[100]],
  ['a wall shields a same-floor target',[[.94,0]],[100],[1,0]]
 ]);
 assert(knife<wood,'knife must recover faster than wood ('+knife+'ms versus '+wood+'ms)');
 await run('equipIronSword',[
  ['two-tile forward sweep, both sides, rear/outer/far/floor misses',
   [[.6,0],[2,-1.48],[1.98,1.48],[2.04,0],[1.42,1.54],[-1.1,0],[1.25,.6,1]],
   [70,70,70,100,100,100,100]],
  ['one blocked lane, second lane remains open',
   [[.6,0],[1.72,.98],[1.72,-.98]],[70,100,70],[1,1]]
 ]);
 await run('equipWoodSpear',[
  ['shaft at close range',[[1,0]],[82]],
  ['shaft just before tip',[[2.22,0]],[82]],
  ['tip after shaft boundary',[[2.28,0]],[76]],
  ['tip on exact three-tile edge at non-cardinal angle',[[2.4,1.8]],[76]],
  ['just beyond the three-tile edge',[[3.04,0]],[100]],
  ['wall blocks tip contact with an otherwise valid target',[[2.75,0]],[100],[1,0]],
  ['one thin thrust does not sweep a neighbor off the centerline',[[2.4,0],[2.5,.5]],[76,100]]
 ]);
 console.log('PASS physical landscape attacks: knife 1 and faster than wood; iron 2-wide sweep; spear 3 shaft/tip; walls, floors, angles, one wear');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
