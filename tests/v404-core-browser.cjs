const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  run:()=>{
   const {BOSS,GATE,CHEST,ARENA_MOBS}=FRONTIER_RUINS;
   const at=(x,z,facing=2)=>{if(!workshopResumeRestorePosition({x,z,y:0,facing}))throw Error('fixture '+x+','+z)};
   const done=()=>poiChestIsOpen();
   at(19,36);poiCameraYaw=0;poiCameraPitch=.22;
   const vp=parameters().vp;
   const close=[...poiMonsterStates].filter(([o,s])=>s.frontierRuins&&ARENA_MOBS.some(p=>p.x===o.x&&p.z===o.z));
   poiRenderEnemyHealth(performance.now(),vp);
   const inside=close.some(([o])=>poiEnemyBars.has(o));
   at(17,37);
   poiRenderEnemyHealth(performance.now(),vp);
   const outside=close.some(([o])=>poiEnemyBars.has(o));
   const foe=[...poiMonsterStates].find(([o])=>frontierRuinsBoss(o));
   at(5,41);poiPlayerDamageTarget(foe,foe[0].x,foe[0].z,1500,null,performance.now());
   const gate=frontierRuinsGateOpen()&&poiWalkCanStep(GATE.x,GATE.z,GATE.x,GATE.z-1);
   at(CHEST.x,CHEST.z-2,2);
   poiWalkNextReady=0;poiWalkStep(0,1);
   const arrived=poiWalkZ===CHEST.z-1&&!done()&&!poiHotbarRead().frontierRuinsChest;
   poiWalkAction({allowRuinsChest:false});const stale=!done();
   poiWalkAction({repeat:true});const hold=!done();
   at(CHEST.x,CHEST.z-1,0);poiWalkAction();const wrongFace=!done();
   at(CHEST.x,CHEST.z-1,2);poiShopSync();
   return {inside,outside,gate,arrived,stale,hold,wrongFace,can:frontierRuinsChestReachable(),prompt:$('poiWalkAction').getAttribute('aria-label')};
  },
  opened:()=>poiChestIsOpen()&&poiHotbarRead().frontierRuinsChest?.slots.filter(Boolean).length>=2
 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 const e=await p.evaluate(()=>window.__editorTest.qa398.run());
 console.log('Chest and HUD outcome',e);
 a(e.inside&&!e.outside&&e.gate&&e.arrived&&e.stale&&e.hold&&e.wrongFace&&e.can);
 a.equal(e.prompt,'遺跡の宝箱を開ける');
 await p.locator('#poiWalkAction').tap();
 a(await p.evaluate(()=>window.__editorTest.qa398.opened()));
 console.log('PASS underground bars removed above ground; no walk or stale press auto-open; explicit touch opens chest');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
