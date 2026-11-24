import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {Script} from 'node:vm';
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function connect(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
let page=connect(h,"if(facilityParams.get('test')==='1')window.__editorTest={",
 "if(facilityParams.get('test')==='1')window.__editorTest={"+`
 wakeQA:{
  manual:()=>{window.__davidWake.manual=true},draw:()=>render(),
  data:()=>({now:performance.now(),player:[poiWalkX,poiWalkZ,poiWalkLevel],hp:poiPlayerHP,
   started:poiDavidBattleActive(performance.now()),pulls:window.__davidWake.pulls,frames:window.__davidWake.frames,
   introScore:window.__davidWake.introScore,cover:$('pineStartupCover').hidden,errors:gl.getError(),
   d:[...poiMonsterStates].find(([o])=>o.type==='monsterStoneDavid')?.[1]?.david??null}),
 },
 `);
page=connect(page," requestAnimationFrame(render);"," if(!window.__davidWake.manual)requestAnimationFrame(render);");
page=connect(page,"  if(typeof poiDavidExtractionFoley==='function')poiDavidExtractionFoley(o,s,b,i,now);",
 `  window.__davidWake.pulls.push({n:i,t:now,age:now-d.wakeAt,pos:[s.x,s.z],battle:poiDavidBattleActive(now)});
  if(typeof poiDavidExtractionFoley==='function')poiDavidExtractionFoley(o,s,b,i,now);`);
page=connect(page,"   if(art==='monsterStoneDavid')poiDavidGeometry(part,cx,y,cz,david);",`
   if(art==='monsterStoneDavid'){
    poiDavidGeometry(part,cx,y,cz,david);
    const w=window.__davidWake,phase=david?.phase??'dormant',t=david?.wakeAge??-1;
    const phaseCount=w.frames.filter(f=>f.phase===phase).length;
    if(phaseCount<(phase==='dormant'?10:phase==='wake'?85:20)){
     const rig=poiDavidRig(david),crystals=rig.eyes.map(()=>0),tips=rig.swordTips.map(()=>Infinity),m=part;
     for(let j=0;j<m.p.length;j+=3){
      const x=m.p[j]-cx,yy=m.p[j+1]-y,z=m.p[j+2]-cz;
      if(yy>4.65&&yy<4.86)rig.eyes.forEach(([a,b,c],i)=>{
       if(Math.hypot(a-x,b-yy,c-z)<.11)crystals[i]=Math.max(crystals[i],m.c[j]-m.c[j+1]);
      });
      if(yy<4)rig.swordTips.forEach(([a,b,c],i)=>{tips[i]=Math.min(tips[i],Math.hypot(a-x,b-yy,c-z))});
     }
     const frame={t,phase,crystals,visibleTips:tips,n:m.p.length/3,tipY:rig.swordTips.map(p=>p[1]),
      power:rig.wakeGlow,now,battle:poiDavidBattleActive(now),x:cx-.5,z:cz-.5};
     w.frames.push(frame);
    }
   }`);
for(const match of page.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(match[1]);
if(process.env.DAVID_AWAKENING_SYNTAX_ONLY){console.log('wake native fixture instruments exact inline scripts');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Awaken QA</title>':page)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const url='http://127.0.0.1:'+server.address().port,screenshots=process.env.FACILITY_SCREENSHOTS;
let browser;
try{
 if(screenshots)await mkdir(screenshots,{recursive:true});
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.7,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{window.__davidWake={frames:[],pulls:[],introScore:[]};});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.stack||e.message));p.setDefaultTimeout(20000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:24,z:100,y:0,facing:2},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.16,orbitDistance:6.3}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
 });
 await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 const val=()=>p.evaluate(()=>window.__editorTest.wakeQA.data());
 await p.waitForFunction(()=>{const q=window.__editorTest?.wakeQA.data();return q?.frames.some(f=>f.phase==='dormant')});
 const old=await val();
 assert.deepEqual(old.player,[24,100,0]);assert.equal(old.started,false);
 if(screenshots)await p.screenshot({path:screenshots+'/david-awakening-01-dormant.png'});
 // Pause only the test clock, not the production actor or motion. Each
 // small time step still calls the original world draw and gameplay loop.
 await p.evaluate(()=>window.__editorTest.wakeQA.manual());
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+3000);
 const advance=async()=>{await p.clock.fastForward(56);await p.evaluate(()=>window.__editorTest.wakeQA.draw());return val()};
 // Trusted input in third person yaw 0: ArrowUp physically enters +z.
 const enter=async z=>{
  await p.keyboard.press('ArrowUp');
  let q;
  for(let i=0;i<20;i++){q=await advance();if(q.player[0]===24&&q.player[1]===z)return q}
  assert.fail(JSON.stringify({want:z,got:q?.player,d:q?.d}));
 };
 const lip=await enter(101);
 assert(!lip.d?.awake,'arena lip at three tiles is still dormant');
 let live=await enter(102);
 for(let i=0;i<10&&!live.d?.awake;i++)live=await advance();
 assert(live.player[0]===24&&live.player[1]===102&&live.d?.awake,JSON.stringify({player:live.player,d:live.d}));
 let pullShot=false;
 for(let i=0;i<64&&!(live.started&&(live.d?.attack||live.frames.some(f=>f.z!==104)));i++){
  live=await advance();
  if(screenshots&&!pullShot&&live.pulls.length===1){
   pullShot=true;await p.screenshot({path:screenshots+'/david-awakening-02-first-pull.png'});
  }
 }
 const q=await val(),frames=q.frames,dormant=frames.find(f=>f.phase==='dormant');
 assert(q.cover&&q.errors===0);assert.deepEqual(errors,[]);
 assert(dormant.visibleTips.every(v=>v<.011)&&dormant.tipY.every(y=>y<0),'both actual emitted ends laid into floor');
 const ignition=frames.find(f=>f.phase==='wake'&&f.power>.24&&f.tipY.every(y=>y<0));
 assert(ignition&&ignition.crystals.every((r,i)=>r>.65&&r-dormant.crystals[i]>.25),'both actual iris meshes brighten before any pull: '+JSON.stringify(frames.filter(f=>f.phase==='wake').map(f=>[f.t,f.power,f.crystals,f.tipY])));
 assert.deepEqual(q.pulls.map(x=>[x.n,Math.round(x.age),x.pos,x.battle]),[[0,920,[24,104],false],[1,1840,[24,104],false]]);
 assert(q.pulls[1].t-q.pulls[0].t>=920);
 assert(frames.some(f=>f.phase==='wake'&&f.tipY[0]>.15&&f.tipY[1]<0&&f.visibleTips.every(v=>v<.011)),'one real blade moves independently');
 assert(frames.some(f=>f.phase==='wake'&&f.tipY.every(y=>y>.15)),'both blades actually clear before combat');
 assert(frames.filter(f=>f.phase==='wake').every(f=>!f.battle&&f.x===24&&f.z===104),'physical boss is still until fully staged');
 assert(q.started);
 if(screenshots)await p.screenshot({path:screenshots+'/david-awakening-03-combat.png'});
 console.log('PASS native distance, genuine planted blade vertices, eye brightening, individual authored pulls, and strict stance-to-real-combat gate',q.pulls);
 await ctx.close();
}finally{await browser?.close();server.close()}
