const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  run:()=>{
   const t=performance.now()+100;
   const spec=Object.fromEntries(['frontierchief','frontiersera','frontiershopkeeper','frontierren'].map(id=>[id,poiStatBase({id}).intelligence]));
   const npc=poiTownNpcActors.find(a=>a.role.id==='frontierchief');
   if(!npc)throw Error('no Roan');
   const recruit=poiHumanPartyRecruit(npc,t);
   if(!recruit.ok)throw Error('recruit '+JSON.stringify(recruit));
   const actor=poiPartyActorById(recruit.id);
   if(!actor)throw Error('no companion');
   const hp=()=>poiHumanPartyMembers(poiHotbarRead()).find(m=>m.id===recruit.id)?.hp;
   if(!workshopResumeRestorePosition({x:23,z:38,y:0,facing:0}))throw Error('room fixture');
   const entry=[...poiMonsterStates].find(([o,s])=>o.type==='monsterGoblin'&&s.frontierRuins&&!s.frontierRuinsBoss);
   if(!entry)throw Error('no goblin');
   const [o,s]=entry;
   for(const [f,v] of poiMonsterStates)if(f!==o)v.hp=0;
   const place=(x,z,sx,sz)=>{
    Object.assign(actor,{x,z,px:x,pz:z,fx:x,fz:z,freeMoving:false,humanSidestep:null,humanSidestepHold:0});
    Object.assign(s,{x:sx,z:sz,hp:55,playerAttack:null,nextAttack:0});
   };
   const attack=(at)=>{
    if(!poiEnemyBeginPlayer(o,s,at,{x:actor.x,z:actor.z,actor,p:poiCompanionPosition(actor)}))throw Error('fixture cannot start attack at '+at);
    return s.playerAttack;
   };
   place(19,38,19,37);
   const old=hp(),first=attack(t);
   poiHumanSidestepFrame(t+200,()=>0);
   const firstMoved=!!actor.humanSidestep;
   poiEnemyResolvePlayer(first.hit);
   const learned=hp(),recorded=actor.learnedAttacks?.get(poiEnemyLearnKey(first))?.hits===1;
   const second=attack(t+1200);
   poiHumanSidestepFrame(t+1400,()=>0);
   const started=!!actor.humanSidestep,origin=actor.px;
   poiHumanSidestepFrame(t+1480,()=>0);
   const middle=actor.px;
   poiHumanSidestepFrame(t+1590,()=>0);
   const end=actor.px;
   poiEnemyResolvePlayer(second.hit);
   const after=hp();
   place(5,48,5,47);
   const third=attack(t+2450);
   poiHumanSidestepFrame(t+2660,()=>0);
   const blocked=!!actor.humanSidestep;
   poiEnemyResolvePlayer(third.hit);
   return {spec,old,learned,recorded,firstMoved,started,origin,middle,end,after,blocked,wallHp:hp(),gl:gl.getError()};
  }
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
 console.log('Sidestep outcome',e);
 a.deepEqual(e.spec,{frontierchief:5,frontiersera:3,frontiershopkeeper:4,frontierren:2});
 a(!e.firstMoved&&e.recorded&&e.learned<e.old);
 a(e.started&&Math.abs(e.middle-e.origin)>.15&&Math.abs(e.end-e.middle)>.10);
 a.equal(e.after,e.learned);
 a(!e.blocked&&e.wallHp<e.after);
 a.equal(e.gl,0);
 console.log('PASS live human ally learns first hit, physically escapes second, takes damage when walls prevent dodge');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
