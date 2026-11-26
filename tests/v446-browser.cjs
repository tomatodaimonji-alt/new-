const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
  qa445:{
   ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
   cellarReady:()=>!!facilityScenes.get("cellar:-1")?.mesh?.count,
   at:(x,z,y=0)=>workshopResumeRestorePosition({x,z,y,facing:1,cave:false}),
   profile:()=>{
    const stats=Object.create(null);
    const wrap=(id,fn)=>(...args)=>{
     const t=performance.now();try{return fn(...args)}finally{
      const ms=performance.now()-t,o=stats[id]??(stats[id]={max:0,count:0,total:0});
      o.max=Math.max(o.max,ms);o.count++;o.total+=ms;
     }
    };
    frontierSouthWarmCellar=wrap('cellar bake',frontierSouthWarmCellar);
    facilityRenderScene=wrap('scene',facilityRenderScene);
    poiWalkFrame=wrap('walk/combat',poiWalkFrame);
    poiTownResidentsFrame=wrap('residents',poiTownResidentsFrame);
    poiCompanionTick=wrap('party',poiCompanionTick);
    frontierDrawMapEdgeRocks=wrap('edge rocks',frontierDrawMapEdgeRocks);
    return ()=>Object.fromEntries(Object.entries(stats).map(([key,{max,count,total}])=>{
     delete stats[key];return [key,[+max.toFixed(2),count,+total.toFixed(2)]];
    }));
   },
   road:()=>{
    if(!workshopResumeRestorePosition({x:118,z:30,y:0,facing:1,cave:false}))throw Error('road restore');
    poiTownClockGameMs=POI_TOWN_MINUTE_MS*12*60;poiThirdPerson=true;poiCameraYaw=-Math.PI*.5;poiCameraPitch=.78;poiWalkCamera();
    return {walk:[116,117,118,119,120].every(x=>poiWalkCanStep(x,30)),colors:[30.5,32,33.5].map(z=>frontierEarthTint(118.5,z,new Set()))};
   },
   fist:()=>{
    const boss=facilitySite.davidTemple.boss;
    if(!workshopResumeRestorePosition({x:boss.x,z:boss.z-1,y:boss.y,facing:2,cave:false}))throw Error('boss approach');
    const pair=[...poiMonsterStates].find(([o,s])=>poiDavidMatch(o));
    if(!pair)throw Error('missing boss');
    const [o,s]=pair,now=performance.now();
    const started=poiDavidMobFrame(o,s,now)||s.david?.awake;
    if(!started)throw Error('boss did not awaken');
    for(const age of [POI_DAVID_AWAKENING.first,POI_DAVID_AWAKENING.second,POI_DAVID_WAKE_MS])poiDavidAwakeningTick(o,s,boss,s.david.wakeAt+age);
    const before=s.hp,record={armed:poiEquippedWeapon(),damage:poiPlayerAttackDamage(null),before,player:poiPlayerHP,awake:s.david?.wakeDone};
    const time=now+POI_DAVID_WAKE_MS+2,frame=time+POI_FIST_PROFILE.hit+1,original=poiFreePose;
    let found=null,checked=0;
    // The player's short straight hit only works if it intersects a leg,
    // not the air under the center marker. Try walkable points around it.
    for(let ring=10;ring>=4&&!found;ring--)for(let i=0;i<32&&!found;i++){
     const angle=i*Math.PI/16,x=boss.x+Math.sin(angle)*ring*.16,z=boss.z+Math.cos(angle)*ring*.16;
     const ix=Math.floor(x+.5),iz=Math.floor(z+.5);
     if(!poiWalkCanStep(ix,iz))continue;
     poiFreePose={x,z,level:boss.y,angle};
     poiCombatLockReset();poiAimAttack=null;
     const shot=poiAimNewShot({type:null,profile:POI_FIST_PROFILE,started:time,y:boss.y},time);
     const trace=poiAimTrace(shot,shot.profile.range,frame);checked++;
     if(trace.monster?.[0]===o)found={x,z,forward:trace.forward,angle};
    }
    if(found){
     poiFreePose={x:found.x,z:found.z,level:boss.y,angle:found.angle};
     poiCombatLockReset();poiAimAttack=null;
     poiPlayerStartProfile(null,time);
     poiPlayerWeaponFrame(frame);
    }
    poiFreePose=original;
    return {...record,after:s.hp,hit:POI_FIST_PROFILE.hit,interval:POI_FIST_PROFILE.ready,checked,found};
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
 await p.waitForFunction(()=>window.__editorTest?.qa445?.ready(),null,{timeout:40000});
 a.ok(await p.evaluate(()=>window.__editorTest.qa445.cellarReady()),'startup must prebuild the closed cellar before walking');
 const road=await p.evaluate(()=>window.__editorTest.qa445.road());
 console.log('Road',road);a.ok(road.walk);
 await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 console.log('VISUAL_ROAD:'+ (await p.screenshot({type:'jpeg',quality:38})).toString('base64'));
 await p.evaluate(()=>{window.qa445Timings=window.__editorTest.qa445.profile()});
 for(const [x,z,y] of [[125,30,0],[96,-19,0],[160,72,0],[160,84,-1],[161,76,0],[109,31,0],[125,30,0]]){
  const s=await p.evaluate(async ([x,z,y])=>{
   const t=performance.now(),ok=window.__editorTest.qa445.at(x,z,y),restore=performance.now()-t,gaps=[];
   let last=performance.now();for(let i=0;i<12;i++)await new Promise(r=>requestAnimationFrame(()=>{const q=performance.now();gaps.push(Math.round(q-last));last=q;r()}));
   return {ok,restore:Math.round(restore),gaps,stages:window.qa445Timings()};
  },[x,z,y]);console.log('FRAME_SAMPLE',x,z,y,s);if(x===160&&z===72)a.ok(s.stages['cellar bake'][0]<2,'first gate approach must use the prebuilt mesh');
 }
 const fist=await p.evaluate(()=>window.__editorTest.qa445.fist());
 console.log('FIST_CONTACT',fist);a.equal(fist.armed,null);a.ok(fist.awake);
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
