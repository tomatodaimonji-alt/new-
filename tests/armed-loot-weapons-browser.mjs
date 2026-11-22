import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const observe='function poiEquipmentDurabilityMax(type){';
assert.equal(html.split(observe).length,2);
const candidate=html.replace(observe,`window.__qaEquipmentMaximum=type=>poiEquipmentDurabilityMax(type);
function poiEquipmentDurabilityMax(type){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':candidate);
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
const sword='equipWoodSword',bow='equipWoodBow',wand='fireWand';
const enemy='monsterSkelWarrior',bone='equipBoneSword',knight='monsterSkelKnight';
const actionButton='#poiWalkAction',detail='#poiItemDetail';
const bar=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const bag=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const oldKit={version:1,weapon:sword,potions:3,gold:12,claimedCaches:['glade']};
const inv=async page=>(await state(page)).inventory;
const target=async(page,type)=>(await state(page)).combat.actors.find(a=>a.type===type);
const pos=(x,z,level=0)=>({x,z,level});
const all=(i,type)=>[...i.hotbar,...i.bag].filter(c=>c?.type===type);
async function waitPlay(page){await page.waitForFunction(()=>window.__editorTest?.facility?.().active)}
async function relocate(page,x,z,y,facing){
 await page.evaluate(({resumeKey,x,z,y,facing})=>{
  const r=JSON.parse(localStorage.getItem(resumeKey));
  r.position={x,z,y,facing};r.view={...r.view,level:y,top:false,third:false};
  localStorage.setItem(resumeKey,JSON.stringify(r));
 },{resumeKey,x,z,y,facing});
 await page.reload();await waitPlay(page);
 assert.deepEqual((await state(page)).position,pos(x,z,y));
}
async function loot(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:109,z:56},{level:-1,width:390,clockStart:morning,kit:oldKit,facing:1});
 try{
  const original=await getMap(page);
  assert(original.world.some(o=>o.type===enemy&&o.x===110&&o.z===56&&o.y===-1));
  assert.deepEqual(await readStock(page),oldKit,'previous kit read is byte-compatible before real gameplay mutation');
  assert.equal(all(await inv(page),bone).length,0);
  let hp=(await target(page,enemy)).hp;
  for(let n=0;n<7&&hp>0;n++){
   await page.locator(actionButton).tap();
   await page.waitForFunction(({hp,enemy})=>{
    const a=window.__editorTest.facility().combat.actors.find(a=>a.type===enemy);
    return (!a||a.hp<hp);
   },{hp,enemy},{timeout:4500});
   hp=(await target(page,enemy))?.hp??0;
   if(hp)await page.waitForTimeout(370);
  }
  assert.equal(hp,0,'genuine sword attacks defeated the actual authored enemy');
  const key='world-workshop-hotbar-v1';
  await page.waitForFunction(({key,bone})=>JSON.parse(localStorage.getItem(key))?.armedDrops?.some(d=>d.type===bone),{key,bone});
  const d=(await readStock(page)).armedDrops.find(d=>d.type===bone);
  assert.deepEqual([d.x,d.z,d.y],[110,56,-1]);
  const max=await page.evaluate(type=>window.__qaEquipmentMaximum(type),bone);
  assert(Number.isInteger(d.durability)&&max>0&&d.durability>=Math.floor(.30*max)&&d.durability<=Math.ceil(.80*max),
   'random drop condition is sampled within 30–80% of actual item maximum: '+d.durability+'/'+max);
  assert.equal(all(await inv(page),bone).length,0,'kill does not auto-pick up ground loot');
  await move(page,'e',true,true);
  await page.waitForFunction(type=>{
   const i=window.__editorTest.facility().inventory;return [...i.hotbar,...i.bag].some(c=>c?.type===type);
  },bone);
  const item=all(await inv(page),bone)[0];assert.equal(item.durability,d.durability,'pickup carries the same sampled condition');
  const persisted=await readStock(page);assert(!persisted.quests);
  await page.reload();await waitPlay(page);
  assert.deepEqual(await readStock(page),persisted);
  assert.equal(all(await inv(page),bone).length,1);
  assert.equal(all(await inv(page),bone)[0].durability,d.durability);
  assert.deepEqual(await getMap(page),original);
  if(out)await page.screenshot({path:out+'/v194-armed-enemy-loot.png'});
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
function rangeKit(mode){
 const slots=Array(27).fill(null);slots[0]={type:sword,count:1};
 if(mode==='bow')slots[9]={type:bow,count:1,durability:24};
 else slots[1]={type:wand,count:1,charges:5};
 return {...oldKit,slots,potions:0,weapon:null};
}
async function openBagEquip(page){
 await page.locator('#poiBagToggle').tap();
 await page.locator('#poiBagPanel').waitFor({state:'visible'});
 await page.locator(bag(0)).tap();
 await page.locator(detail+'[open]').waitFor({state:'visible'});
 await page.locator(detail+' [data-item-detail-action=equip]').tap();
 await page.locator(detail+'[open]').waitFor({state:'hidden'});
 assert.equal((await inv(page)).weapon,bow);
 await page.locator('#poiBagClose').tap();
}
async function fireRange(browser,mode){
 const where=mode==='bow'?{x:56,z:39}:{x:105,z:81};
 const {ctx,page,errors}=await launch(browser,'base',where,{level:0,width:390,clockStart:morning,kit:rangeKit(mode),facing:2});
 try{
  const original=await getMap(page);
  if(mode==='bow'){await openBagEquip(page);await relocate(page,105,81,0,2)}
  const foe='monsterSkelArcher',a=await target(page,foe),p=(await state(page)).position;
  assert(a?.level===0&&a.x===p.x&&a.z-p.z===5,'actual target is aligned beyond melee range');
  const expected=a.hp-(mode==='bow'?22:34);
  if(mode==='bow')await page.locator(actionButton).tap();
  else await page.locator(bar(1)).tap();
  await page.waitForFunction(({kind,expected})=>window.__editorTest.facility().combat.actors.find(a=>a.type===kind)?.hp===expected,
   {kind:foe,expected},{timeout:5000}).catch(async err=>{
   const s=await state(page);
   throw Error(mode+': '+JSON.stringify({actual:await target(page,foe),expected,position:s.position,kit:await readStock(page),errors}),{cause:err});
  });
  const i=await inv(page);
  if(mode==='bow'){
   assert.equal(i.weapon,bow);
   assert.equal(all(i,bow)[0].durability,23,'true ranged hit uses one point of bow condition');
  }else{
   assert.equal(i.weapon,null,'casting does not equip the wand as a weapon');
   assert.deepEqual(i.hotbar[1],{type:wand,count:1,charges:4},'actual fire cast consumes exactly one charge');
  }
  const final=await readStock(page);
  await page.reload();await waitPlay(page);
  assert.deepEqual(await readStock(page),final);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await loot(browser);await fireRange(browser,'bow');await fireRange(browser,'wand');
 console.log('PASS live armed enemy drop/pickup and persisted condition, native bow equip/ranged hit and charged fire wand');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
