import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,anchor,anchor+`
  ordinaryCueQA:{
   begin:()=>{
    // Deterministic fixture follows the existing slime recovery browser:
    // plant a regular actor next to the current square then run the exact
    // enemy begin, live RAF, damage, and renderer with no simulated hits.
    poiEnemyCancelPlayer();poiMonsterStates.clear();
    // Each native observation starts from the same fixture HP, including
    // a retry after a timely attack whose draw was starved by hosted GPU.
    poiPlayerHP=100;poiCombatHud();
    const now=performance.now(),x=poiWalkX+1,z=poiWalkZ,y=poiWalkLevel;
    const obj={x,z,y,type:'monsterSlime',rot:0},s=poiCombatActorMake(obj);
    s.facing=1;poiMonsterStates.set(obj,s);poiMonsterMeshDirty=true;
    window.__ordinaryCueDraw=[];window.__ordinaryCueGeo=[];window.__ordinaryCueGPU=new WeakMap();window.__ordinaryCueOpportunities=[];
    if(!poiEnemyBeginPlayer(obj,s,now))throw Error('ordinary authored slime attack could not begin at the controlled fixture');
    window.__ordinaryCueAttack=s.playerAttack;window.__ordinaryCueResolve=null;
   },
   state:()=>{
    const a=window.__ordinaryCueAttack,point=a&&poiWorldToScreen(parameters().vp,a.x+.5,terrainY(a.x,a.z)+a.y*1.4+.055,a.z+.5);
    return {now:performance.now(),hp:poiPlayerHP,attack:a?{start:a.start,hit:a.hit,pending:a.pending,resolved:a.visualHitAt,x:a.x,z:a.z}:null,
     screen:!!point&&point.x>=0&&point.x<=canvas.clientWidth&&point.y>=0&&point.y<=canvas.clientHeight,
     resolution:window.__ordinaryCueResolve,frames:window.__ordinaryCueFrames??0,draw:window.__ordinaryCueDraw??[],geometry:window.__ordinaryCueGeo??[],opportunities:window.__ordinaryCueOpportunities??[]};
   },
  },`);
const resolveAnchor='  const timely=now-a.hit<poiEnemyContactTolerance(a);';
fixture=inject(fixture,resolveAnchor,resolveAnchor+`
  if(a===window.__ordinaryCueAttack)window.__ordinaryCueResolve={now,timely,late:now-a.hit};
`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
const geo='function poiEnemyCueTilesGeometry(a,tiles){';
const draw=' try{for(const {gpu,alpha} of draws){gl.blendColor(0,0,0,alpha);draw(gpu,vp)}}';
const pipe='function poiDrawNorthAxeCue(now,vp){';
// Optional anchors keep the exact earlier build red on behavior instead of
// rejecting its HTML at fixture construction.
if(fixture.includes(geo)){
 fixture=inject(fixture,geo,`function poiEnemyCueTilesGeometry(a,tiles){
 const m=__ordinaryCueRealTriangles(a,tiles);
 if(a===window.__ordinaryCueAttack){
  const colours=Array.from({length:m.c.length/3},(_,i)=>m.c.slice(i*3,i*3+3));
  const fractions=new Set();
  for(let i=0;i<m.p.length;i+=3)for(const v of [m.p[i],m.p[i+2]])
   if(Math.abs(v-Math.round(v))>.015&&Math.abs(v*2-Math.round(v*2))>.015)fractions.add(Math.round((v-Math.floor(v))*100));
  window.__ordinaryCueGeo.push({vertices:m.p.length/3, roundedOffsets:fractions.size,
    red:colours.length>0&&colours.every(([r,g,b])=>r>=.8&&r>2*g&&r>2*b),tiles:tiles.length});
 }
 return m;
}
function __ordinaryCueRealTriangles(a,tiles){`);
 fixture=inject(fixture,pipe,pipe+`
  window.__ordinaryCueFrames=(window.__ordinaryCueFrames??0)+1;
  const cueProbe=window.__ordinaryCueAttack;
  if(cueProbe?.pending&&now>=cueProbe.start&&now<cueProbe.hit)window.__ordinaryCueOpportunities.push(now);
 `);
 fixture=inject(fixture,draw,` try{for(const {gpu,alpha} of draws){
  gl.blendColor(0,0,0,alpha);draw(gpu,vp);
  const log=window.__ordinaryCueDraw,buffers=window.__ordinaryCueGPU;
  if(log&&buffers){if(!buffers.has(gpu))buffers.set(gpu,log.length+1);
   log.push({now,alpha,vertices:gpu.count,buffer:buffers.get(gpu),blend:gl.isEnabled(gl.BLEND)});}
 }}`);
}
if(process.env.ENEMY_CUE_LAYOUT_ONLY==='1'){
 const scripts=[...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)]
  .filter(([,attrs])=>!attrs||!/\b(?:src|type)\s*=/.test(attrs));
 assert(scripts.length>0);
 for(const [,,source] of scripts)new Script(source);
 console.log('PASS exact ordinary enemy cue fixture anchors and scripts');
 process.exit(0);
}
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Enemy cue QA</title>':fixture)});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='launch';
const watchdog=setTimeout(()=>{console.error('Enemy cue browser stalled at '+checkpoint);process.exit(1)},65000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const reducedMotion of ['no-preference','reduce']){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,reducedMotion});
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(13000);
  const q=()=>p.evaluate(()=>window.__editorTest?.ordinaryCueQA.state());
  const when=(f,a=null,t=5000)=>p.waitForFunction(f,a,{polling:35,timeout:t});
  try{
   checkpoint=reducedMotion+': boot';
   await p.goto(base+'/seed');
   await p.evaluate(()=>{
    const worn={head:null,torso:null,legs:null,feet:null};
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0,worn}));
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   });
   await p.goto(base+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   await when(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap').hasAttribute('data-analog-play'));
   checkpoint=reducedMotion+': genuine melee windup, draw, contact';
   let judged,warning;
   for(let attempt=0;attempt<5;attempt++){
    await p.evaluate(()=>window.__editorTest.ordinaryCueQA.begin());
    await when(()=>window.__editorTest.ordinaryCueQA.state().attack?.pending===false);
    judged=await q();
    // A hosted SwiftShader frame can exceed the game's natural 170ms
    // contact tolerance. Never accept a late attack dealing damage.
    if(judged.resolution?.timely===false){
     assert.equal(judged.hp,100,'an expired real attack cannot deal delayed damage');
     console.log(reducedMotion+' CI frame expired '+Math.round(judged.resolution.late)+'ms after contact; retry '+(attempt+1));
     continue;
    }
    assert(judged.resolution?.timely&&judged.screen&&judged.hp===94,'normal enemy contact is real and damage balance remains 6: '+JSON.stringify(judged));
    assert(judged.geometry.some(g=>g.red&&g.vertices>=36&&g.roundedOffsets>=5&&g.tiles===1),
     'actual submitted VBO starts with red, rounded perimeter geometry rather than a 6-vertex square: '+JSON.stringify(judged));
    warning=judged.draw.filter(d=>d.now<judged.attack.resolved);
    assert(warning.length>0&&warning.every(d=>d.blend&&d.vertices>=36&&d.alpha>=.16&&d.alpha<.38),
     'every observed warning is a real faint alpha-blended rounded GL draw');
    assert.equal(new Set(warning.map(d=>d.buffer)).size,1,'pulsing does not rebuild the VBO');
    const samples=warning.map(d=>d.alpha),sampledFrames=new Set(warning.map(d=>d.now)).size;
    if(reducedMotion==='reduce')assert(samples.every(a=>Math.abs(a-.27)<.001),'reduced-motion browser keeps a steady cue');
    if(warning.length<2&&judged.opportunities.length===1&&judged.opportunities[0]===warning[0].now){
     assert.equal(judged.draw.length,warning.length,'no cue drew after a timely hit on this starved attempt');
     console.log(reducedMotion+' CI only ran one pre-contact GL frame with a correct cue; retry '+(attempt+1));
     continue;
    }
    assert(sampledFrames>=2,'actual GL renders multiple distinct faint alpha-blended warning frames');
    if(reducedMotion==='no-preference')assert(Math.max(...samples)-Math.min(...samples)>.02,'normal opacity changes smoothly over the real warning');
    break;
   }
   assert(judged.resolution?.timely&&warning?.length>=2,'bounded retries must still observe a timely hit and two real warning frames: '+JSON.stringify(judged));
   checkpoint=reducedMotion+': ordinary cue retires after contact';
   await when(({frames,contact})=>{const s=window.__editorTest.ordinaryCueQA.state();return s.frames>=frames+2&&s.now>contact+120},{frames:judged.frames,contact:judged.attack.resolved});
   const later=await q();
   assert(later.draw.length===warning.length&&later.draw.every(d=>d.now<judged.attack.resolved),'no telegraph VBO is submitted after a regular hit');
   assert.deepEqual(errors,[]);
   console.log('PASS real ordinary enemy red cue in '+reducedMotion+', transparent rounded mesh, cache, and removal');
  }catch(e){console.error(checkpoint,JSON.stringify(await q().catch(()=>null)),errors);throw e}
  finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
