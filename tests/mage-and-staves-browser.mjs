import {stableRegionalCombat} from './outdoor-regional-combat-fixture.mjs';
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
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':stableRegionalCombat(html,'monsterSkelMage','monsterSkelLongStaff'));
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
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const at=(x,z,level=0)=>({x,z,level});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function picture(page,label){
 if(!out)return;
 await settle(page);
 await page.screenshot({path:out+'/v172-'+label+'.png'});
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
const speech='#poiTownSpeech';
const dateMinute=12*60;
const talkInfo=page=>page.evaluate(()=>{
 const api=window.__editorTest;return api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
});
async function waitDialogue(page,opened){
 await page.waitForFunction(opened=>{
  const api=window.__editorTest,t=api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
  return Boolean(t)===opened;
 },opened);
 const bubble=page.locator(speech);
 await bubble.waitFor({state:'hidden'});
}
async function worker(page,id){
 await page.waitForFunction(id=>window.__editorTest.townResidents()?.actors.some(x=>x.id===id&&x.activity==='work'),id);
 return byId(await residents(page),id);
}
const panel='#poiNpcMenu',quests='#poiQuestListTitle',morning=9*60;
const menu=page=>page.locator(panel);
const choice=(page,id)=>menu(page).locator('button[data-npc-action="'+id+'"]');
const actionKeys=page=>menu(page).locator(':scope > button[data-npc-action]').evaluateAll(b=>b.map(e=>e.dataset.npcAction));
async function talk(page,id){
 await worker(page,id);
 await page.waitForFunction(()=>/話す|会話|取引|買い物/.test([document.querySelector('#poiWalkAction').getAttribute('aria-label'),document.querySelector('#poiWalkAction').textContent].join(' ')));
 await page.locator(action).tap();
 await menu(page).waitFor({state:'visible'});
}
const sword='equipWoodSword',long='equipLongStaff',plain='equipPlainStaff',wand='fireWand';
const mage='monsterSkelMage',staff='monsterSkelLongStaff';
const actionButton='#poiWalkAction',detail='#poiItemDetail';
const kit={version:1,weapon:sword,potions:3,gold:12,claimedCaches:['glade']};
const target=async(page,type)=>(await state(page)).combat.actors.find(a=>a.type===type);
const inv=async page=>(await state(page)).inventory;
const pos=(x,z)=>({x,z,level:0});
const physical=(page,d)=>page.locator('[data-poi-dir="'+d+'"]');
const readDrops=async page=>(await readStock(page)).armedDrops??[];
async function waitPlay(page){await page.waitForFunction(()=>window.__editorTest?.facility?.().active)}
async function relocate(page,x,z,facing){
 await page.evaluate(({resumeKey,x,z,facing})=>{
  const r=JSON.parse(localStorage.getItem(resumeKey));
  r.position={x,z,y:0,facing};r.view={...r.view,level:0,top:false,third:false};
  localStorage.setItem(resumeKey,JSON.stringify(r));
 },{resumeKey,x,z,facing});
 await page.reload();await waitPlay(page);
 assert.deepEqual((await state(page)).position,pos(x,z));
}
async function hit(page,type){
 const before=(await target(page,type))?.hp;
 assert(before>0);
 await page.locator(actionButton).tap();
 await page.waitForFunction(({type,before})=>{
  const a=window.__editorTest.facility().combat.actors.find(a=>a.type===type);
  return !a||a.hp<before;
 },{type,before},{timeout:6000});
 const after=(await target(page,type))?.hp??0;
 return {before,after};
}
async function finish(page,type,wait=540){
 for(let n=0;n<10;n++){
  if(!((await target(page,type))?.hp>0))return;
  const result=await hit(page,type);
  if(!result.after)return;
  await page.waitForTimeout(wait);
 }
 assert.fail('authoritative enemy not cleared in ten genuine strikes: '+type);
}
async function pickLong(page){
 await page.waitForFunction(type=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.armedDrops?.some(d=>d.type===type),long);
 const d=(await readDrops(page)).find(o=>o.type===long);
 assert.deepEqual([d.x,d.z,d.y],[43,9,0]);
 await move(page,'n',true,true);
 const i=await inv(page),bagIndex=i.bag.findIndex(c=>c?.type===long),hotIndex=i.hotbar.findIndex(c=>c?.type===long);
 assert(bagIndex>=0||hotIndex>=0,'physical step picked up unique staff');
 assert.equal((hotIndex>=0?i.hotbar[hotIndex]:i.bag[bagIndex]).durability,d.durability);
 await page.locator('#poiBagToggle').tap();
 const cell=hotIndex>=0?'#poiHotbar [data-hotbar-slot="'+hotIndex+'"]':'#poiBagGrid [data-bag-slot="'+bagIndex+'"]';
 await page.locator(cell).tap();
 await page.locator(detail+'[open]').waitFor({state:'visible'});
 await page.locator(detail+' [data-item-detail-action=equip]').tap();
 await page.locator(detail+'[open]').waitFor({state:'hidden'});
 await page.locator('#poiBagClose').tap();
 assert.equal((await inv(page)).weapon,long);
}
async function targetedMage(page){
 await page.waitForFunction(type=>window.__editorTest.facility().combat.threats.some(t=>t.type===type),mage);
 return (await state(page)).combat.threats.filter(t=>t.type===mage);
}
async function run(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:43,z:12},{level:0,width:390,clockStart:morning,kit,facing:0});
 try{
  const original=await getMap(page);
  assert(original.world.some(o=>o.type===staff&&o.x===43&&o.z===7&&o.y===0));
  assert(original.world.some(o=>o.type===mage&&o.x===40&&o.z===88&&o.y===0));
  await page.waitForFunction(type=>window.__editorTest.facility().combat.actors.some(t=>t.type===type),staff);
  await move(page,'n');await move(page,'n');
  await finish(page,staff,425);
  await pickLong(page);
  // Start outside the mage's leash, then enter on a known native step.
  // That leaves the full windup rather than sampling an attack during reload.
  await relocate(page,40,95,0);
  await page.waitForFunction(type=>window.__editorTest.facility().combat.actors.some(t=>t.type===type),mage);
  const life=(await state(page)).combat.playerHP;
  const startTrace=page.waitForFunction(type=>window.__editorTest.playerWeapon().enemyBolts.some(b=>
   b.type===type&&b.x===40&&b.toX===40&&b.z===90&&b.y===0),mage);
  await page.keyboard.press('ArrowUp');
  await page.waitForFunction(()=>window.__editorTest.facility().position.z===94);
  const marks=await targetedMage(page);
  assert(marks.some(t=>t.x===40&&t.z===94&&t.y===0),'the actual occupied tile is threatened');
  assert(marks.every(t=>t.x===40&&t.y===0&&t.z>90),'only a cardinal line is announced');
  await page.waitForTimeout(185);
  // A single real key is deterministic after a recent accepted tile lock;
  // the same movement path is exercised via touch in the rest of the run.
  await page.keyboard.press('ArrowLeft');
  if((await state(page)).position.x===40){
   await page.waitForTimeout(60);
   await page.keyboard.press('ArrowLeft');
  }
  await page.waitForFunction(()=>window.__editorTest.facility().position.x===39,undefined,{timeout:5000});
  await startTrace;
  await page.waitForTimeout(220);
  assert.deepEqual((await state(page)).position,pos(39,94));
  assert.equal((await state(page)).combat.playerHP,life,'sidestep evades the committed fire line');
  await move(page,'e');await move(page,'n');await move(page,'n');
  await page.waitForTimeout(540);
  const first=await hit(page,mage);
  assert.equal(first.before-first.after,20,'long staff has full damage at two tiles');
  await move(page,'n',true,true);
  await page.waitForTimeout(410);
  const two=await hit(page,mage);
  assert.equal(two.before-two.after,20,'same full damage at one tile');
  await page.waitForTimeout(540);
  await finish(page,mage);
  await page.waitForFunction(type=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.armedDrops?.some(d=>d.type===type),plain);
  const fallen=await readDrops(page),item=fallen.find(o=>o.type===plain),bonus=fallen.find(o=>o.type===wand);
  assert.deepEqual([item.x,item.z,item.y],[40,90,0]);
  if(bonus)assert(Number.isInteger(bonus.charges)&&bonus.charges>=2&&bonus.charges<=5,'optional naturally rolled wand has 2–5 charges');
  console.log('mage native loot:',bonus?'staff + wand, charges='+bonus.charges:'staff, no wand this run');
  if(out)await page.screenshot({path:out+'/v195-mage-drop.png'});
  // Cold loading a surface combat fixture can reconstruct the mage at its
  // authored home. Compare durable bytes from the original safe approach,
  // outside the mage's leash, rather than while respawned fire can wear armor.
  for(let z=(await state(page)).position.z;z<95;z++)await move(page,'s');
  assert.deepEqual((await state(page)).position,pos(40,95));
  const persisted=await readStock(page);
  await page.reload();await waitPlay(page);
  assert.deepEqual((await state(page)).position,pos(40,95));
  assert.deepEqual(await readStock(page),persisted,'the genuine unforced loot roll, worn armor and staff durability persist');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await run(browser);
 console.log('PASS real cardinal fire release & sidestep, guaranteed staves, native long staff equal damage and persistent optional caster loot');
}finally{await browser?.close();await new Promise(r=>server.close(r));}

