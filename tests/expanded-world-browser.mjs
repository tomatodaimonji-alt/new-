import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const node=AudioBufferSourceNode.prototype,srcStart=node.start;
  window.__loopAudioStarts=0;
  node.start=function(...a){if(this.loop)window.__loopAudioStarts++;return srcStart.apply(this,a);};
  const gl=WebGLRenderingContext.prototype,known=new WeakSet();
  const get=gl.getUniformLocation,uniform=gl.uniformMatrix4fv;
  gl.getUniformLocation=function(program,name){
   const loc=get.call(this,program,name);if(loc&&name==='uMVP')known.add(loc);return loc;
  };
  gl.uniformMatrix4fv=function(loc,transpose,values){
   if(loc&&known.has(loc))window.__townCombatVP=Array.from(values);
   return uniform.call(this,loc,transpose,values);
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:0,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true,touch=false){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 if(touch)await page.locator('[data-poi-dir="'+d+'"]').tap();else await page.keyboard.press(arrow[d]);
 try{
  await page.waitForFunction(([x,z])=>{
   const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;
  },[x+dx,z+dz],{timeout:required?2700:500});
 }catch(err){
  if(required)throw new Error(`Walk ${arrow[d]} from (${x},${z}) did not reach (${x+dx},${z+dz}). Actual: ${JSON.stringify((await state(page)).position)}`,{cause:err});
  return;
 }
 await page.waitForTimeout(186);
}
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const at=(x,z,level=0)=>({x,z,level});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function picture(page,label){
 if(!out)return;
 await settle(page);
 await page.screenshot({path:out+'/v144-'+label+'.png'});
}
async function noMapMutation(page,map){
 assert.deepEqual(await getMap(page),map,'NPCs, rooms and clock do not write authenticated game layout or tiles');
 await unchanged(page);
}
const action='#poiWalkAction';
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
function byId(info,id){return info.actors.find(o=>o.id===id);}
const worldKit='world-workshop-hotbar-v1';
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const scenery=[
 {name:'north-expansion',start:[34,11],route:[['n',7]],last:[34,4]},
 {name:'west-expansion',start:[11,49],route:[['w',7]],last:[4,49]},
 {name:'south-expansion',start:[41,76],route:[['s',8]],last:[41,84]},
 {name:'east-expansion',start:[116,66],route:[['e',8],['s',6]],last:[124,72]}
];
async function openRoad(browser,trip){
 const {ctx,page,errors}=await launch(browser,'base',{x:trip.start[0],z:trip.start[1]},{kit:stock});
 try{
  const map=await getMap(page),authority=await readStock(page);
  assert.deepEqual([map.width,map.height],[128,96],'expanded Game World dimensions');
  const anchor=(await state(page)).buildings.find(b=>b.id==='townGuild');
  assert.deepEqual(anchor.entrance,{x:56,z:38},'the previous landmark is intact at its translated coordinates');
  assert.deepEqual((await state(page)).position,at(...trip.start),'current layout coordinates restore without a second shift');
  const url=page.url();
  let index=0;
  for(const [dir,amount] of trip.route)for(let i=0;i<amount;i++)await move(page,dir,true,++index===2);
  assert.deepEqual((await state(page)).position,at(...trip.last),'walked seamlessly beyond old perimeter '+trip.name);
  assert.equal((await state(page)).miniMap.location,'外','expanded grasslands are still outdoors');
  await picture(page,trip.name);
  assert.equal(page.url(),url);
  assert.deepEqual(await readStock(page),authority,'walking and unrelated NPC simulation do not spend player currency');
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function coldBoarder(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:32},{clockStart:21*60+30,kit:stock});
 try{
  const map=await getMap(page);
  assert.equal((await clock(page)).hour,21,'real cold start reads saved evening clock');
  await page.waitForFunction(()=>{
   const s=window.__editorTest.townResidents(),guest=s?.actors.find(a=>a.id==='guestadventurer');
   const bed=s?.innBeds.find(b=>b.id==='inn-west');
   return guest&&bed&&guest.activity==='sleep-inn'&&guest.bedId===bed.id&&guest.y===bed.y&&guest.x===bed.stand.x&&guest.z===bed.stand.z;
  },null,{timeout:8000,polling:120});
  const n=await residents(page);
  assert.equal(n.innBeds.find(b=>b.id==='inn-west').occupant,'guestadventurer');
  assert.notEqual(byId(n,'innkeeper').activity,'work','host is closed: no after-hours service needed for assigned boarder');
  assert.equal(n.playerBedId,null,'NPC assignment does not book/charge the player');
  assert.deepEqual(await readStock(page),stock);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function coastAndPaths(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:90,z:60},{kit:stock});
 try{
  const map=await getMap(page);
  assert.ok(map.world.some(o=>o.x===90&&o.z===60&&o.y===0&&o.type==='bridgeStoneEnd'),'old creek bridge survives map extension');
  assert.equal(await openAt(page,91,61),false,'old deep water unchanged');
  await move(page,'e');await move(page,'e');
  assert.deepEqual((await state(page)).position,at(92,60),'old creek can still be crossed');
  assert.ok(map.world.some(o=>o.x>=118&&o.y===0&&o.type==='river'),'new exterior stays connected to actual river terrain');
  const mouth=map.world.find(o=>o.x===127&&o.y===0&&o.type==='river');
  assert.ok(mouth,'expanded eastern river reaches new edge');
  assert.equal(await openAt(page,mouth.x,mouth.z),false,'new downstream river mouth is not walkable');
  assert.equal(await openAt(page,128,65),false,'new east boundary is still finite');
  assert.equal(await openAt(page,41,96),false,'new south boundary is still finite');
  assert.deepEqual(await readStock(page),stock);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function npcCombat(browser){
 // Stay >10 tiles away at first, since the AI never starts a hidden rollout
 // right on top of the player. All movement, strikes and counters are live.
 const {ctx,page,errors}=await launch(browser,'base',{x:57,z:72},{clockStart:9*60,kit:stock,camera:true,orbitYaw:1.5*Math.PI,pitch:.15,dist:6});
 try{
  const map=await getMap(page);
  const actorId='resadventurer';
  const timeline=await page.evaluate(id=>new Promise(resolve=>{
   const start=performance.now(),entries=[],seen=new Set();
   function frame(now){
    const r=window.__editorTest.townResidents(),a=r?.actors.find(x=>x.id===id);
    if(a){
     const prey=r.encounters?.find(x=>x.owner===id)??null;
     if(a.swingAt!==null||a.hurtAt!==null||prey){
      const key=[a.swingAt,a.hitAt,a.lastHitAt,a.hurtAt,a.attacks,prey?.hp,prey?.counterAt,prey?.counterHitAt].join(',');
      if(!seen.has(key)){
       seen.add(key);
       const vp=window.__townCombatVP;
       const onScreen=who=>{
        if(!vp||!who)return false;
        const x=who.x+.5,z=who.z+.5,y=.73+(who.y||0)*1.4;
        const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
        if(w<=0)return false;
        return Math.abs(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])<w*.91&&Math.abs(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])<w*.91;
       };
       entries.push({now,actor:a,prey,onScreen:onScreen(a)&&onScreen(prey)});
      }
     }
     const landed=entries.filter(e=>e.actor.lastHitAt>0);
     const times=new Set(landed.map(e=>e.actor.lastHitAt));
     if(times.size>=2&&entries.some(e=>e.actor.hurtAt>0))return resolve({entries,resolved:true});
    }
    if(now-start>43000)return resolve({entries,resolved:false,final:r});
    requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  }),actorId);
  assert.ok(timeline.resolved,'real NPC fight did not attack and counter twice: '+JSON.stringify(timeline.final));
  const rows=timeline.entries;
  const windup=rows.find(({actor,now,prey})=>actor.swingAt>0&&actor.hitAt>now&&prey?.hp>0);
  assert.ok(windup,'visible sword action starts before damage');
  assert.ok(Math.abs(windup.actor.hitAt-windup.actor.swingAt-108)<.01,'real attack has the same 108ms contact stage as player sword');
  assert.ok(rows.some(r=>r.onScreen&&r.actor.swingAt>0),'genuine WebGL view includes both live combatants');
  const strikes=[...new Set(rows.map(({actor})=>actor.swingAt).filter(t=>t>0))];
  assert.ok(strikes.length>=2&&strikes[1]-strikes[0]>=700,'sword has recovery between swings');
  assert.ok(rows.some(({actor,prey})=>actor.lastHitAt>0&&prey&&prey.hp<35),'real target HP falls after scheduled contact');
  const counter=rows.find(({prey,now})=>prey?.counterAt>0&&prey.counterHitAt>now);
  assert.ok(counter,'slime telegraph is sampled before counter contact');
  assert.ok(Math.abs(counter.prey.counterHitAt-counter.prey.counterAt-170)<.01);
  assert.ok(rows.some(({actor})=>actor.hurtAt>0&&actor.hp<100),'slime can actually counter the swordsman');
  await picture(page,'npc-sword-and-slime-fight');
  assert.deepEqual(await readStock(page),stock,'NPC fight cannot affect player currency');
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function ambientWinds(browser){
 for(const [x,z,expectCreek] of [[41,43,false],[89,60,true]]){
  const {ctx,page,errors}=await launch(browser,'base',{x,z});
  try{
   await page.locator(action).tap();
   if(expectCreek)await page.waitForFunction(()=>window.__editorTest.facility().creekAudio.active&&window.__loopAudioStarts>0);
   else await page.waitForTimeout(450);
   assert.equal(await page.evaluate(()=>window.__loopAudioStarts),expectCreek?1:0,
    expectCreek?'the actual creek loop remains':'no steady world loop at a dry town tile');
   await unchanged(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
}
async function migrate(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:31,z:57},{kit:stock,townLayout:4});
 try{
  assert.deepEqual((await state(page)).position,at(41,67),'v143 bookmark moves exactly +10/+10');
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.townLayout===5,resumeKey);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual((await state(page)).position,at(41,67),'marker5 prevents a second move on reload');
  assert.deepEqual(await readStock(page),stock);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const trip of scenery)await openRoad(browser,trip);
 await migrate(browser);
 await coastAndPaths(browser);
 await coldBoarder(browser);
 await npcCombat(browser);
 await ambientWinds(browser);
 console.log('PASS Chromium: widened north/west/south/east travel, retained creek/world/wallet, cold inn boarder, live NPC sword/slime timing');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
