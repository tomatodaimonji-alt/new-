import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const initAnchor='function poiTownNpcInit(clock){';
assert.equal(html.split(initAnchor).length,2,'native resident initializer exists exactly once');
// Controlled fixture only, at runtime on this local origin; the panel must
// show these actual actor fields, not the player's independent saved kit.
const observed=html.replace(initAnchor,`function poiTownNpcInit(clock){
 __qaNpcInit(clock);
 for(const actor of poiTownNpcActors){
  const seed=actor.role.id==='toolkeeper'?[73,7,2]:actor.role.id==='stablekeeper'?[86,4,1]:null;
  if(seed&&!actor.__qaStatusSeed){
   actor.__qaStatusSeed=true;
   [actor.hp,actor.coins,actor.potions]=seed;
  }
 }
}
function __qaNpcInit(clock){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observed);
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390,height=740}={}){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
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
const morning=9*60;
const menu='#poiNpcMenu',sheet='#poiNpcStatus',bag='#poiNpcInventory',portrait='#poiNpcPortrait';
const stat=(page,id)=>page.locator(sheet+' [data-npc-stat="'+id+'"]');
const rows=page=>page.locator(menu+' > button[data-npc-action]').evaluateAll(nodes=>
 nodes.map(e=>[e.dataset.npcAction,e.textContent.trim()]));
const expected=[['talk','話す'],['status','状態'],['request','依頼'],['back','戻る']];
const names={guildkeeper:'リーネ',innkeeper:'ガルド',diningkeeper:'マルタ',workshopkeeper:'ブラム',
 toolkeeper:'トビン',stablekeeper:'ノア',resadventurer:'ユリス',guestadventurer:'カイ',
 westpeddler:'ミナ',northtraveler:'セオ',canalcourier:'リタ'};
const choose=(page,id)=>page.locator(menu+' > button[data-npc-action="'+id+'"]').tap();
async function present(page){
 await page.waitForFunction(()=>/話す|会話|取引|買い物/.test([document.querySelector('#poiWalkAction').getAttribute('aria-label'),document.querySelector('#poiWalkAction').textContent].join(' ')));
 await page.locator(action).tap();
 await page.locator(menu).waitFor({state:'visible'});
}
async function playerBagDimensions(page){
 await page.locator('#poiBagToggle').tap();
 const box=page.locator('#poiBagPanel');
 await box.waitFor({state:'visible'});
 const dims=await box.evaluate(el=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {width:r.width,height:r.height}};
  return {panel:rect(el),cell:rect(el.querySelector('[data-bag-slot="0"]'))};
 });
 await page.locator('#poiBagClose').tap();
 await box.waitFor({state:'hidden'});
 return dims;
}
function closeSize(actual,expected,message){
 for(const axis of ['width','height'])assert(Math.abs(actual[axis]-expected[axis])<=1.25,
  message+' '+axis+': '+actual[axis]+' vs '+expected[axis]);
}
async function exercise(browser,{width,height=740,id,x,z,service}){
 const {ctx,page,errors}=await launch(browser,'base',{x,z},{width,height,clockStart:morning,kit:stock,facing:1});
 try{
  await worker(page,id);
  const map=await getMap(page),initial=await state(page),raw=await readStock(page);
  const playerDims=await playerBagDimensions(page);
  await present(page);
  assert.equal((await page.locator('#poiMessageHeading').innerText()).trim(),names[id],'direct dialogue title is only the personal name');
  assert.deepEqual(Object.fromEntries((await residents(page)).actors.map(a=>[a.id,a.name])),names,'every genuine town actor has its assigned personal name');
  assert.deepEqual(await rows(page),expected,'ordinary and staffed NPC root has exactly the requested four entries');
  await page.locator('[data-poi-dir="s"]').tap();
  assert.equal(await page.locator(menu+' [aria-current=true]').getAttribute('data-npc-action'),'status');
  await page.locator(action).tap(); // Center action on real mobile D-pad.
  await page.locator(bag).waitFor({state:'visible'});
  assert.equal(await page.locator('#poiBagPanel').isVisible(),false,'NPC status is not the writable player bag');
  assert.equal(await page.locator(menu).isVisible(),false,'read-only inventory replaces ordinary choices until close');
  const actor=byId(await residents(page),id);
  assert.deepEqual([actor.hp,actor.coins,actor.potions],id==='toolkeeper'?[73,7,2]:[86,4,1]);
  assert.match(await stat(page,'hp').innerText(),new RegExp(actor.hp+'\\s*[/／]\\s*100'));
  assert.equal(await stat(page,'attack').count(),0,'ordinary non-hunter has no fictional attack stat');
  assert.equal((await page.locator('#poiNpcInventoryHeader strong').innerText()).trim(),names[id]+'のインベントリ');
  assert.equal((await stat(page,'name').innerText()).trim(),names[id]);
  assert.deepEqual(await page.locator(sheet+' [data-npc-stat]').evaluateAll(n=>n.map(e=>e.dataset.npcStat)),['name','hp'],
    'under portrait only the applicable core stats');
  assert.deepEqual(await readStock(page),raw,'NPC status must not change player equipment, currency or stock');
  const opened=await state(page);
  assert.deepEqual(opened.position,initial.position,'D-pad did not move avatar in menu');
  assert.equal(opened.combat.actionAt,initial.combat.actionAt,'viewing status never attacks');
  const metrics=await page.evaluate(({bag,portrait,sheet})=>{
   const q=s=>document.querySelector(s),r=e=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}};
   const holder=q(bag),art=q(portrait),status=q(sheet),g=art.getContext('2d');
   const paint=g&&g.getImageData(0,0,art.width,art.height).data;
   const entries=[...holder.querySelectorAll('[data-npc-bag-slot]')];
   const gear=[...holder.querySelectorAll('[data-npc-gear-slot]')];
   return {rect:r(holder),cell:r(entries[0]),art:r(art),status:r(status),model:art.dataset.model,
    viewport:r(holder),hp:r(status.querySelector('[data-npc-stat=hp]')),
    hasFigure:!!paint&&paint.some((v,i)=>i%4===3&&v>0)&&paint.some((v,i)=>i%4===3&&v===0),
    items:entries.filter(e=>e.dataset.npcItem).map(e=>[e.dataset.npcItem,Number(e.dataset.count)]),
    cells:entries.length,gear:gear.map(e=>[e.dataset.npcGearSlot,e.dataset.npcEquipment??null]),
    liveSlots:[...entries,...gear].filter(e=>e.matches('button,input,[draggable=true]')).length};
  },{bag,portrait,sheet});
  assert.equal(metrics.cells,25,'5×5 independent NPC bag');
  assert.deepEqual(metrics.gear,['weapon','shield','armor','other'].map(part=>[part,null]),'ordinary residents have no fictitious gear');
  assert.equal(metrics.liveSlots,0,'NPC items are not action targets or draggable');
  assert.deepEqual(metrics.items.sort(),[['gold',actor.coins],['healingHerb',actor.potions]]);
  assert.equal(metrics.model,actor.type,'portrait matches the selected resident, not the player');
  assert.ok(metrics.hasFigure,'actual transparent NPC character art was painted');
  assert(metrics.status.y>=metrics.art.bottom-1,'stats beneath NPC character, not layered over its picture');
  assert(metrics.hp.y>=metrics.viewport.y&&metrics.hp.bottom<=metrics.viewport.bottom-1,
   'NPC HP is fully visible under the artwork when first opened: '+JSON.stringify(metrics));
  closeSize(metrics.rect,playerDims.panel,'NPC outer inventory matches the player bag');
  closeSize(metrics.cell,playerDims.cell,'NPC item square matches player bag cell');
  const rect=metrics.rect;
  assert(rect.width>=140&&rect.height>=90&&rect.x>=-1&&rect.right<=width+1&&rect.y>=-1&&rect.bottom<=height+1,
   'NPC catalogue fits short viewport: '+JSON.stringify(metrics));
  assert.equal(await page.locator('dialog[open]').count(),0,'status stays in original non-modal choices layer');
  await page.locator(bag+' [data-npc-item=healingHerb]').tap();
  assert.equal(await page.locator('#poiItemDetail[open]').count(),0,'NPC items cannot be acted on');
  const toggle=page.locator('#poiBagToggle');
  if(await toggle.isVisible()&&await toggle.isEnabled()){
   const hittable=await toggle.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))});
   if(hittable)await toggle.tap();
  }
  assert.equal(await page.locator('#poiBagPanel').isVisible(),false,'player bag controls cannot take over while NPC inventory is open');
  assert.ok(await page.locator(bag).isVisible());
  const tools=page.locator('#poiGameTools');
  assert.equal(await tools.evaluate(e=>getComputedStyle(e).visibility),'hidden','upper-right tools cannot occlude NPC inventory');
  if(out)await page.screenshot({path:out+'/v182-npc-inventory-'+id+'-'+width+'x'+height+'.png'});
  assert.equal(await page.locator('#poiNpcInventoryClose').count(),1,'separate unique close button');
  if(service)await page.locator('#poiNpcInventoryClose').tap();
  else await page.keyboard.press('Escape');
  await page.locator(bag).waitFor({state:'hidden'});
  assert.equal(await tools.evaluate(e=>getComputedStyle(e).visibility),'visible');
  assert.deepEqual(await rows(page),expected);
  await choose(page,'request');
  const nested=(await rows(page)).map(([key])=>key);
  if(service){
   assert(nested.includes(service),'merchant service moved inside 依頼');
   await choose(page,service);
   assert((await rows(page)).some(([key,label])=>key==='trade:shop-herb'&&label.includes('6G')));
   await page.keyboard.press('Escape');
   assert((await rows(page)).some(([key])=>key===service),'merchant back goes to requests');
  }else assert(!nested.includes('shop')&&!nested.includes('stay'),'ordinary resident has no fake service');
  await page.keyboard.press('Escape');
  assert.deepEqual(await rows(page),expected);
  await page.keyboard.press('Escape');
  await page.locator(menu).waitFor({state:'hidden'});
  assert.deepEqual(await readStock(page),raw);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,{width:320,id:'toolkeeper',x:69,z:35,service:'shop'});
 await exercise(browser,{width:390,id:'stablekeeper',x:34,z:61});
 await exercise(browser,{width:390,height:568,id:'stablekeeper',x:34,z:61});
 console.log('PASS mobile read-only NPC inventory, live gear/stats and painted portrait, D-pad, nested true shop, and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
