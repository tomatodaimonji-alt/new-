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
async function openQuest(page){
 await choice(page,'quest').tap();
 await page.locator(quests).filter({hasText:'クエスト一覧'}).waitFor({state:'visible'});
 const els=await menu(page).evaluate(el=>[el.querySelector('#poiQuestListTitle'),...el.querySelectorAll('button[data-npc-action]')].filter(Boolean).map(e=>{
  const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};
 }));
 assert(els.length>=3&&els.every((r,i)=>i===0||r.y>=els[i-1].y+els[i-1].h-1),
  'quest title, quest entries, and back are stacked vertically');
 await choice(page,'quest:mine-survey').tap();
}
async function acceptedMarker(page,active){
 await page.waitForFunction(active=>{
  const mini=window.__editorTest.facility().miniMap;
  return mini?.questKey===(active?'116,64':'');
 },active);
 const color=await page.evaluate(()=>{
  const c=document.querySelector('#poiMiniMap'),{width,height}=c;
  const scale=Math.min((width-10)/128,(height-16)/96);
  const x=Math.floor((width-128*scale)/2+116.5*scale),z=Math.floor((height-96*scale)/2+3+64.5*scale);
  return [...c.getContext('2d').getImageData(x,z,1,1).data];
 });
 if(active)assert.deepEqual(color,[157,233,221,255],'actual minimap paints mint diamond at abandoned mine entrance');
 else assert.notDeepEqual(color,[157,233,221,255],'objective not painted before confirmation');
}
async function guildQuest(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:29},{width:320,clockStart:morning,kit:stock,facing:0});
 try{
  const map=await getMap(page),raw=await readStock(page);
  assert.ok(map.world.some(o=>o.x===116&&o.z===64&&o.y===0&&o.type==='mineEntrance'));
  const before=(await state(page)).position;
  await acceptedMarker(page,false);
  const topology=(await state(page)).miniMap.topologyBuilds;
  await talk(page,'guildkeeper');
  assert.equal((await page.locator('#poiMessageHeading').innerText()).trim(),'リーネ');
  const keys=await actionKeys(page);
  assert(keys.includes('quest'),'guild receptionist offers quests at the actual public desk');
  assert.deepEqual(keys.filter(k=>k!=='quest'),['talk','status','request','back']);
  await choice(page,'quest').tap();
  await page.locator(quests).waitFor({state:'visible'});
  assert.equal((await choice(page,'quest:mine-survey').innerText()).trim(),'廃坑★★☆☆☆（調査）','compact area+difficulty+objective list entry');
  await page.keyboard.press('Escape');
  await openQuest(page);
  assert.equal((await choice(page,'quest-accept').innerText()).trim(),'受ける');
  assert.match(await page.locator('#poiMessagePanel').innerText(),/廃坑|調査/);
  await page.keyboard.press('Escape');
  await page.locator(quests).waitFor({state:'visible'});
  assert.deepEqual(await readStock(page),raw,'visiting and leaving the detail does not accidentally accept');
  await acceptedMarker(page,false);
  await choice(page,'quest:mine-survey').tap();
  await choice(page,'quest-accept').tap();
  await page.locator(quests).waitFor({state:'visible'});
  await choice(page,'quest:mine-survey').filter({hasText:/廃坑★★☆☆☆（調査）.*受注済/}).waitFor({state:'visible'});
  assert.deepEqual(await readStock(page),{...raw,quests:['mine-survey']},'exactly one additive persisted quest change');
  await acceptedMarker(page,true);
  assert.equal((await state(page)).miniMap.topologyBuilds,topology,'quest repaint does not rebuild topological map');
  assert.deepEqual((await state(page)).position,before);
  if(out)await page.screenshot({path:out+'/v182-guild-accepted.png'});
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await menu(page).waitFor({state:'hidden'});
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await acceptedMarker(page,true);
  assert.deepEqual(await readStock(page),{...raw,quests:['mine-survey']});
  await talk(page,'guildkeeper');
  await openQuest(page);
  assert.equal(await choice(page,'quest-accept').count(),0,'accepted quest cannot be accepted twice');
  assert.deepEqual(await readStock(page),{...raw,quests:['mine-survey']});
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function noQuest(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:69,z:35},{width:390,clockStart:morning,kit:stock,facing:1});
 try{
  const map=await getMap(page),raw=await readStock(page);
  await talk(page,'toolkeeper');
  assert.deepEqual(await actionKeys(page),['talk','status','request','back'],'ordinary merchant has no quest menu');
  await choice(page,'status').tap();
  await page.locator('#poiNpcInventory').waitFor({state:'visible'});
  await page.locator('#poiNpcInventoryClose').tap();
  await menu(page).waitFor({state:'visible'});
  await choice(page,'request').tap();await choice(page,'shop').tap();
  assert.match(await choice(page,'trade:shop-herb').innerText(),/薬草.*6G/);
  assert.deepEqual(await readStock(page),raw);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await guildQuest(browser);await noQuest(browser);
 console.log('PASS mobile real Guild exclusive quest, vertical list/detail, explicit accept and persistent marker, other menus and saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
