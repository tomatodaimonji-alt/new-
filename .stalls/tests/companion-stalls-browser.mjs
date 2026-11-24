import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]||'world-editor.html','utf8');
const rep=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
rep(api,api+`
  detourQA:{
   frame:()=>render(),
   actorAt:(x,z)=>{
    const a=poiCompanionActor;if(!a||!poiWalkCanStep(x,z))return false;
    a.x=a.px=a.fx=x;a.z=a.pz=a.fz=z;a.next=0;a.freeGoal=null;a.freeRoute=null;a.localDetour=null;a.followLeader=false;window.__stallsNavQueries=[];
    window.__detourWitness=a;return true;
   },
   snap:()=>{
    const a=poiCompanionActor,now=performance.now(),p=a&&poiCompanionPosition(a),pose=a&&poiCompanionWorldPose(a,now);
    const k=a?.x+','+a?.z,d=a&&facilityCreekIndex?.parts?.has(k);
    return {a:p,xy:a&&[a.x,a.z],player:[poiWalkX,poiWalkZ,poiWalkLevel],now,hp:poiCompanionSnapshot(now).hp,
     same:!window.__detourWitness||window.__detourWitness===a,power:poiCompanionMode(),
     dry:(!a||a.y!==0||!facilityCreekIndex?.water.has(k)||d)&&!poiNorthTrailLowlandWater(a?.x,a?.z),
     searches:window.__stallsNavQueries||[],inside:facilitySite.northTrail.watchPost.bounds,
     gate:poiOtherworldPortalAt(facilitySite,a?.x,a?.z,a?.y),deck:!!d,renderY:pose?.y??null,
     deckY:d?facilityCreekIndex.bridgeHeight.get(k):null,err:gl.getError(),
     wards:facilitySite.mine.earlyRoom.slimes.map(o=>({safe:poiMineEarlyMayMove(o,116,61),hall:poiMineEarlyMayMove(o,118,59)}))};
   }
  },
`);
rep('function poiFindLocalDetour(from,to,can,arrived,maxNodes=72,maxDepth=24){',
    'function poiFindLocalDetour(from,to,can,arrived,maxNodes=72,maxDepth=24){window.__stallsNavQueries?.push(performance.now());');
rep(' requestAnimationFrame(render);',' if(!window.__detourManual)requestAnimationFrame(render);');
rep('function poiMobFrame(now){if(!poiWalkActive','function poiMobFrame(now){if(window.__detourQuiet)return;if(!poiWalkActive');
rep('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
rep('function poiWildPick(rng){','function poiWildPick(rng){return null;');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.COMPANION_STALLS_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let b,phase,last;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const v of [{name:'pond',feet:[115,15,0],hero:[115,9,0],must:[112,12]},
  {name:'watch doorway',feet:[97,13,0],hero:[100,12,0],must:[101,10]}]){
  phase=v.name;
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
  try{
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.addInitScript(()=>{window.__detourQuiet=true});
   await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(origin+'/seed');
   await p.evaluate(({hero})=>{
    const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:150};slots[1]={type:'orvasSoul',count:1,durability:787};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,slots,potions:0,companionSoul:{version:1,active:'orvasSoul',mode:'follow'}}));
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:hero[0],z:hero[1],y:hero[2],facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
     view:{yaw:0,zoom:1,panX:0,panZ:0,level:hero[2],hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
   },v);
   await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
   await p.clock.pauseAt(await p.evaluate(()=>Date.now()+230));
   await p.evaluate(()=>{window.__detourManual=true;window.__detourQuiet=true;window.__editorTest.detourQA.frame()});
   const read=()=>p.evaluate(()=>window.__editorTest.detourQA.snap());
   a(await p.evaluate(([x,z])=>window.__editorTest.detourQA.actorAt(x,z),v.feet));
   const trace=[],deck=[],start=await read();a.deepEqual(start.player,v.hero);
   const dist=s=>Math.hypot(s.a.x-v.hero[0],s.a.z-v.hero[1]);let old=start;
   for(let i=0;i<160;i++){
    await p.clock.fastForward(50);await p.evaluate(()=>window.__editorTest.detourQA.frame());const s=last=await read();
    a(s.a?.y===v.feet[2]&&s.same&&s.hp===787&&s.power==='follow'&&s.err===0,JSON.stringify(s));
    a(s.dry&&!s.gate,'never enters actual water or a travel portal');
    a(Math.hypot(s.a.x-old.a.x,s.a.z-old.a.z)<=Math.min(64,s.now-old.now)/235+.00001,'no walker jump');
    if(old.xy.join(',')!==s.xy.join(','))trace.push(s.xy);
    if(s.deck)deck.push(s);
    old=s;
    if(dist(s)<2.55&&trace.some(x=>x.join(',')===v.must.join(',')))break;
   }
   a(trace.some(x=>x.join(',')===v.must.join(',')),JSON.stringify({v,trace,last}));
   a(trace.some(([x,z])=>Math.hypot(x-v.hero[0],z-v.hero[1])>dist(start)+.35),'path actually detours away first');
   a(dist(last)<2.55,'same companion reaches player after legal detour');
   a(last.wards.length&&last.wards.every(x=>!x.safe&&x.hall),'actual authored slime safety restriction unchanged');
   a(last.searches.length>=1&&last.searches.length<=3,'a held destination reuses a bounded plan rather than searching per frame: '+last.searches);
   a(last.searches.slice(1).every((t,i)=>t-last.searches[i]>=650));

   a.deepEqual(errors,[]);
   console.log('Actual same Orvas completes legal detour',JSON.stringify({phase,trace,last}));
  }finally{await ctx.close()}
 }
}catch(e){console.error(phase,last);throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
