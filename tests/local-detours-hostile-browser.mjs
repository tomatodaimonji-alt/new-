import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]||'world-editor.html','utf8');
const rep=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
rep(api,api+`
  detourFoe:{
   frame:()=>render(),
   seed:()=>{
    const o={type:'monsterSlime',x:107,z:60,y:-1,rot:0};
    if(!poiWalkCanStep(o.x,o.z))return false;
    const s=poiCombatActorMake(o);poiMonsterStates.set(o,s);
    window.__detourFoe=o;poiNextMobTick=0;return true;
   },
   snap:()=>{
    const o=window.__detourFoe,s=poiMonsterStates.get(o),now=performance.now();
    return {x:s?.x,z:s?.z,from:[s?.fromX,s?.fromZ],hero:[poiWalkX,poiWalkZ,poiWalkLevel],hp:s?.hp,
     now,region:facilitySite.id,err:gl.getError(),heroHP:poiPlayerHP,pending:!!s?.playerAttack?.pending,
     restriction:facilitySite.mine.earlyRoom.slimes.every(a=>!poiMineEarlyMayMove(a,116,61)&&!poiMineEarlyMayMove(a,107,60))};
   }
  },
`);
rep(' requestAnimationFrame(render);',' if(!window.__detourManual)requestAnimationFrame(render);');
rep('for(const [obj,state] of poiMonsterStates){if((facilitySite&&obj.y!==poiWalkLevel)',
    'for(const [obj,state] of poiMonsterStates){if(window.__detourFoe&&window.__detourFoe!==obj)continue;if((facilitySite&&obj.y!==poiWalkLevel)');
rep('function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
rep('function poiWildPick(rng){','function poiWildPick(rng){return null;');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.LOCAL_DETOUR_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let b,last;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 try{
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(origin+'/seed');
  await p.evaluate(()=>{
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,slots:Array(27).fill(null),potions:0}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:107,z:55,y:-1,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
    view:{yaw:0,zoom:1,panX:0,panZ:0,level:-1,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.24,orbitDistance:6.7}}));
  });
  await p.goto(origin+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
  await p.clock.pauseAt(await p.evaluate(()=>Date.now()+230));
  await p.evaluate(()=>{window.__detourManual=true;window.__editorTest.detourFoe.frame()});
  a(await p.evaluate(()=>window.__editorTest.detourFoe.seed()));
  const read=()=>p.evaluate(()=>window.__editorTest.detourFoe.snap());
  let old=await read(),trace=[];
  a.deepEqual(old.hero,[107,55,-1]);
  for(let i=0;i<95;i++){
   await p.clock.fastForward(100);await p.evaluate(()=>window.__editorTest.detourFoe.frame());const q=last=await read();
   a(q.hp>0&&q.restriction&&q.err===0&&q.region==='base');
   const step=Math.abs(old.x-q.x)+Math.abs(old.z-q.z);a(step<=1,'never warp between rooms');
   if(step)trace.push([q.x,q.z]);old=q;
   if(q.pending)break;
  }
  a(trace.some(x=>x.join(',')==='109,58'),JSON.stringify({trace,last}));
  a(trace.some(([x,z])=>Math.hypot(x-107,z-55)>5),'path actually detours away first');
  a(last.pending&&Math.abs(last.x-107)+Math.abs(last.z-55)===1,'ordinary monster reaches real melee line after doorway');
  a.deepEqual(errors,[]);console.log('Ordinary hostile uses true B1 doorway, authored safe zone unchanged',JSON.stringify({trace,last}));
 }finally{await ctx.close()}
}catch(e){console.error(last);throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
