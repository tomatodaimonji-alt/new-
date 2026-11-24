import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(h.split(a).length,2,a);h=h.replace(a,b)}
const api="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(api,api+`
  newCompanionAI:{
   frame:()=>render(),
   place:()=>{
    const a=poiCompanionActor;if(!a)return false;
    const base=Math.hypot(a.x-poiWalkX,a.z-poiWalkZ);
    for(const [dx,dz] of [[-1,0],[0,1],[1,0],[0,-1]]){
     const x=a.x+dx,z=a.z+dz;
     if(Math.hypot(x-poiWalkX,z-poiWalkZ)<=base||!poiWalkCanStep(x,z,a.x,a.z)||!poiCompanionAttackClear(a,{x,z},a.y))continue;
     const o={x,z,y:a.y,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);
     window.__ordinaryCompanionEnemy={o,s};poiMonsterStates.set(o,s);poiMonsterMeshDirty=true;
     return true;
    }
    return false;
   },
   order:m=>poiCompanionCommand(m),
   state:()=>{
    const a=poiCompanionActor,e=window.__ordinaryCompanionEnemy,s=e?.s,q=s?.playerAttack;
    return {...poiCompanionSnapshot(performance.now()),player:[poiWalkX,poiWalkZ],pHP:poiPlayerHP,
     weapon:poiEquippedWeapon(),lastPlayerAttack:poiWalkActionStarted,
     enemy:s?{x:s.x,z:s.z,hp:s.hp,aimedAlly:q?.companionVictim===a,pending:!!q?.pending}:null,
     trueAlly:a?.attackMotion?{pending:a.attackMotion.pending,hit:a.attackMotion.hit,at:a.attackMotion.visualHitAt??null}:null,
     sceneReady:!!poiCompanionMesh,now:performance.now()};
   }
  },
`);
inject(' requestAnimationFrame(render);',' if(!window.__companionIntentManual)requestAnimationFrame(render);');
inject('function poiWildSpawnFrame(now,rng=Math.random){','function poiWildSpawnFrame(now,rng=Math.random){return;');
for(const [,s] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.COMPANION_INTENT_SYNTAX_ONLY){console.log('native companion intent fixture parsed');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':h)});
await new Promise((ok,no)=>srv.listen(0,'127.0.0.1',ok).once('error',no));
const url='http://127.0.0.1:'+srv.address().port;let browser,last,phase='launch';
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const c=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(30000);
 await p.clock.install({time:new Date('2026-04-01T10:00:00Z')});
 await p.goto(url+'/seed');
 await p.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[9]={type:'slimeSoul',count:1,durability:36};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,slots,
    companionSoul:{version:1,active:'slimeSoul',pending:null}}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:102,z:93,y:0,facing:1},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:-.15,orbitPitch:.12,orbitDistance:5.5}}));
 });
 async function boot(){
  await p.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded',timeout:45000});
  await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
  await p.waitForFunction(()=>window.__editorTest?.facility()?.active,null,{polling:50,timeout:30000});
  await p.clock.pauseAt((await p.evaluate(()=>Date.now()))+1500);
  await p.evaluate(()=>{window.__companionIntentManual=true});
 }
 const see=async()=>last=await p.evaluate(()=>window.__editorTest.newCompanionAI.state());
 const order=async m=>p.evaluate(m=>window.__editorTest.newCompanionAI.order(m),m);
 const tick=async(ms=36)=>{await p.clock.fastForward(ms);await p.evaluate(()=>window.__editorTest.newCompanionAI.frame());return see()};
 const until=async fn=>{for(let i=0;i<125;i++){const s=await tick();if(fn(s))return s}throw Error('condition not reached '+JSON.stringify(last))};
 await boot();
 phase='untouched player witnesses two ordinary combatants choose and resolve real hits';
 const init=await until(s=>s.actor&&s.sceneReady);
 assert.equal(init.mode,'auto');
 assert(await p.evaluate(()=>window.__editorTest.newCompanionAI.place()));
 let sawAllyWindup=false,sawEnemyWindup=false;
 const contact=await until(s=>{
  if(s.trueAlly?.pending&&s.enemy.hp===35)sawAllyWindup=true;
  if(s.enemy?.pending&&s.enemy.aimedAlly)sawEnemyWindup=true;
  return s.enemy?.hp===29&&s.hp<36;
 });
 assert(sawAllyWindup&&sawEnemyWindup,'both kept genuine windup and committed target');
 assert.equal(contact.hp,30,'one normal slime hit');assert.equal(contact.pHP,100);
 assert.equal(contact.lastPlayerAttack,init.lastPlayerAttack);assert.equal(contact.weapon,'equipWoodSword');
 assert.notDeepEqual([contact.enemy.x,contact.enemy.z],[contact.actor.x,contact.actor.z]);
 phase='hold flee through native frames including away movement, then reload the same active HP and stance';
 assert((await order('flee')).ok);
 const fleeing=await tick();assert.equal(fleeing.mode,'flee');
 for(let i=0;i<7;i++){await p.keyboard.press('ArrowRight');await tick(205)}
 for(let i=0;i<10;i++)await tick(105);
 const away=await see();assert(away.player[0]>=107,JSON.stringify(away));assert.equal(away.enemy.hp,29);assert.equal(away.weapon,'equipWoodSword');
 assert(Math.hypot(away.actor.x-away.player[0],away.actor.z-away.player[1])<=3);
 await p.clock.resume();await boot();
 const reloaded=await until(s=>s.actor&&s.sceneReady);assert.equal(reloaded.mode,'flee');assert.equal(reloaded.hp,away.hp);
 assert((await order('fight')).ok);
 const command=await tick();assert.equal(command.mode,'fight');assert.equal(command.weapon,'equipWoodSword');
 assert.deepEqual(errors,[]);
 console.log('Real companion AI: autonomous fight, ordinary wild motion, target lock, ally damage and durable flee/follow');
}catch(e){console.error('Companion native failure at',phase,last);throw e}
finally{await browser?.close();await new Promise(ok=>srv.close(ok))}
