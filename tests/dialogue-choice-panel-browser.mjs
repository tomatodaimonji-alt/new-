import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const messageAnchor="function poiMessagePush(";
assert.equal(html.split(messageAnchor).length,2,'one native announcement emitter');
const observed=html.replace(messageAnchor,`window.__qaEmitAnnouncement=(...args)=>poiMessagePush(...args);
function poiMessagePush(`);
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
const speechPanel='#poiMessagePanel';
const market='#poiNpcMenu';
const choices=market+' button[data-npc-action]';
const choice=(page,id)=>page.locator(choices+'[data-npc-action="'+id+'"]');
const dpad=(page,d)=>page.locator('[data-poi-dir="'+d+'"]');
const morning=9*60;
async function geometry(page){
 return page.evaluate(({speechPanel,market})=>{
  const p=document.querySelector(speechPanel),m=document.querySelector(market);
  const r=e=>{const q=e.getBoundingClientRect(),css=getComputedStyle(e);return {x:q.x,y:q.y,w:q.width,h:q.height,
   right:q.right,bottom:q.bottom,background:css.backgroundColor}};
  const mini=document.querySelector('#poiMiniHud');
  return {speech:r(p),menu:r(m),stage:r(document.querySelector('#viewWrap')),mini:mini.hidden?null:r(mini),
   compact:m.hasAttribute('data-compact'),counterSide:m.hasAttribute('data-counter-side'),nested:p.contains(m),
   dialogs:[...document.querySelectorAll('dialog[open]')].map(d=>d.id),width:innerWidth,height:innerHeight};
 },{speechPanel,market});
}
function priorPanel(before,during){
 for(const key of ['x','y','w','h'])assert.ok(Math.abs(before.speech[key]-during.speech[key])<=1,
  'the original message card keeps the same '+key+': '+JSON.stringify({before:before.speech,during:during.speech}));
 assert.equal(before.speech.background,during.speech.background,'same original glass');
}
function aboveLeft(d){
 assert.equal(d.nested,false,'choice panel is independent, not a child of the message card');
 assert(d.menu.w>0&&d.menu.h>0);
 if(d.counterSide){
  assert(d.mini&&d.menu.x>=d.mini.right+3,'counter fallback starts just right of the minimap HUD: '+JSON.stringify(d));
  assert(d.menu.right<=Math.min(d.width,d.stage.right)-6,'safe right margin retained');
 }else assert(Math.abs(d.menu.x-d.speech.x)<=2,'choice pane starts aligned to the left of the original speech card');
 assert(d.menu.bottom<=d.speech.y+1&&d.speech.y-d.menu.bottom<=16,'choice pane sits directly above speech, not on top of it');
 assert(d.menu.x>=d.stage.x-1&&d.menu.right<=Math.min(d.width,d.stage.right)+1&&d.menu.y>=Math.max(0,d.stage.y)-1,
  'choice pane fits phone game viewport');
 assert.deepEqual(d.dialogs,[],'neither panel uses a native modal or dimming backdrop');
}
async function openDialogue(page){
 await page.waitForFunction(()=>/話す|会話|取引|買い物/.test([document.querySelector('#poiWalkAction').getAttribute('aria-label'),document.querySelector('#poiWalkAction').textContent].join(' ')));
 await page.locator(action).tap();
 await page.locator(market).waitFor({state:'visible'});
}
async function exercise(browser,{width,id,x,z,facing,service}){
 const {ctx,page,errors}=await launch(browser,'base',{x,z},{width,clockStart:morning,kit:stock,facing});
 try{
  const map=await getMap(page);
  await worker(page,id);
  await page.evaluate(()=>window.__qaEmitAnnouncement('確認用の短いアナウンス','gold'));
  await page.locator(speechPanel).waitFor({state:'visible'});
  const before=await geometry(page);
  await openDialogue(page);
  const root=await geometry(page);
  priorPanel(before,root);aboveLeft(root);
  assert.equal(await page.locator(speech).isVisible(),false);
  const actions=await page.locator(choices).evaluateAll(nodes=>nodes.map(e=>e.dataset.npcAction));
  assert.deepEqual(actions,service?['shop','sell','back']:['talk','status','request','back']);
  assert.equal(await page.locator(choices+'[aria-current="true"]').getAttribute('data-npc-action'),service?'shop':'talk');
  const position=(await state(page)).position,attack=(await state(page)).combat.actionAt;
  if(service){
   // The direct counter root dismisses on a direction. The blocked east
   // step faces the actual counter without leaving the customer position.
   await dpad(page,'e').tap();await page.locator(market).waitFor({state:'hidden'});
   assert.deepEqual((await state(page)).position,position);
   await openDialogue(page);
   assert.equal(await choice(page,'shop').count(),1);
  }
  assert.equal((await state(page)).combat.actionAt,attack);
  await choice(page,service||'request').tap();
  // v265+ intentionally dismisses root conversations on movement. A
  // submenu still owns directions without moving and genuinely wraps.
  const selected=page.locator(choices+'[aria-current="true"]');
  const first=await selected.getAttribute('data-npc-action');
  assert.equal(first,service?'trade:shop-herb':'sell');
  await dpad(page,'n').tap();
  assert.equal(await selected.getAttribute('data-npc-action'),'back');
  await dpad(page,'s').tap();
  assert.equal(await selected.getAttribute('data-npc-action'),first);
  assert.deepEqual((await state(page)).position,position);
  assert.equal((await state(page)).combat.actionAt,attack);
  const sub=await geometry(page);
  priorPanel(before,sub);aboveLeft(sub);
  if(service&&width===390){
   assert.equal(sub.compact,true,'compact options should fit in the measured phone gap: '+JSON.stringify(sub));
   assert.ok(sub.menu.y>=sub.mini.bottom+2||sub.menu.x>=sub.mini.right+3,'choices must not overlap the HUD: '+JSON.stringify(sub));
  }
  assert.equal(await choice(page,service?'trade:shop-herb':'buy').count(),1);
  if(out)await page.screenshot({path:out+'/v176-choices-'+id+'-'+width+'.png'});
  await page.keyboard.press('Escape');
  assert.equal(await choice(page,service||'talk').count(),1,'back reopens the correct entry menu rather than closing');
  await choice(page,'back').tap();
  await page.locator(market).waitFor({state:'hidden'});
  assert.deepEqual(await readStock(page),stock,'view or dismiss choices does not buy anything');
  await noMapMutation(page,map);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function sleeping(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:39,z:26},{width:320,clockStart:23*60,kit:stock,facing:0});
 try{
  await page.waitForFunction(()=>window.__editorTest.townResidents()?.actors.some(o=>o.id==='innkeeper'&&o.activity==='sleep-home'));
  await page.locator(action).tap();
  await page.locator('#poiMessageLog').filter({hasText:/zzz\.\.\./i}).waitFor({state:'visible'});
  assert.equal(await page.locator(market).isVisible(),false);
  assert.equal(await page.locator('dialog[open]').count(),0);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,{width:320,id:'stablekeeper',x:34,z:61,facing:1});
 await exercise(browser,{width:390,id:'toolkeeper',x:69,z:35,facing:1,service:'shop'});
 await sleeping(browser);
 console.log('PASS mobile independent choice pane above left, original speech card unchanged, D-pad wrap, real service and sleeping behavior');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
