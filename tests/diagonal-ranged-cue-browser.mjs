import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(html,anchor,anchor+`
  diagonalCueQA:{
   manual:()=>{window.__diagManualFrames=true},
   frame:()=>{if(!window.__diagManualFrames)throw Error('manual frame phase not armed');render()},
   begin:()=>{
    const [o,s]=[...poiMonsterStates].find(([o])=>o.type==='monsterSkelArcher'&&o.x===105&&o.z===86&&o.y===0)??[];
    if(!s||s.x!==105||s.z!==86)throw Error('expected live authored archer at its original post');
    const now=performance.now();
    window.__diagDraw=[];window.__diagBuild=[];window.__diagGPU=new WeakMap();
    window.__diagResolve=null;window.__diagAttack=null;window.__diagCueFrames=[];
    if(!poiEnemyBeginPlayer(o,s,now))return false;
    window.__diagAttack=s.playerAttack;return true;
   },
   addWall:()=>{
    const a=window.__diagAttack;
    if(!a?.pending)throw Error('wall must close during the already-committed windup');
    // Disposable map only. A normal stonewall participates in both real
    // walk and projectile clipping, without mocking either function.
    world=world.concat({type:'stonewall',x:106,z:87,y:0,rot:0});
    return !poiPlayerRayClear(106,87,0,105,86);
   },
   state:()=>{
    const a=window.__diagAttack;
    return {now:performance.now(),hp:poiPlayerHP,x:poiWalkX,z:poiWalkZ,
     a:a?{start:a.start,hit:a.hit,pending:a.pending,angular:a.angular,dx:a.dx,dz:a.dz,sx:a.sx,sz:a.sz,x:a.x,z:a.z}:null,
     resolution:window.__diagResolve,cueFrames:window.__diagCueFrames??[],draw:window.__diagDraw??[],build:window.__diagBuild??[]};
   }
  },
`);
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
fixture=inject(fixture,'function poiMobFrame(now){','function poiMobFrame(now){if(window.__isolateDiagonalCue)return;');
const regionalPolicy='function poiWildFieldFixedPolicy(obj,site=facilitySite){';
// Production intentionally replaces this authored outdoor marker with a
// random roaming birth. In this disposable fixture only, instantiate the
// same marker as the exact authored archer to isolate aiming/rendering.
fixture=inject(fixture,regionalPolicy,regionalPolicy+
 "if(window.__isolateDiagonalCue&&site?.id==='base'&&obj.type==='monsterSkelArcher'&&obj.x===105&&obj.z===86&&obj.y===0)return null;");

const renderSchedule='function render(){\n if(window.pineStartup.failed)return;\n requestAnimationFrame(render);';
fixture=inject(fixture,renderSchedule,renderSchedule.replace('requestAnimationFrame(render);',
 'if(!window.__diagManualFrames)requestAnimationFrame(render);'));
const timely='  const timely=now-a.hit<poiEnemyContactTolerance(a);';
fixture=inject(fixture,timely,timely+`
  if(a===window.__diagAttack)window.__diagResolve={now,timely};
`);
const pipe='function poiDrawNorthAxeCue(now,vp){';
fixture=inject(fixture,pipe,pipe+`
 const qaCue=window.__diagAttack;
 if(qaCue?.pending&&window.__diagCueFrames.length<50){
  const state=[...poiEnemyPending].find(s=>s.playerAttack===qaCue);
  window.__diagCueFrames.push({now,hidden:document.hidden,active:poiEnemyThreatEnabled(),
   source:!!state&&poiEnemyAttackSourceValid(state,qaCue),
   sameFloor:qaCue.y===poiWalkLevel,visible:poiDungeonVisualVisible(qaCue.sx,qaCue.sz,qaCue.y)});
 }
`);
const geometry='    gpu=m.p.length?upload(m):null;';
fixture=inject(fixture,geometry,geometry+`
    if(a===window.__diagAttack){
     const snap={now,vertices:m.p,red:m.c.length>0&&m.c.every((v,i)=>i%3===0?v>.8:v<.42),count:m.p.length/3};
     window.__diagBuild.push(snap);if(gpu)window.__diagGPU.set(gpu,window.__diagBuild.length-1);
    }
`);
const draw=' try{for(const {gpu,alpha} of draws){gl.blendColor(0,0,0,alpha);draw(gpu,vp)}}';
fixture=inject(fixture,draw,` try{for(const {gpu,alpha} of draws){
  gl.blendColor(0,0,0,alpha);draw(gpu,vp);
  const sample=window.__diagGPU?.get(gpu);
  if(sample!==undefined)window.__diagDraw.push({sample,now,alpha,count:gpu.count,blend:gl.isEnabled(gl.BLEND)});
 }}`);
if(process.env.DIAGONAL_CUE_LAYOUT_ONLY==='1'){
 for(const [,,script] of [...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(script);
 console.log('PASS exact diagonal cue fixture anchors and script parsing');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
const toModel=(m,a)=>{
 const vertices=[];
 for(let i=0;i<m.vertices.length;i+=3){
  const x=m.vertices[i]-.5-a.sx,z=m.vertices[i+2]-.5-a.sz;
  vertices.push([x*a.dx+z*a.dz,-x*a.dz+z*a.dx]);
 }
 return vertices;
};
function inside(vertices,x,z){
 const edge=(a,b)=>(b[0]-a[0])*(z-a[1])-(b[1]-a[1])*(x-a[0]);
 for(let i=0;i<vertices.length;i+=3){
  const [a,b,c]=vertices.slice(i,i+3);
  if(Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))<1e-7)continue;
  const h=[edge(a,b),edge(b,c),edge(c,a)];
  if(h.every(v=>v>=-1e-6)||h.every(v=>v<=1e-6))return true;
 }
 return false;
}
function assertWarning(state){
 const d=state.draw[0],g=state.build[d?.sample];
 assert(d?.count>0&&d.blend&&d.alpha>=.16&&d.alpha<.39&&g?.red,'actual production red lane reaches GL before resolve');
 const v=toModel(g,state.a),reach=Math.hypot(state.a.x-state.a.sx,state.a.z-state.a.sz);
 for(let t=.30;t<reach-.08;t+=.09)assert(inside(v,t,0),'connected centerline at '+t);
 assert(Math.max(...v.map(point=>Math.abs(point[1])))<.57,'diagonal warning must not light staircase corners or adjacent tiles');
 assert(Math.max(...v.map(point=>point[0]))<=reach+.25,'warning does not run well past the committed endpoint');
 assert(!inside(v,reach-.6,.65),'adjacent point stays unlit beside the actual diagonal path');
}
let browser,phase='launch';
const watchdog=setTimeout(()=>{console.error('diagonal cue stalled: '+phase);process.exit(1)},95000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const sample of ['contact','off-lane','wall','eight-range','outside-range']){
  const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
  const p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  const q=()=>p.evaluate(()=>window.__editorTest?.diagonalCueQA.state());
  try{
   phase=sample+': resume';
   await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
   await p.addInitScript(()=>{window.__isolateDiagonalCue=true});
   await p.goto(origin+'/seed');
   const start=sample==='eight-range'?{x:105,z:94}:sample==='outside-range'?{x:105,z:95}:{x:107,z:88};
   await p.evaluate(start=>{
    localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:null,potions:0}));
    localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{...start,y:0,facing:1},townLayout:5,townMapHeight:128,
     view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
   },start);
   await p.goto(origin+'/?resume=1&test=1');
   await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:18000});
   await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:30,timeout:9000});
   const wall=await p.evaluate(()=>Date.now());
   await p.clock.pauseAt(wall+1500);
   await p.evaluate(()=>window.__editorTest.diagonalCueQA.manual());
   // Playwright can intermittently drop a queued self-scheduling RAF while
   // changing clocks. Explicitly drive the same production render function
   // in small clock increments after the normal real page startup. This
   // runs actual world simulation, input integration, shader and GL calls.
   const tick=async ms=>{
    let left=ms;
    while(left>0){
     const step=Math.min(32,left);
     await p.clock.fastForward(step);
     await p.evaluate(()=>window.__editorTest.diagonalCueQA.frame());
     left-=step;
    }
   };
   phase=sample+': genuine diagonal archer';
   const accepted=await p.evaluate(()=>window.__editorTest.diagonalCueQA.begin());
   if(sample==='outside-range'){
    await tick(96);
    const state=await q();assert.deepEqual([state.x,state.z],[start.x,start.z]);
    assert(!accepted&&!state.a&&state.draw.length===0,'real archer cannot begin or draw a nine-tile attack');
    assert.deepEqual(errors,[]);
    console.log('PASS genuine native archer rejects nine tiles');
    continue;
   }
   assert(accepted,'authored archer accepts the actual in-range shot: '+sample);
   let warning=await q();
   // The required pre-contact GL submission is never skipped. More than
   // one frame is allowed if a transient app guard postpones the start.
   for(let i=0;i<8&&!warning.draw.length;i++){
    await tick(60);
    warning=await q();
   }
   assert(warning.draw.length>0,'no real pre-contact cue frame: '+JSON.stringify({
    start:warning.a?.start,hit:warning.a?.hit,now:warning.now,cueFrames:warning.cueFrames,build:warning.build.map(b=>b.count)}));
   assert.deepEqual([warning.x,warning.z,warning.a.sx,warning.a.sz],[start.x,start.z,105,86]);
   assert(warning.a.pending);
   if(sample==='eight-range')assert(warning.a.dx===0&&warning.a.dz===1&&warning.a.z-warning.a.sz===8);
   else assert(warning.a.angular&&Math.abs(warning.a.dx-warning.a.dz)<.01&&warning.a.dx>.70);
   assert.equal(warning.a.hit-warning.a.start,760);
   assertWarning(warning);
   if(sample==='off-lane'){
    await p.keyboard.press('ArrowRight');
    await tick(224);
    const side=await q();
    assert.deepEqual([side.x,side.z],[108,88],'actual movement enters the neighboring off-lane cell');
    assert.deepEqual(side.a,warning.a,'moving never retargets the actual pending diagonal strike');
   }else if(sample==='wall'){
    phase=sample+': real collision revalidation';
    assert.equal(await p.evaluate(()=>window.__editorTest.diagonalCueQA.addWall()),true);
    await tick(155);
    const clipped=await q(),late=clipped.draw.filter(d=>d.now>=warning.now+100);
    assert(late.length>0,'actual GL still displays the exposed, unclipped approach to the wall');
    for(const d of late){
     const v=toModel(clipped.build[d.sample],clipped.a);
     assert(inside(v,.36,0)&&Math.max(...v.map(point=>point[0]))<1.06,
      'the visible warning approaches but cannot continue through the real inserted wall');
    }
   }
   phase=sample+': real hit or evasive miss';
   const before=await q();
   await tick(Math.ceil(warning.a.hit-before.now)+96);
   const after=await q();
   assert(after.resolution?.timely&&!after.a.pending,'natural RAF resolves the original real attack at its established timing');
   if(sample==='contact'||sample==='eight-range')assert(after.hp<warning.hp,'staying on the projected line receives actual archer damage');
   else assert.equal(after.hp,warning.hp,'same committed attack cannot hurt beyond a wall or off-lane');
   assert(after.draw.every(d=>d.now<after.resolution.now),'warnings never outlast the archer contact');
   assert.deepEqual(errors,[]);
   console.log('PASS genuine native diagonal archer',sample);
  }catch(e){const s=await q().catch(()=>null);console.error(phase,JSON.stringify(s&&{...s,build:s.build.map(({vertices,...other})=>other)}),errors);throw e}
  finally{await ctx.close()}
 }
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
