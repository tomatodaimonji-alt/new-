const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa426:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(n=>n.role.id==='frontierregna'),
  seed:()=>{
   if(!poiEconomyWrite({...poiHotbarRead(),adventureRank:'B',learnedSkills:['ice-fang']}))throw Error('test skill');
   poiEconomyRefresh();
   if(!workshopResumeRestorePosition({x:115,z:30,y:0,facing:1,cave:false}))throw Error('position');
   poiWildClear();poiTownNpcNext=Infinity;poiNextMobTick=Infinity;
   const o={type:'monsterSlime',x:117,z:30,y:0,rot:0},s=poiCombatActorMake(o);s.hp=150;
   poiMonsterStates.set(o,s);poiCombatLockReset();poiSkillBarSync();
   window.__editorTest.qa426.target={o,s};
  },
  mp:()=>[poiSkillMana(null).mp,poiSkillMana('frontierregna').mp],
  preview:()=>poiIceFangCasts.find(c=>c.owner===null)?.done??null,
  move:()=>{
   const t=window.__editorTest.qa426.target;t.s.x=t.s.fromX=118;t.s.moveStarted=-10000;
  },
  result:()=>{
   const t=window.__editorTest.qa426.target;
   const q=poiIceFangCasts.find(c=>c.owner===null);return {hp:t.s.hp,done:q?.done??false,x:q?.x??null};
  },
  regna:()=>{
   const t=window.__editorTest.qa426.target,n=poiTownNpcActors.find(a=>a.role.id==='frontierregna'),now=performance.now();
   Object.assign(n,{x:116,z:30,y:0,actorLeg:null,frontierCombat:null,attackAt:0,frontierStrike:null});
   frontierNpcLifeStep(n,{hour:11,minute:660},now,{left:4});
   return n.frontierSkillCast?.o===t.o;
  },
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa426?.ready(),null,{timeout:30000});
 const via=m=>p.evaluate(m=>window.__editorTest.qa426[m](),m);
 await via('seed');a.deepEqual(await via('mp'),[44,44]);
 await p.locator('#poiBagToggle').tap();await p.locator('#poiSkillListOpen').tap();
 a.match(await p.locator('#poiSkillListRows').innerText(),/氷牙陣.*消費MP 12/);
 a.equal(await p.locator('#poiBagPlayerMpValue').textContent(),'44/44');
 await p.locator('#poiSkillListDialog button').tap();await p.locator('#poiBagToggle').tap();
 await p.locator('#poiSkillBar button').tap();
 a.deepEqual(await via('mp'),[32,44]);a.equal(await via('preview'),false);
 await via('move');
 await p.waitForFunction(()=>window.__editorTest.qa426.result().hp===94,null,{timeout:7000,polling:75});
 const q=await via('result');console.log(q);a.equal(q.done,true);a.ok(Math.abs(q.x-118.5)<.12);
 a.equal(await via('regna'),true);a.deepEqual(await via('mp'),[32,32]);
 await p.waitForFunction(()=>window.__editorTest.qa426.result().hp===38,null,{timeout:7000,polling:110});
 a.deepEqual(errors,[]);console.log('PASS player touch controls, shared rank MP, windup, tracking hit and Regna auto-cast');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
