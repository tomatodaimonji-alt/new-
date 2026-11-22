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
const menu='#poiNpcMenu',sheet='#poiNpcStatus';
const stat=(page,id)=>page.locator(sheet+' [data-npc-stat="'+id+'"]');
const rows=page=>page.locator(menu+' button[data-npc-action]').evaluateAll(nodes=>
 nodes.map(e=>[e.dataset.npcAction,e.textContent.trim()]));
const expected=[['talk','話す'],['status','状態'],['request','依頼'],['back','戻る']];
const choose=(page,id)=>page.locator(menu+' [data-npc-action="'+id+'"]').tap();
async function present(page){
 await page.waitForFunction(()=>/話す|会話|取引|買い物/.test([document.querySelector('#poiWalkAction').getAttribute('aria-label'),document.querySelector('#poiWalkAction').textContent].join(' ')));
 await page.locator(action).tap();
 await page.locator(menu).waitFor({state:'visible'});
}
async function exercise(browser,{width,height=740,id,x,z,service}){
 const {ctx,page,errors}=await launch(browser,'base',{x,z},{width,height,clockStart:morning,kit:stock,facing:1});
 try{
  await worker(page,id);
  const map=await getMap(page),initial=await state(page),raw=await readStock(page);
  await present(page);
  assert.deepEqual(await rows(page),expected,'ordinary and staffed NPC root has exactly the requested four entries');
  await page.locator('[data-poi-dir="s"]').tap();
  assert.equal(await page.locator(menu+' [aria-current=true]').getAttribute('data-npc-action'),'status');
  await page.locator(action).tap(); // Center action on real mobile D-pad.
  await page.locator(sheet).waitFor({state:'visible'});
  assert.deepEqual(await rows(page),[['back','戻る']]);
  const actor=byId(await residents(page),id);
  assert.ok(actor);
  assert.match(await stat(page,'hp').innerText(),new RegExp(actor.hp+'\\s*[/／]\\s*100'));
  assert.match(await stat(page,'coins').innerText(),new RegExp('(?:^|[^0-9])'+actor.coins+'\\s*G'));
  assert.match(await stat(page,'herbs').innerText(),new RegExp('(?:^|[^0-9])'+actor.potions+'(?:[^0-9]|$)'));
  assert.equal(await stat(page,'attack').count(),0,'ordinary non-hunter has no fictional attack stat');
  assert.equal((await stat(page,'equipment').innerText()).trim(),'なし','non-knight has no battle gear');
  assert.deepEqual(await readStock(page),raw,'NPC status must not change player equipment, currency or stock');
  const opened=await state(page);
  assert.deepEqual(opened.position,initial.position,'D-pad did not move avatar in menu');
  assert.equal(opened.combat.actionAt,initial.combat.actionAt,'viewing status never attacks');
  const rect=await page.locator(menu).boundingBox();
  assert(rect&&rect.x>=-1&&rect.x+rect.width<=width+1&&rect.y>=-1&&rect.y+rect.height<=height+1,'status fits actual viewport');
  assert.ok(rect.height>=90,'status pane is tall enough for meaningful content: '+JSON.stringify(rect));
  for(const id of ['hp','equipment']){
   const field=await stat(page,id).boundingBox();
   assert(field&&field.y>=rect.y&&field.y+field.height<=rect.y+rect.height+1,id+' fully readable before scrolling');
  }
  assert.equal(await page.locator('dialog[open]').count(),0,'status stays in original non-modal choices panel');
  const tools=page.locator('#poiGameTools');
  assert.equal(await tools.evaluate(el=>getComputedStyle(el).visibility),'hidden','unrelated game tools cannot mask the status card');
  if(out)await page.screenshot({path:out+'/v178-npc-status-'+id+'.png'});
  await choose(page,'back');
  await page.locator(sheet).waitFor({state:'hidden'});
  assert.equal(await tools.evaluate(el=>getComputedStyle(el).visibility),'visible','game tools return after closing status');
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
 await exercise(browser,{width:390,height:568,id:'stablekeeper',x:34,z:61});
 console.log('PASS mobile real NPC status, exact root actions, D-pad, nested true shop, and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
