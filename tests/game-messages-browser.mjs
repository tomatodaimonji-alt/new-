import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// UI observation only: expose the real unadjusted world-projected anchor.
const projectionAnchor='const pt=poiWorldToScreen(vp,a.x+.5,(height??terrainY(a.x,a.z))+a.y*1.4+1.68,a.z+.5);';
assert.equal(html.split(projectionAnchor).length,2,'unique speech projection anchor');
const measuredHTML=html.replace(projectionAnchor,projectionAnchor+'window.__naturalSpeechPoint=pt;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':measuredHTML);
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

const boxId='#poiMessagePanel';
const action='#poiWalkAction';
async function geometry(page){
 const panel=page.locator(boxId);
 await panel.waitFor({state:'visible'});
 const measure=await page.evaluate(boxId=>{
  const get=sel=>document.querySelector(sel);
  const rect=sel=>{const {x,y,width,height,bottom,right}=get(sel).getBoundingClientRect();return {x,y,width,height,bottom,right}};
  const css=getComputedStyle(get(boxId));
  return {view:rect('#viewWrap'),panel:rect(boxId),party:rect('#poiPartyHud'),hotbar:rect('#poiHotbar'),
   pad:rect('#poiWalkPad'),tools:rect('#poiGameTools'),left:rect('#poiMiniHud'),color:css.backgroundColor,
   opacity:css.opacity,pointer:css.pointerEvents};
 },boxId);
 const {view:v,panel:p,party:h,hotbar,pad,tools,left,color,opacity,pointer}=measure;
 const message=JSON.stringify(measure);
 assert.ok(p.width>=v.width*.90&&p.x>=v.x-1&&p.right<=v.right+1,'near full width, bounded by gameplay viewport: '+message);
 assert.ok(Math.abs((p.x+p.width/2)-(v.x+v.width/2))<=3,'balanced insets: '+message);
 assert.ok(p.height/h.height>=2.2&&p.height/h.height<=2.5,'approximately 2.3 status rows tall: '+message);
 assert.ok(h.y>=p.bottom-1&&h.y-p.bottom<=16,'immediately above player status: '+message);
 for(const controls of [hotbar,pad,tools,left]){
  const overlap=p.x<controls.right&&p.right>controls.x&&p.y<controls.bottom&&p.bottom>controls.y;
  assert.ok(!overlap,'does not cover movement, items, or status/tools: '+message);
 }
 assert.match(color,/rgba\([^)]*, 0\.[0-9]+\)$/,'translucent surface, not opaque or whole-element opacity');
 assert.equal(opacity,'1');
 assert.equal(pointer,'none','cannot intercept underlying world or controls');
}
async function pickup(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:88,z:55},{clockStart:720,kit:{version:1,weapon:null,potions:2,drops:[{type:'healingHerb',x:88,z:55,y:0}]},facing:1,width:320});
 try{
  const panel=page.locator(boxId);
  await panel.waitFor({state:'hidden'});
  assert.doesNotMatch(await panel.innerText(),/3\s*G\s*拾った/,'no fake coin notice before collection');
  await move(page,'e',true,true);
  await page.waitForFunction(sel=>/3\s*G\s*拾った[！!]/.test(document.querySelector(sel)?.textContent||''),boxId);
  assert.equal((await state(page)).economy.gold,3,'visible notice comes from actual pickup');
  await geometry(page);
  if(out)await page.screenshot({path:out+'/v151-game-message-pickup-320.png'});
  await move(page,'w');
  await page.waitForFunction(sel=>/薬草/.test(document.querySelector(sel)?.textContent||''),boxId);
  assert.equal((await state(page)).inventory.potions,3,'stepping back picks up the actual loose herb');
  await move(page,'e');
  assert.equal((await state(page)).economy.gold,3,'repeated walking grants no extra gold');
  assert.deepEqual(errors,[]);await unchanged(page);
 }finally{await ctx.close();}
}
async function measureSpeech(page){
 return page.evaluate(boxId=>{
  const b=document.querySelector('#poiTownSpeech'),m=document.querySelector(boxId),point=window.__naturalSpeechPoint;
  const v=document.querySelector('#viewWrap').getBoundingClientRect();
  if(!point||b.hidden)return null;
  const r=b.getBoundingClientRect(),panel=m.getBoundingClientRect(),tail=parseFloat(getComputedStyle(b,'::after').borderTopWidth);
  // Natural speech is translated up by its own height and its fixed CSS margin.
  const normalBottom=v.y+Math.round(point.y)+parseFloat(getComputedStyle(b).marginTop);
  return {naturalBottom:normalBottom,naturalTop:normalBottom-r.height,left:r.left,right:r.right,
   bottom:r.bottom,top:r.top,tail:Number.isFinite(tail)?tail:0,screenX:v.x+Math.round(point.x),
   panel:{left:panel.left,right:panel.right,top:panel.top,bottom:panel.bottom,height:panel.height}};
 },boxId);
}
async function dialogue(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:34,z:61},{clockStart:720,facing:1,width:390});
 try{
  await page.locator(boxId).waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')?.includes('話す'));
  const attack=(await state(page)).combat.actionAt;
  await page.locator(action).tap();
  await page.locator('#poiTownSpeech').waitFor({state:'visible'});
  const actor=await page.evaluate(()=>window.__editorTest.townResidents().dialogue);
  assert.equal(actor.id,'stablekeeper');
  const panel=page.locator(boxId);
  await page.waitForFunction(({boxId,text})=>document.querySelector(boxId)?.textContent.includes(text),{boxId,text:actor.text});
  assert.ok((await page.locator('#poiTownSpeech').innerText()).includes(actor.text),'same live line stays in the overhead balloon');
  const glass=await page.evaluate(boxId=>{
   const balloon=document.querySelector('#poiTownSpeech'),bubble=getComputedStyle(balloon),tail=getComputedStyle(balloon,'::after');
   return {bubble:bubble.backgroundColor,panel:getComputedStyle(document.querySelector(boxId)).backgroundColor,
    pad:getComputedStyle(document.querySelector('#poiWalkPad')).backgroundColor,opacity:bubble.opacity,text:bubble.color,
    shadow:bubble.textShadow,corners:parseFloat(bubble.borderTopLeftRadius),tailContent:tail.content,
    tailBg:tail.backgroundColor,tailEdge:tail.borderTopColor,tailBottom:tail.borderBottomColor,tailPos:tail.position};
  },boxId);
  assert.equal(glass.bubble,glass.pad,'NPC bubble exactly matches the resting D-pad tint');
  assert.equal(glass.bubble,glass.panel,'overhead and scrolling messages use the same translucent surface');
  assert.equal(glass.opacity,'1','fade the glass, not the lettering');
  const textComponents=glass.text.match(/\d+(?:\.\d+)?/g)?.map(Number)??[];
  assert.ok(textComponents.length===3&&textComponents.slice(0,3).every(n=>n>=214),'fully opaque readable light text');
  assert.notEqual(glass.shadow,'none','text remains readable over bright scenery');
  assert.ok(glass.corners>=5&&glass.tailPos==='absolute'&&glass.tailContent!=='none','speech bubble retains its rounded shape and tail');
  assert.ok([glass.tailBg,glass.tailEdge,glass.tailBottom].includes(glass.bubble),'tail uses the same transparent tint without a mismatched opaque tip');

  assert.ok((await panel.innerText()).includes(actor.text));
  assert.equal((await state(page)).combat.actionAt,attack);
  await geometry(page);
  await page.waitForFunction(()=>['above','below'].includes(document.querySelector('#poiTownSpeech').dataset.side));
  const overlap=await measureSpeech(page);
  assert.ok(overlap&&overlap.naturalBottom>overlap.panel.top&&overlap.naturalTop<overlap.panel.bottom,
   'fixture recreates original projected speech overlap: '+JSON.stringify(overlap));
  assert.ok(overlap.bottom+overlap.tail<=overlap.panel.top-3||
   overlap.top>=overlap.panel.bottom+3||overlap.right<=overlap.panel.left-3||overlap.left>=overlap.panel.right+3,
   'overhead speech, including its tail, clears the readable log: '+JSON.stringify(overlap));
  if(out)await page.screenshot({path:out+'/v152-game-message-no-overlap-390.png'});
  // A missing/hidden log must not shift the normal head projection.
  await panel.evaluate(el=>el.hidden=true);
  await page.waitForFunction(()=>!['above','below'].includes(document.querySelector('#poiTownSpeech').dataset.side));
  const natural=await measureSpeech(page);
  assert.ok(natural&&Math.abs(natural.bottom-natural.naturalBottom)<=1.5&&
    Math.abs((natural.left+natural.right)/2-natural.screenX)<=1.5,
    'overhead speech stays centered over its real head projection when clear: '+JSON.stringify(natural));
  assert.deepEqual(errors,[]);await unchanged(page);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await pickup(browser);
 await dialogue(browser);
 console.log('PASS actual 320/390 Chromium: translucent game message geometry, live touch coin pickup, resident line and original balloon, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
