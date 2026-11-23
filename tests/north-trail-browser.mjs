import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Scope the browser fixture to the authored encounters. Keep the normal
// clock and combat scheduler, but suppress unrelated random wild placements.
const wildPick=' const p=poiWildPick(rng);';
assert.equal(html.split(wildPick).length,2,'one wild placement anchor in the app');
const fixtureHtml=html.replace(wildPick,' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':fixtureHtml);
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
const kit={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const pos=(x,z)=>({x,z,level:0});
const inside='北の森の道',camp='外';
const dirSel=d=>'[data-poi-dir="'+d+'"]';
const amount=s=>[...s.inventory.hotbar,...s.inventory.bag].reduce((n,c)=>n+(c?.type==='healingHerb'?c.count:0),0);
const coords=async page=>(await state(page)).position;
async function one(page,dir,x,z){
 const start=await coords(page),key=arrow[dir];
 assert.equal(Math.abs(x-start.x)+Math.abs(z-start.z),1);
 // A single keydown/up avoids a synthetic touch hold turning into auto-repeat
 // under a slow software renderer. The new route still covers actual D-pad taps.
 await page.keyboard.press(key);
 try{
  await page.waitForFunction(({x,z})=>{
   const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===0;
  },{x,z},{timeout:4500});
 }catch(e){
  throw new Error('North trail '+key+' from '+JSON.stringify(start)+' to '+[x,z]+' stopped at '+JSON.stringify(await coords(page)),{cause:e});
 }
 await page.waitForTimeout(305);
 assert.deepEqual(await coords(page),pos(x,z));
}
async function line(page,x,z){
 let p=await coords(page);
 assert(p.level===0);
 while(p.x!==x||p.z!==z){
  assert(p.x===x||p.z===z,'authored route turns only at explicit lane vertices');
  const dx=Math.sign(x-p.x),dz=Math.sign(z-p.z),d=dx>0?'e':dx<0?'w':dz>0?'s':'n';
  await one(page,d,p.x+dx,p.z+dz);
  p=await coords(page);
 }
}
async function waitMap(page,label){
 await page.waitForFunction(label=>window.__editorTest.facility().miniMap?.location===label,label);
 assert.equal((await state(page)).miniMap.stars,'★☆☆☆☆☆☆☆☆☆');
 const title=await page.locator('#poiLocationName').evaluate(el=>({text:el.textContent,client:el.clientWidth,scroll:el.scrollWidth}));
 assert.equal(title.text,label);assert(title.client>=title.scroll,'location name stays legible in portrait: '+JSON.stringify(title));
}
async function run(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:38,z:4},{width:390,clockStart:morning,kit,facing:0});
 try{
  const original=await getMap(page),base=(await state(page)).buildings,url=page.url();
  assert.deepEqual([original.width,original.height],[128,128]);
  assert.deepEqual(await coords(page),pos(38,4),'starts on the existing north access track');
  assert(original.world.some(o=>o.x===38&&o.z===4&&o.y===0&&o.type==='earth'),'existing north earth trail is still authored');
  assert(original.world.some(o=>o.x===76&&o.z===4&&o.y===0&&o.type==='ruinStonePost'),'existing route reaches the actual new waymarker');
  assert.deepEqual(await readStock(page),kit);
  for(const [x,z,y,type] of [[56,38,0,'stonewallDoor'],[116,62,0,'guildStairDown'],[118,88,0,'otherworldPortal'],[124,81,0,'guildStairDown']])
   assert(original.world.some(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type),'old POI entrance still authored '+[x,z,y,type]);
  await line(page,39,4);await waitMap(page,inside);
  for(const [x,z] of [[46,4],[46,3],[57,3],[57,4],[61,4]])await line(page,x,z);
  assert.equal(amount(await state(page)),3,'scenic route never grants reward unprompted');
  assert.equal((await readStock(page)).northTrailCampSupplies,undefined);
  await line(page,61,5);await waitMap(page,camp);
  await line(page,61,6);
  await line(page,61,7);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.northTrailCampSupplies===true);
  assert.equal(amount(await state(page)),5,'real step collects exactly two herbs');
  const taken=await readStock(page);
  assert.equal(taken.gold,kit.gold);assert.equal(taken.weapon,kit.weapon);
  assert.equal(taken.quests,undefined,'no quest prerequisite or automatic quest record');
  if(out)await page.screenshot({path:out+'/v196-camp-side-trail.png'});
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await coords(page),pos(61,7));
  assert.deepEqual(await readStock(page),taken);
  await line(page,61,6);await line(page,61,7);
  assert.equal(amount(await state(page)),5,'same cache never refills after reload');
  assert.deepEqual(await readStock(page),taken);
  await line(page,61,4);await waitMap(page,inside);
  for(const [x,z] of [[70,4],[70,3],[76,3],[76,2],[85,2]])await line(page,x,z);
  await waitMap(page,inside);
  assert.equal(page.url(),url,'connected road remains part of the same world with no teleport');
  assert.deepEqual((await state(page)).buildings,base,'route does not replace any registered building');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
  if(out)await page.screenshot({path:out+'/v196-onward-forest-road.png'});
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await run(browser);
 console.log('PASS native portrait north forest road from old route, real camp pickup once, connected continuation and preserved POIs');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
