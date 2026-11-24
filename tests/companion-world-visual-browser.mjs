import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const inject=(s,a,b)=>{assert.equal(s.split(a).length,2,a);return s.replace(a,b)};
const hook="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=inject(source,hook,hook+`
 visualQA:{
  frame:()=>render(),
  spawn:()=>{const o={type:'monsterSlime',x:poiWalkX+1,z:poiWalkZ,y:poiWalkLevel,rot:0},s=poiCombatActorMake(o);
   s.hp=35;s.nextAttack=performance.now()+40000;
   poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;window.__visualEnemy={o,s};},
  hurt:()=>poiCompanionHurt(7,performance.now()),
  return:()=>{const kit=poiHotbarRead();return poiCompanionUse(kit,poiInventorySlots(kit).findIndex(c=>c?.type==='slimeSoul'));},
  read:()=>{const s=poiCompanionSnapshot(performance.now()),el=document.querySelector('progress.poiCompanionHealth');
   const pixels=poiCompanionDrawPose?poiEnemyHealthAnchor(parameters().vp,poiCompanionDrawPose,poiEnemyHealthEnvelope('monsterSlime')):null;
   return {visible:!!el&&!el.hidden,hp:el?.value,max:el?.max,number:document.querySelectorAll('progress.poiCompanionHealth').length,
    green:el&&getComputedStyle(el).getPropertyValue('--poi-enemy-fill').trim(),where:el?.style.transform,pixels,
    player:[poiWalkX,poiWalkZ],actor:s.actor,model:window.__companionModelQA,enemy:window.__wildSlimeModelQA,
    phase:poiCompanionDrawPose?.attack?.phase??null,gl:gl.getError()};
  }
 },
`);
const renderOpen=`function render(){
 if(window.pineStartup.failed)return;
`;
h=inject(h,renderOpen+' requestAnimationFrame(render);',renderOpen+' if(!window.__visualManual)requestAnimationFrame(render);');
const companion='  poiAppendWildSlimeVisual(m,poiCompanionTemplate,pose,pose.facing);';
h=inject(h,companion,companion+`
  window.__companionModelQA={p:m.p.length,c:m.c.slice(),source:poiCompanionTemplate.p.slice()};
`);
const wild="   if(art==='monsterSlime'){";
h=inject(h,wild,wild+`
    if(obj===window.__visualEnemy?.o)
     window.__wildSlimeModelQA={p:part.p.length,c:part.c.slice(),source:part.p.map((v,i)=>v-[cx,y,cz][i%3])};
`);
h=inject(h,'function poiWildSpawnFrame(now,rng=Math.random){','function poiWildSpawnFrame(now,rng=Math.random){return;');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.SLIME_VISUAL_SYNTAX_ONLY){console.log('exact companion visual fixture scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>Slime QA</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const root='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const p=await(await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75})).newPage(),errors=[];
 p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(14000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});await p.goto(root+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[9]={type:'slimeSoul',count:1,durability:36};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weapon:'equipWoodSword',weaponDurabilityVersion:2,slots,gold:3,potions:0,
   companionSoul:{version:1,active:'slimeSoul',pending:null}}));
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":360000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await p.goto(root+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});
 await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
 await p.evaluate(()=>{window.__visualManual=true;window.__editorTest.visualQA.spawn()});
 const advance=async(ms=38)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.visualQA.frame());return p.evaluate(()=>window.__editorTest.visualQA.read())};
 let s;for(let i=0;i<20;i++){s=await advance();if(s.visible&&s.model&&s.enemy)break}
 assert(s.visible&&s.model&&s.enemy,JSON.stringify(s&&[s.visible,s.player,s.actor]));
 assert.deepEqual([s.hp,s.max,s.number],[36,36,1]);
 assert.match(s.green,/#4f8f62,#9ec685/);assert(s.where.includes(Math.round(s.pixels.x)+'px'));
 assert.equal(s.model.p,s.enemy.p);assert.deepEqual(s.model.c,s.enemy.c);
 assert(s.model.source.every((n,i)=>Math.abs(n-s.enemy.source[i])<1e-8));
 const tag=s.where;
 await p.keyboard.press('ArrowUp');await advance(205);await p.keyboard.press('ArrowUp');
 for(let i=0;i<30;i++){s=await advance();if(s.where!==tag&&s.player[1]===91)break}
 assert.deepEqual(s.player,[102,91]);assert.notEqual(s.where,tag,'green bar follows the moving 3D body');
 assert(await p.evaluate(()=>window.__editorTest.visualQA.hurt()));
 s=await advance();assert.equal(s.hp,29);assert.equal(s.number,1);
 assert((await p.evaluate(()=>window.__editorTest.visualQA.return())).ok);
 s=await advance();assert.equal(s.visible,false);assert.equal(s.gl,0);assert.deepEqual(errors,[]);
 console.log('actual wild and allied WebGL geometry/material parity; projected live green HP and movement');
}finally{await browser?.close();server.close()}
