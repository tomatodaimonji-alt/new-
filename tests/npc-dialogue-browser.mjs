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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const gl=WebGLRenderingContext.prototype,probes=new WeakSet();
  const oldGet=gl.getUniformLocation,oldSet=gl.uniformMatrix4fv;
  gl.getUniformLocation=function(program,name){
   const loc=oldGet.call(this,program,name);if(loc&&name==='uMVP')probes.add(loc);return loc;
  };
  gl.uniformMatrix4fv=function(loc,transpose,matrix){
   if(loc&&probes.has(loc))window.__dialogueVP=Array.from(matrix);
   return oldSet.call(this,loc,transpose,matrix);
  };
 });
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
 await page.screenshot({path:out+'/v147-'+label+'.png'});
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
 await bubble.waitFor({state:opened?'visible':'hidden'});
}
async function worker(page,id){
 await page.waitForFunction(id=>window.__editorTest.townResidents()?.actors.some(x=>x.id===id&&x.activity==='work'),id);
 return byId(await residents(page),id);
}
async function startTalking(page,id){
 const press=page.locator(action);
 await page.waitForFunction(()=>/話す/.test(document.querySelector('#poiWalkAction')?.getAttribute('aria-label')||''));
 const swing=(await state(page)).combat.actionAt;
 await press.tap();
 await waitDialogue(page,true);
 const d=await talkInfo(page);
 assert.equal(d.id,id,'the nearby aimed NPC responds');
 assert.ok(typeof d.text==='string'&&d.text.length>0&&d.text.length<=100,'short actual dialogue line appears');
 const bubble=page.locator(speech);
 assert.ok((await bubble.innerText()).includes(d.text));
 assert.ok((await bubble.evaluate(el=>getComputedStyle(el).position))==='absolute','speech is anchored to canvas, not a full-screen modal');
 const [r,canvas]=await Promise.all([bubble.boundingBox(),page.locator('#view').boundingBox()]);
 assert.ok(r&&canvas&&r.x>=canvas.x-1&&r.x+r.width<=canvas.x+canvas.width+1&&r.y>=canvas.y-1&&r.y+r.height<=canvas.y+canvas.height+1,'projected speech remains visible on mobile screen');
 const placement=await bubble.evaluate((el,id)=>{
  const vp=window.__dialogueVP,a=window.__editorTest.townResidents().actors.find(n=>n.id===id),c=document.querySelector('#view');
  if(!vp||!a)return null;
  const x=a.x+.5,y=a.y*1.4+1.68,z=a.z+.5;
  const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  const px=(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w,py=(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w;
  return {anchor:[parseFloat(el.style.left),parseFloat(el.style.top)],head:[(1+px)*c.clientWidth/2,(1-py)*c.clientHeight/2]};
 },id);
 assert.ok(placement&&placement.anchor.every((v,i)=>Math.abs(v-placement.head[i])<2),'bubble is projected from the actual resident’s head in the live WebGL view');
 assert.equal((await state(page)).combat.actionAt,swing,'talk action has no attack side effect');
 return d;
}
async function holdAndRetap(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:34,z:61},{clockStart:dateMinute,kit:stock,facing:1});
 try{
  const map=await getMap(page),before=await worker(page,'stablekeeper');
  const roster=(await residents(page)).actors;
  assert.equal(roster.length,11,'three daytime visitors join eight existing residents');
  for(const id of ['westpeddler','northtraveler','canalcourier'])
   assert.equal(roster.find(n=>n.id===id)?.role,'visitor','daytime roster includes '+id);
  assert.deepEqual([before.x,before.z,before.y],[35,61,0]);
  await startTalking(page,'stablekeeper');
  const talk=byId(await residents(page),'stablekeeper');
  assert.equal(talk.facing,3,'NPC physically turns west to face player');
  await picture(page,'stablekeeper-dialogue');
  // Changing in-game hour gives this NPC a real scheduled errand. The
  // dialogue, not a manually edited actor state, holds their position.
  await page.evaluate(()=>window.__editorTest.setTownTime(19*60));
  await page.waitForTimeout(850);
  const held=byId(await residents(page),'stablekeeper');
  assert.deepEqual([held.x,held.z,held.y],[talk.x,talk.z,talk.y]);
  assert.equal((await talkInfo(page)).id,'stablekeeper');
  assert.match(await page.locator(action).getAttribute('aria-label'),/終える|閉じる/);
  await page.locator(action).tap();
  await waitDialogue(page,false);
  await move(page,'s',true,true);
  await page.waitForFunction(()=>window.__editorTest.townResidents().actors.some(n=>n.id==='stablekeeper'&&(n.x!==35||n.z!==61)));
  assert.deepEqual(await readStock(page),stock);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function moveDismiss(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:34,z:61},{clockStart:dateMinute,kit:stock,facing:1});
 try{
  await worker(page,'stablekeeper');
  await startTalking(page,'stablekeeper');
  await move(page,'s',true,true);
  await waitDialogue(page,false);
  assert.deepEqual((await state(page)).position,at(34,62));
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function onOtherFloor(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:31},{clockStart:dateMinute,kit:stock,facing:0,level:1});
 try{
  await worker(page,'innkeeper');
  assert.deepEqual((await state(page)).position,at(41,31,1),'physically upstairs directly beside the innkeeper’s planar coordinate');
  assert.equal(await talkInfo(page),null);
  assert.doesNotMatch(await page.locator(action).getAttribute('aria-label'),/話す/);
  const i=(await state(page)).combat.actionAt;
  await page.locator(action).tap();
  await waitDialogue(page,false);
  assert.ok((await state(page)).combat.actionAt>i,'different-floor NPC does not overwrite normal decision/attack');
  assert.deepEqual(await readStock(page),stock);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function shopPriority(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:69,z:35},{clockStart:dateMinute,kit:stock,facing:1});
 try{
  await worker(page,'toolkeeper');
  assert.match(await page.locator(action).innerText(),/買う/);
  const atk=(await state(page)).combat.actionAt;
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(70,35)),false,'actual shop counter separates guest and NPC');
  await page.locator(action).tap();
  await page.locator('#poiShopDialog').waitFor({state:'visible'});
  await waitDialogue(page,false);
  assert.equal((await state(page)).combat.actionAt,atk,'counter purchase stays ahead of talk or attack');
  await page.locator('#poiShopBuyPotion').tap();
  assert.deepEqual(await readStock(page),{...stock,potions:4,gold:6});
  await page.locator('#poiShopClose').tap();
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await holdAndRetap(browser);await moveDismiss(browser);await onOtherFloor(browser);await shopPriority(browser);
 console.log('PASS mobile Chromium: actual nearby projected conversation, facing/hold/resume, touch dismissal, floor and counter priority, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
