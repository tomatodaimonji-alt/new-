import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// A real wild slime can deal the lethal HP after the built-in wound fixture;
// only its spawn position is made predictable. The NPC takes a real adjacent
// scheduled counter; its HP is reduced immediately before that contact only.
const spawnAnchor='const p=poiWildPick(rng);';
const counterAnchor='const amount=POI_MONSTER_STATS.monsterSlime.attack||6;';
assert.equal(html.split(spawnAnchor).length,2,'unique ordinary spawn anchor');
assert.equal(html.split(counterAnchor).length,2,'unique actual NPC counter-hit anchor');
const playerFixture=html.replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);');
const npcFixture=html.replace(counterAnchor,
 "if(a.role.id==='resadventurer'&&poiTownNpcCombatNear(a.x,a.z,a.y)&&!window.__npcLethalPrepared){a.hp=1;window.__npcLethalPrepared=true}"+counterAnchor);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/player')?playerFixture:req.url.startsWith('/npc')?npcFixture:html);
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
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


const getCombat=async page=>(await state(page)).combat;
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readStock=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const residentId='resadventurer';
async function player(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:73},{fixture:'player',width:390,facing:1,kit:stock});
 try{
  const map=await getMap(page),initial=(await state(page)).position;
  assert.deepEqual(initial,{x:41,z:73,level:0});
  await page.evaluate(()=>window.__editorTest.testWound(99));
  assert.equal((await getCombat(page)).playerHP,1);
  const frames=page.evaluate(()=>new Promise(resolve=>{
   const start=performance.now(),seen=new Map();
   function frame(now){
    const f=window.__editorTest.facility(),d=f.combat.death,fade=document.querySelector('#poiDeathFade');
    if(d){
     const key=d.phase;
     const prev=seen.get(key);
     const row={now,phase:key,hp:f.combat.playerHP,pos:f.position,
      debris:f.combat.debris,stage:fade?.dataset.stage,black:fade?getComputedStyle(fade).backgroundColor:null,
      opacity:fade&&!fade.hidden?Number(getComputedStyle(fade).opacity):0};
     if(!prev||row.opacity>prev.opacity)seen.set(key,row);
    }
    if(seen.size&&!d)return resolve({done:true,end:f,frames:[...seen.values()]});
    if(now-start>16000)return resolve({done:false,end:f,frames:[...seen.values()]});
    requestAnimationFrame(frame);
   }
   requestAnimationFrame(frame);
  }));
  await page.waitForFunction(()=>window.__editorTest.facility().combat.death?.phase==='pause',null,{timeout:12000});
  assert.equal((await getCombat(page)).playerHP,0,'real slime strike, not developer hook, reduces HP to zero');
  const notice=page.locator('#poiMessageLog .poiMessageLine[data-kind="defeat"]');
  await notice.waitFor({state:'visible'});
  assert.equal(await notice.innerText(),'死んでしまった。');
  const contact=(await getCombat(page)).actionAt;
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  await page.keyboard.press('1');
  assert.deepEqual((await state(page)).position,initial,'movement blocked during KO');
  assert.equal((await getCombat(page)).actionAt,contact,'attack blocked during KO');
  assert.deepEqual(await readStock(page),stock,'hotbar input blocked during KO');
  if(out)await page.screenshot({path:out+'/v157-player-defeat-390.png'});
  const log=await frames;
  assert.ok(log.done,'defeat animation, darkness and recovery finish');
  assert.deepEqual(log.frames.map(r=>r.phase),['pause','out','black','in']);
  const fullBlack=log.frames.find(r=>r.phase==='black');
  assert.ok(fullBlack.opacity>=.97&&fullBlack.black==='rgb(0, 0, 0)'&&fullBlack.stage==='black','actual visible DOM overlay becomes black');
  const pause=log.frames.find(r=>r.phase==='pause');
  assert.equal(pause.hp,0);
  assert.ok(pause.debris.some(d=>d.actor==='player'&&d.parts?.length>=4),'actual multiple scattered player fragments');
  const respawn=log.end.spawn;
  assert.deepEqual(log.end.position,{x:respawn.x,z:respawn.z,level:0},'respawns in actual authored safe town spawn');
  assert.equal(log.end.combat.playerHP,100);
  assert.equal(await page.locator('#poiDeathFade').isVisible(),false,'transition overlay releases controls after full recovery');
  assert.equal(log.end.miniMap?.location,'拠点');
  assert.deepEqual(await getMap(page),map);
  assert.deepEqual(await readStock(page),stock);
  await unchanged(page);assert.deepEqual(errors,[]);
  await move(page,'e',true,true); // regular controls become available again
  console.log('real lethal contact → fragments/pause/out/black/in → safe town',log.frames.map(r=>r.phase));
 }finally{await ctx.close();}
}
async function resident(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:53,z:72},{fixture:'npc',width:390,clockStart:9*60,kit:stock,
  camera:true,orbitYaw:1.5*Math.PI,pitch:.15,dist:6});
 try{
  const map=await getMap(page),pos=(await state(page)).position;
  await page.waitForFunction(id=>window.__editorTest.townResidents().actors.some(a=>a.id===id&&a.death),residentId,{timeout:44500,polling:'raf'});
  const npc=()=>page.evaluate(id=>window.__editorTest.townResidents().actors.find(a=>a.id===id),residentId);
  const dead=await npc();
  assert.equal(dead.hp,0,'NPC actual counterattack causes defeat');
  const whileDead=await getCombat(page);
  assert.equal(whileDead.death,null,'NPC defeat never fades the player screen or respawns the player');
  assert.ok(whileDead.debris.some(d=>d.actor==='resident'&&d.actorId===residentId&&d.parts?.length>=4),'actual NPC fragment effect');
  if(out)await page.screenshot({path:out+'/v157-resident-fragments-390.png'});
  await page.waitForFunction(id=>window.__editorTest.townResidents().actors.some(a=>a.id===id&&!a.death&&a.hp>0),residentId,{timeout:18000,polling:'raf'});
  const revived=await npc();
  assert.ok(revived.hp>0&&revived.id===residentId,'same resident returns to regular routine');
  assert.deepEqual((await state(page)).position,pos);
  assert.deepEqual(await getMap(page),map);
  assert.deepEqual(await readStock(page),stock);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await player(browser);await resident(browser);
 console.log('PASS actual mobile Chromium: lethal player/resident contacts, stylized fragments and safe recovery without saved-world changes');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
