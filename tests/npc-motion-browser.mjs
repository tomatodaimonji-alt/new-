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
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const gl=WebGLRenderingContext.prototype,old=gl.bufferData;
  const frames=window.__npcFrameUploads={serial:0,terrain:0,poses:[]};
  gl.bufferData=function(target,source,usage){
   const bytes=typeof source==='number'?source:source?.byteLength||0;
   if(bytes>=3000000)frames.terrain++;
   if(ArrayBuffer.isView(source)&&bytes>=3000&&bytes<3000000){
    let h=2166136261;
    // Each interleaved vertex is XYZ, normal XYZ, color RGB. Include all
    // position axes at each sample; shallow breathing changes height only.
    const stride=9,vertices=Math.floor(source.length/stride);
    for(let i=0;i<160;i++){
     const start=Math.floor(i*(vertices-1)/159)*stride;
     for(let axis=0;axis<3;axis++)h=Math.imul(h^Math.round(source[start+axis]*16384),16777619);
    }
    frames.poses.push({serial:++frames.serial,h,bytes});
    if(frames.poses.length>192)frames.poses.shift();
   }
   return old.call(this,target,source,usage);
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
 await page.screenshot({path:out+'/v145-'+label+'.png'});
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
async function sample(page,id,kinds,wait=2600){
 return page.evaluate(({id,kinds,wait})=>new Promise(resolve=>{
  const start=performance.now(),records=[],poses=new Set();
  const base=window.__npcFrameUploads,terrain=base.terrain,serial=base.serial;
  function tick(now){
   const actor=window.__editorTest.townResidents()?.actors.find(o=>o.id===id);
   const m=actor?.motion;
   if(actor&&m&&kinds.includes(m.kind)){
    records.push({x:actor.x,z:actor.z,y:actor.y,phase:m.phase,amount:m.amount,near:m.near,kind:m.kind});
    for(const row of base.poses)if(row.serial>serial)poses.add(row.bytes+':'+row.h);
   }
   if(now-start>=wait)return resolve({records,posed:poses.size,terrain:base.terrain-terrain,final:actor});
   requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
 }),{id,kinds,wait});
}
function animated(body,label,{positions=false}={}){
 const close=body.records.filter(r=>r.near&&Number.isFinite(r.phase)&&Number.isFinite(r.amount));
 assert.ok(close.length>=2,label+' was sampled in actual nearby running renderer: '+JSON.stringify(body.final));
 assert.ok(new Set(close.map(x=>x.phase)).size>=2,label+' phases are not static');
 assert.ok(close.some(x=>Math.abs(x.amount)>0),label+' produces nonzero posed amount');
 assert.ok(body.posed>=2,label+' produces different real WebGL buffer payloads');
 assert.equal(body.terrain,0,label+' does not rebuild the full map geometry');
 if(positions)assert.ok(new Set(close.map(r=>r.x+','+r.z+','+r.y)).size>=2,label+' actually moves on world tiles');
}
async function awaitActor(page,id,activity){
 await page.waitForFunction(({id,activity})=>window.__editorTest.townResidents()?.actors.some(a=>a.id===id&&a.activity===activity),{id,activity});
}
async function setTown(page,t){
 assert.equal(await page.evaluate(()=>document.hidden),false);
 await page.evaluate(t=>window.__editorTest.setTownTime(t),t);
}
async function innMotions(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:32},{clockStart:12*60,kit:stock,facing:0});
 try{
  const map=await getMap(page);
  await awaitActor(page,'innkeeper','work');
  const clerk=byId(await residents(page),'innkeeper');
  assert.deepEqual([clerk.x,clerk.z,clerk.y],[41,30,0]);
  const desk=await sample(page,'innkeeper',['write'],1450);
  animated(desk,'desk writing');
  await picture(page,'innkeeper-writing');
  assert.match(await page.locator(action).innerText(),/泊まる|宿泊/);
  const pending=sample(page,'innkeeper',['check-in-host'],1800);
  await page.locator(action).tap();
  const booking=await pending;
  animated(booking,'real check-in gesture');
  assert.ok((await residents(page)).playerBedId,'actual touch booking acquired a real bed');
  assert.deepEqual(await readStock(page),stock,'inn animation and free booking do not affect player wallet');
  const moving=sample(page,'innkeeper',['walk'],3800);
  await setTown(page,19*60);
  animated(await moving,'real closing walk',{positions:true});
  const idle=await sample(page,'innkeeper',['idle'],1900);
  animated(idle,'standing idle');
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function trade(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:69,z:35},{clockStart:12*60,kit:stock,facing:1});
 try{
  const map=await getMap(page);
  await awaitActor(page,'toolkeeper','work');
  await page.locator(action).tap();
  await page.locator('#poiShopDialog').waitFor({state:'visible'});
  const pending=sample(page,'toolkeeper',['trade-sell'],1700);
  await page.locator('#poiShopBuyPotion').tap();
  animated(await pending,'real potion sale gesture');
  assert.deepEqual(await readStock(page),{...stock,potions:4,gold:6});
  await page.locator('#poiShopClose').tap();
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function sleep(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:40,z:26},{clockStart:21*60+30,kit:stock,level:1,facing:0});
 try{
  const map=await getMap(page);
  assert.deepEqual((await state(page)).position,at(40,26,1),'real upper boarding area');
  await awaitActor(page,'guestadventurer','sleep-inn');
  const before=byId(await residents(page),'guestadventurer');
  const nap=await sample(page,'guestadventurer',['sleep'],2250);
  animated(nap,'settled breathing on actual bed');
  const after=byId(await residents(page),'guestadventurer');
  assert.deepEqual([after.x,after.z,after.y,after.bedId],[before.x,before.z,before.y,before.bedId],'breathing never moves or rebooks sleeper');
  assert.deepEqual(await readStock(page),stock);
  await picture(page,'guest-sleep-breathing');
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await innMotions(browser);await trade(browser);await sleep(browser);
 console.log('PASS Chromium: actual animated desk/booking/walking/idle/trade/sleep geometry, map and existing saves intact');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
