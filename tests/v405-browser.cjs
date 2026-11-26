const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  readySave:()=>workshopResumeReady&&poiWalkActive&&facilitySite?.id==='frontier',
  set:()=>{
   if(!workshopResumeRestorePosition({x:21,z:29,y:0,facing:3}))throw Error('vault location');
   const old=poiOrbitDungeonLookUp();
   const Q=FRONTIER_RUINS.ARENA_MOBS.slice(0,2);
   for(const p of Q){
    const found=[...poiMonsterStates].find(([o])=>o.x===p.x&&o.z===p.z&&o.type===p.type);
    if(!found)throw Error('missing fixture spawn');
    poiPlayerDamageTarget(found,p.x,p.z,1500,null,performance.now(),true,true,{companion:p===Q[1]});
   }
   poiPlayerHP=63;poiCombatHud();
   return {up:old,keys:poiHotbarRead().frontierRuinsDefeats,writes:window.__saveWrites};
  },
  inspect:()=>{
   const q=FRONTIER_RUINS.ARENA_MOBS;
   const actors=[...poiMonsterStates.keys()],present=p=>actors.some(o=>o.x===p.x&&o.z===p.z&&o.type===p.type);
   return {x:poiWalkX,z:poiWalkZ,hp:poiPlayerHP,dead:q.slice(0,2).map(present),alive:q.slice(2).map(present),up:poiOrbitDungeonLookUp()};
  },
  persisted:()=>{const p=JSON.parse(localStorage.getItem(WORKSHOP_RESUME_KEY));return {hp:p.frontierHp,x:p.position?.x,z:p.position?.z,writes:window.__saveWrites}}
 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 await p.addInitScript(()=>{
  window.__saveWrites=0;const prior=Storage.prototype.setItem;
  Storage.prototype.setItem=function(k,v){if(String(k).endsWith('world-workshop-resume-v1'))window.__saveWrites++;return prior.call(this,k,v)};
 });
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.readySave(),null,{timeout:25000});
 const e=await p.evaluate(()=>window.__editorTest.qa398.set());
 a(e.up);a.equal(e.keys.length,2);
 await p.waitForFunction(()=>window.__editorTest.qa398.persisted().hp===63,null,{timeout:2100});
 const before=await p.evaluate(()=>window.__editorTest.qa398.persisted());
 a.equal(before.x,21);a.equal(before.z,29);a(before.writes>e.writes);
 await p.waitForTimeout(1300);
 const idle=await p.evaluate(()=>window.__editorTest.qa398.persisted());a.equal(idle.writes,before.writes);
 await p.reload({waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.readySave(),null,{timeout:25000});
 const after=await p.evaluate(()=>window.__editorTest.qa398.inspect());console.log({e,before,idle,after});
 a.deepEqual(after,{x:21,z:29,hp:63,dead:[false,false],alive:[true,true,true,true],up:true});
 console.log('PASS automatic position and HP sample, no writes while idle, fixed foes stay defeated after reload');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
