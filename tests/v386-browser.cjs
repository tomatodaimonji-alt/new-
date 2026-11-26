const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8'), marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 qosQA:{
  player:workshopResumeRestorePosition,
  sleep:yes=>{const n=poiTownNpcActors.find(a=>a.role.id==='frontiersera');
   poiTownClockGameMs=(yes?23*60:12*60)*POI_TOWN_MINUTE_MS;
   Object.assign(n,{...n.role.home,actorLeg:null,moveAt:null,activity:yes?'sleep-home':'idle'});poiTownNpcVersion++;
  },
  greet:()=>{
   const n=poiTownNpcActors.find(a=>a.role.id==='frontiersera');
   Object.assign(n,{x:48,z:28,y:0,actorLeg:null,moveAt:null,activity:'idle',target:null,frontierCombat:null});
   return workshopResumeRestorePosition({x:49,z:28,y:0,facing:3});
  },
  demoMob:yes=>{
   if(window.__qaDemoMob){poiMonsterStates.delete(window.__qaDemoMob);window.__qaDemoMob=null}
   if(yes){
    const o={x:49,z:29,y:0,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);
    s.nextAttack=performance.now()+9000;poiMonsterStates.set(o,s);window.__qaDemoMob=o;
   }
   poiCombatLockReset();poiCombatLockUpdate(poiAimOrigin(performance.now()),performance.now(),true);poiShopSync();
   return poiNpcGreetingBlockedByLock(performance.now());
  },
  action:()=>({dialog:poiTownDialogueSnapshot(),last:poiWalkActionStarted}),
  speeds:()=>{
   const human={id:'human:frontiersera',x:poiWalkX+8,z:poiWalkZ,freeFollows:true};
   const slime={id:'slimeSoul',x:poiWalkX+8,z:poiWalkZ,freeFollows:true};
   const close={id:'human:frontiersera',x:poiWalkX+2,z:poiWalkZ,freeFollows:true};
   return {human:frontierFollowSpeed(human),slime:frontierFollowSpeed(slime),slimeExpected:poiCompanionSpeed(slime)*frontierFollowStyle(slime).pace,
    melee:frontierFollowSpeed({...human,freeFollows:false}),base:poiCompanionSpeed(human),close:frontierFollowSpeed(close),player:1/poiChapelStepMs(poiWalkX,poiWalkZ)};
  },
  ready:()=>poiTownNpcActors.some(a=>a.role.id==='frontiersera'),
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qosQA.ready());
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.qosQA[name](...args),[name,args]);
 const speed=await run('speeds');a(speed.human>speed.close&&speed.close>=speed.player);a.equal(speed.slime,speed.slimeExpected);a.equal(speed.melee,speed.base);
 a(await run('player',{x:41,z:35,y:0,facing:2}));await run('sleep',true);
 const z=p.locator('[data-npc-sleep=frontiersera]');await z.waitFor({state:'visible'});a.equal(await z.textContent(),'Zzz…');
 a(await run('player',{x:45,z:33,y:0,facing:1}));await z.waitFor({state:'detached'});
 a(await run('player',{x:41,z:35,y:0,facing:2}));await z.waitFor({state:'visible'});
 await run('sleep',false);await z.waitFor({state:'detached'});
 a(await run('greet'));const button=p.locator('#poiWalkAction');
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');
 a(await run('demoMob',true));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').getAttribute('aria-label')==='攻撃または決定');
 await button.tap();a.equal((await run('action')).dialog,null);
 a(!(await run('demoMob',false)));a(await run('greet'));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
 a.equal((await run('action')).dialog.id,'frontiersera');
 a.deepEqual(errors,[]);console.log('PASS sleep cue visibility and wake, hostile lock disables new greetings, human allies keep walking pace');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
