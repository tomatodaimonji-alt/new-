const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa441:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&!!frontierSouthStairGpu,
  defeat:()=>{
   const north=poiNextMobTick;poiNextMobTick=Infinity;
   if(!workshopResumeRestorePosition({x:160,z:118,y:-1,facing:2,cave:false}))throw Error('cold cellar restore');
   facilityGradeInvalidate();facilityScenes.clear();
   const below=facilityRenderScene();
   const before={ground:facilityGrade?.mesh?.count??null,level:poiWalkLevel,bgm:poiOrchestraScene(performance.now()/1000)};
   const now=performance.now();poiPlayerHP=0;
   if(!poiPlayerDeathBegin(now,null))throw Error('could not start defeat');
   const area=poiPlayerDeath.checkpoint.area;
   poiPlayerDeathFrame(now+POI_DEATH_PAUSE+POI_DEATH_FADE+1);
   const surface=facilityRenderScene();
   const after={p:[poiWalkX,poiWalkZ,poiWalkLevel],ground:surface.mesh.ground?.count??0,
    fresh:surface.mesh.buf!==below.mesh.buf,shared:surface.mesh.ground===facilityGrade?.mesh,
    scene:poiOrchestraScene(performance.now()/1000),hp:poiPlayerHP,area};
   poiPlayerDeathClear();poiNextMobTick=north;
   return {before,after};
  },
  reward:()=>{
   if(!workshopResumeRestorePosition({x:160,z:125,y:-1,facing:2,cave:false}))throw Error('treasure stand restore');
   const seed=frontierSouthStockLoot(),drops=poiHotbarRead().drops.filter(d=>FRONTIER_SOUTH_LOOT.some(q=>q.x===d.x&&q.z===d.z&&q.y===d.y));
   const locked=!frontierSouthChestReachable(),chestArt=world.some(o=>o.type==='rewardChest'&&o.x===160&&o.z===126&&o.y===-1);
   const core=frontierSouthEnemyRecords().at(-1);
   const dead=frontierSouthRemember(core,{hp:0},null);
   const reachable=frontierSouthChestReachable();
   poiWalkAction({allowRuinsChest:true});
   const start=poiMineUnlock?.start,seconds=poiMineUnlockSnapshot().duration;
   if(Number.isFinite(start))poiMineUnlockFrame(start+seconds+3);
   const shown=!$('poiChestPanel').hidden,listed=poiHotbarRead().frontierSouthChest?.slots?.filter(Boolean).map(c=>c.type)??[];
   const transfer=poiChestTakeAll();
   poiChestCloseFromUi();poiHotbarState=null;
   const restored=poiHotbarRead(),reopen=frontierSouthRewardInit();
   return {seed,drops:drops.length,locked,chestArt,dead,reachable,seconds,shown,listed,transfer,reopen,
    empty:restored.frontierSouthChest?.slots?.every(c=>c===null),persisted:restored.frontierSouthLootPlaced,
    sword:poiInventorySlots(restored).some(c=>c?.type==='equipMithrilSword')};
  },
  inspect:(x,z,y,yaw)=>{
   if(!workshopResumeRestorePosition({x,z,y,facing:2,cave:false}))throw Error('view restore');
   poiTownClockGameMs=POI_TOWN_MINUTE_MS*13*60;
   poiThirdPerson=true;poiCameraYaw=yaw;poiCameraPitch=.43;
   poiWalkCamera();
   const p=parameters(),original=draw; let floor=false,gate=false,stairs=false;
   try{
    draw=m=>{floor||=m===frontierSouthVestibuleGpu;gate||=m===frontierSouthInteriorGateGpu;stairs||=m===frontierSouthStairGpu};
    frontierSouthDrawCovered(p.vp,performance.now(),p.eye);
   }finally{draw=original}
   return {floor,gate,stairs};
  },
  talk:()=>{
   const old=poiHotbarState,kit=poiHotbarRead(),actors=FRONTIER_EXPEDITION_NPCS.map(id=>({role:{id},y:-1}));
   try{
    poiHotbarState={...kit,frontierExpedition:{result:'success',phase:'back'}};
    return actors.map(actor=>poiNpcOpeningTopic({actor,greeting:'明日行く'}));
   }finally{poiHotbarState=old}
  },
  expedition:()=>{
   poiMonsterStates.clear();poiEconomyDrops.clear();
   if(!workshopResumeRestorePosition({x:160,z:113,y:-1,facing:2,cave:false}))throw Error('distant spectator restore');
   const team=FRONTIER_EXPEDITION_NPCS.map(id=>poiTownNpcActors.find(a=>a.role.id===id));
   if(team.some(a=>!a))throw Error('pair absent from runtime');
   const start=performance.now();
   for(let i=0;i<team.length;i++){
    const a=team[i],x=159+i*2,z=81;
    Object.assign(a,{x,z,y:-1,fromX:x,fromZ:z,fromY:-1,facing:2,goalKey:null,goal:null,actorLeg:null,
      path:null,nextPlan:0,moveAt:start-5000,actorRetryCardinal:false,frontierCombat:null,frontierStrike:null});
   }
   let s={version:1,started:1920,phase:'out',step:0,landed:false,result:null},goals=0,fractional=0,maxFrame=0;
   let last=team.map(a=>({x:a.x,z:a.z}));
   for(let i=0;i<660&&goals<8;i++){
    const now=start+i*32,budget={plans:2};
    for(const a of team)if(a.actorLeg)poiTownNpcActorRun(a,now,poiTownNpcGraph());
    if(i%6===0){
     frontierExpeditionStudyTick(s,poiHotbarRead(),team,n=>{s=n;goals++;return true;},now);
     for(const a of team)frontierExpeditionMove(a,s,now,budget);
    }
    for(let j=0;j<team.length;j++){
     const p=poiTownNpcVisualPosition(team[j],now,true);
     if(Math.abs(p.x-Math.round(p.x))>.01||Math.abs(p.z-Math.round(p.z))>.01)fractional++;
     maxFrame=Math.max(maxFrame,Math.hypot(p.x-last[j].x,p.z-last[j].z));last[j]=p;
    }
   }
   return {goals,fractional,maxFrame,phase:s.phase,learned:s.study?.floor?.length??0,
    knowsBoss:s.study?.floor?.includes(frontierExpeditionMapKey(160,122))??false,
    positions:team.map(a=>[a.x,a.z,a.y])};
  },
  terrain:()=>{
   const points=[[115,30,0],[145,29,0],[8,24,0],[160,113,-1]];
   const samples=[];
   for(const [x,z,y] of points){
    if(!workshopResumeRestorePosition({x,z,y,facing:2,cave:false}))throw Error('benchmark restore '+[x,z,y]);
    poiCameraYaw=.10;const f=parameters(),scene=facilityRenderScene();
    const ground=y===0?scene.mesh.ground:frontierSouthCeilingGpu;
    const original=draw;
    let sent=0,calls=0;
    try{
     draw=(m,vp,first,count=m?.count??0)=>{sent+=count;calls++};
     if(y===0){
      poiFieldHazePrepare(performance.now());
      stockGradeDraw(ground,f.vp);
     }else frontierStaticDraw(ground,f.vp);
    }finally{draw=original}
    samples.push({x,z,y,total:ground?.count??0,sent,calls});
   }
   const model=poiSouthMobModel('monsterObsidianRegent');
   return {samples,reused:model===poiSouthMobModel('monsterObsidianRegent'),vertices:model.p.length/3};
  },
  coins:()=>{
   if(!workshopResumeRestorePosition({x:136,z:30,y:0,facing:1,cave:false}))throw Error('surface restore');
   const a=poiTownNpcActors.find(v=>v.role.id==='frontierlyzel'),b=poiTownNpcActors.find(v=>v.role.id==='frontierregna');
   if(!a||!b)throw Error('pair absent');
   const now=performance.now(),gold=poiHotbarRead().gold,old=frontierVendorStock(poiHotbarRead(),a.role.id).gold;
   poiEconomyDrops.clear();
   const pt={x:149,z:30,y:0},o={type:'monsterSlime',...pt},s={x:pt.x,z:pt.z,hp:0,wildSpawn:true};
   poiEconomyDrop(o,s,a.role.id);
   const record=poiEconomyDrops.get('149,30');
   a.x=142;a.z=30;a.y=0;a.actorLeg=null;a.moveAt=now-3000;a.frontierPickupAt=0;a.frontierTradeAt=0;
   const wanted=frontierNpcCoinGoal(a,a,true),moved=frontierExpeditionCollectCoin(a,now,{plans:10}),goal=a.goal;
   a.x=149;a.z=30;a.y=0;a.fromX=149;a.fromZ=30;a.fromY=0;a.actorLeg=null;a.moveAt=now-3000;
   const picked=frontierNpcCollect(a,now),after=frontierVendorStock(poiHotbarRead(),a.role.id).gold;
   return {wanted:wanted?.x,marked:record?.expeditionCoin,goal:goal?.x,moved,picked,left:poiEconomyDrops.has('149,30'),
    delta:after-old,amount:record?.amount,playerUnchanged:gold===poiHotbarRead().gold};
  },
  lamp:()=>{
   if(!workshopResumeRestorePosition({x:159,z:81,y:-1,facing:2,cave:false}))throw Error('entry restore');
   const now=performance.now(),x=159.5,z=81.5,y=-.65;
   frontierTorchFrame(now,x,z,y);
   const pack=Array.from(gl.getUniform(program,loc.frontierTorchLights));
   frontierDrawSouthFlames(parameters().vp,now,x,z,y);
   return {pack,preview:frontierSouthPreviewGpu?.count,flame:frontierSouthFlameGpu?.count,
       mode:gl.getUniform(program,loc.frontierTorchEmissive),glError:gl.getError()};
  },
  run:()=>{
   poiWildClear();poiNextMobTick=Infinity;poiTownNpcNext=Infinity;
   if(!workshopResumeRestorePosition({x:160,z:73,y:0,facing:2,cave:false}))throw Error('entry restore');
   const scene=facilitySite,origin=poiOtherworldTravelSerial,stair=frontierSouthStairGpu, roof=frontierSouthCeilingGpu;
   const begin=poiDungeonEntranceSerial;
   frontierSouthWarmCellar();const cellar=facilityScenes.get('cellar:-1');
   const d=mesh();frontierSouthDoorArt(d);
   let lo=Infinity,hi=-Infinity,low=Infinity,high=-Infinity;
   for(let i=0;i<d.p.length;i+=3){lo=Math.min(lo,d.p[i]);hi=Math.max(hi,d.p[i]);low=Math.min(low,d.p[i+1]);high=Math.max(high,d.p[i+1]);}
   const gateClosed=!frontierSouthDoorWanted(160.5,72.9,null,[]);
   let doorSeen=false;
   const trace=[],now=performance.now();
   poiCameraYaw=0;poiThirdPerson=true;
   const c={id:912,dx:0,dy:-38,last:now-16,moved:true,failures:new Map()};
   poiAnalogContact=c;poiWalkNextReady=0;
   for(let i=0;i<300&&poiWalkZ<82;i++){
    poiAnalogFrame(now+i*16);
    if(poiFreePose){poiWalkViewX=poiFreePose.x;poiWalkViewZ=poiFreePose.z;}
    doorSeen ||= frontierSouthDoorWanted(poiWalkViewX+.5,poiWalkViewZ+.5,poiWalkDoorOpen,[]);
    trace.push({z:poiWalkViewZ,f:poiWalkLevel,h:poiWalkLevel*1.4+poiCreekPlayerHeight(now+i*16)});
    if(!poiAnalogContact)throw Error('analog contact was interrupted');
   }
   const down=[poiWalkX,poiWalkZ,poiWalkLevel],hall=poiWalkCanStep(160,83),blocked=!poiWalkCanStep(154,80);
   c.dy=38;
   for(let i=0;i<300&&poiWalkZ>75;i++){
    poiAnalogFrame((c.last??now)+16);
    if(poiFreePose){poiWalkViewX=poiFreePose.x;poiWalkViewZ=poiFreePose.z;}
    if(!poiAnalogContact)throw Error('analog contact was interrupted on ascent');
   }
   poiAnalogStop();
   const up=[poiWalkX,poiWalkZ,poiWalkLevel];
   return {origin,travel:poiOtherworldTravelSerial,scene:scene===facilitySite,noFade:begin===poiDungeonEntranceSerial,
     down,up,hall,blocked,gateClosed,doorSeen,doorSize:[lo,hi,low,high],
     warm:!!cellar&&cellar===facilityScenes.get('cellar:-1'),noBanner:!poiLocationAnimation,
     verts:[stair.count,roof.count,frontierSouthInteriorGateGpu.count],trace};
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:70000});
 await p.waitForFunction(()=>window.__editorTest?.qa441?.ready(),null,{timeout:40000});
 const death=await p.evaluate(()=>window.__editorTest.qa441.defeat());
 console.log(death);
 a.deepEqual(death.before,{ground:null,level:-1,bgm:'southRuinsBoss'});
 a.deepEqual(death.after.p,[160,72,0]);a.equal(death.after.area,'southRuins');
 a.notEqual(death.after.scene,'southRuinsBoss');a.notEqual(death.after.scene,'southRuins');
 a.ok(death.after.ground>10000&&death.after.shared&&death.after.fresh&&death.after.hp>0);
 const q=await p.evaluate(()=>window.__editorTest.qa441.run());
 a.deepEqual(q.down,[160,82,-1]);a.deepEqual(q.up,[160,75,0]);
 a.ok(q.hall&&q.blocked&&q.scene&&q.noFade);a.equal(q.travel,q.origin);a.ok(q.verts.every(n=>n>200));
 const grade=q.trace.filter(t=>t.z+.5>76.05&&t.z+.5<80.95);
 a.ok(grade.some(t=>t.f===0)&&grade.some(t=>t.f===-1));
 a.ok(grade.every((t,i)=>i===0||Math.abs(t.h-grade[i-1].h)<.08),'camera height remains continuous');
 a.ok(q.warm&&q.noBanner&&q.gateClosed&&q.doorSeen);
 a.ok(q.doorSize[0]<158.9&&q.doorSize[1]>162.1&&q.doorSize[2]<0&&q.doorSize[3]>2.4);
 const coins=await p.evaluate(()=>window.__editorTest.qa441.coins());
 console.log(coins);
 a.ok(coins.marked&&coins.moved&&coins.picked&&!coins.left&&coins.playerUnchanged);
 a.equal(coins.wanted,149);a.equal(coins.goal,149);a.equal(coins.delta,coins.amount);a.ok(coins.delta>0);
 const lamp=await p.evaluate(()=>window.__editorTest.qa441.lamp());
 console.log(lamp);
 a.ok(lamp.pack[3]>.1&&lamp.flame>=100&&lamp.preview>100);
 a.equal(lamp.mode,0);a.equal(lamp.glError,0);
 const perf=await p.evaluate(()=>window.__editorTest.qa441.terrain());
 console.log('Terrain vertex submission',perf);
 a.ok(perf.reused&&perf.vertices>200);
 a.ok(perf.samples.slice(0,3).every(v=>v.sent>0&&v.sent<v.total*.78&&v.calls<=28));
 a.ok(perf.samples[3].sent>0&&perf.samples[3].sent<perf.samples[3].total*.85);
 const talk=await p.evaluate(()=>window.__editorTest.qa441.talk());
 a.ok(talk[0].includes('報告')&&talk[1].includes('報酬'));
 const floor=await p.evaluate(()=>window.__editorTest.qa441.inspect(160,81,-1,0));
 a.ok(!floor.floor&&floor.stairs,'upper floor not submitted from the B1 landing');
 const exploration=await p.evaluate(()=>window.__editorTest.qa441.expedition());
 console.log('Expedition runtime movement',exploration);
 a.ok(exploration.goals>=4&&exploration.fractional>=25&&exploration.learned>20);
 a.ok(!exploration.knowsBoss&&exploration.phase==='out'&&exploration.maxFrame<.6);
 a.deepEqual(errors,[]);
 console.log('PASS mobile gate traversal, sealed bounds, prewarmed cellar, silent area label and continuous stair height');
 const loot=await p.evaluate(()=>window.__editorTest.qa441.reward());
 console.log('Actual B1 reward panel',loot);
 a.ok(loot.seed&&loot.locked&&loot.chestArt&&loot.dead&&loot.reachable&&loot.shown&&loot.persisted);
 a.equal(loot.drops,3);a.ok(loot.seconds>=2400&&loot.seconds<=2700);
 a.deepEqual(loot.listed,['equipMithrilSword','armorGaldShoes','cannedFood']);
 a.ok(loot.transfer.ok&&loot.reopen&&loot.empty&&loot.sword);
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
