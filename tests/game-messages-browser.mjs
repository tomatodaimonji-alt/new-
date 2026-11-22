import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Only the item-typography enemy encounter uses a fixed wild spawn; its
// HP, real attack sequence and defeat announcement are left untouched.
const spawnAnchor='const p=poiWildPick(rng);';
assert.equal(html.split(spawnAnchor).length,2,'unique ordinary wild-spawn anchor');
const defeatFixture=html.replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/defeat')?defeatFixture:html);
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
async function typography(page,kind,caption='アナウンス'){
 const measure=await page.evaluate(kind=>{
  const heading=document.querySelector('#poiMessageHeading');
  const line=document.querySelector('.poiMessageLine[data-kind="'+kind+'"]');
  if(!heading||!line)return null;
  const styles=n=>{const s=getComputedStyle(n);return {family:s.fontFamily,size:s.fontSize,weight:Number(s.fontWeight),color:s.color,lineHeight:s.lineHeight}};
  const {top:ht,bottom:hb}=heading.getBoundingClientRect(),{top:lt}=line.getBoundingClientRect();
  return {caption:heading.textContent,heading:styles(heading),line:styles(line),ht,hb,lt};
 },kind);
 assert.ok(measure,'live message row for '+kind);
 assert.equal(measure.caption,caption);
 assert.equal(measure.heading.family,measure.line.family,'same font family: '+kind);
 assert.equal(measure.heading.size,measure.line.size,'same actual responsive font size: '+kind);
 assert.equal(measure.heading.lineHeight,measure.line.lineHeight,'same line-height');
 assert.equal(measure.line.weight,650,'all message body kinds have one weight');
 assert.equal(measure.line.color,'rgb(255, 248, 231)','all body kinds use the same cream, including gold');
 assert.equal(measure.heading.color,'rgb(222, 203, 165)','heading alone retains muted separation');
 assert.equal(measure.heading.weight-measure.line.weight,100,'heading alone has subtly stronger weight');
 assert.ok(measure.ht<measure.lt&&measure.hb<=measure.lt+1,'heading remains a separate line above message text');
}
async function defeatTypography(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:73},{fixture:'defeat',width:390,facing:1});
 try{
  const wild=await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.x===42&&a.z===73&&a.hp===35),null,{timeout:16000});
  assert.ok(wild);
  await page.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
  await page.locator('#poiWalkAction').tap();
  await page.waitForTimeout(410);
  await page.locator('#poiWalkAction').tap();
  await page.locator('.poiMessageLine[data-kind="defeat"]').filter({hasText:/^スライムを倒した$/}).waitFor({state:'visible'});
  await typography(page,'defeat');
  await move(page,'e',true,true);
  await page.locator('.poiMessageLine[data-kind="gold"]').filter({hasText:/^3G拾った！$/}).waitFor({state:'visible'});
  await typography(page,'gold');
  if(out)await page.screenshot({path:out+'/v154-announcement-typography-390.png'});
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
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
  await typography(page,'gold');
  await geometry(page);
  if(out)await page.screenshot({path:out+'/v154-game-message-pickup-320.png'});
  await move(page,'w');
  await page.waitForFunction(sel=>/薬草/.test(document.querySelector(sel)?.textContent||''),boxId);
  assert.equal((await state(page)).inventory.potions,3,'stepping back picks up the actual loose herb');
  await typography(page,'item');
  await typography(page,'gold');
  await move(page,'e');
  assert.equal((await state(page)).economy.gold,3,'repeated walking grants no extra gold');
  assert.deepEqual(errors,[]);await unchanged(page);
 }finally{await ctx.close();}
}

async function dialogue(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:34,z:61},{clockStart:720,facing:1,width:390,
  kit:{version:1,weapon:null,potions:2,drops:[{type:'healingHerb',x:34,z:62,y:0}]}});
 try{
  const panel=page.locator(boxId);
  await panel.waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')?.includes('話す'));
  const attack=(await state(page)).combat.actionAt;
  await page.locator(action).tap();
  const actor=await page.evaluate(()=>window.__editorTest.townResidents().dialogue);
  assert.equal(actor.id,'stablekeeper');
  const body=page.locator('#poiMessageLog .poiMessageLine[data-kind="dialogue"]').filter({hasText:actor.text});
  await body.waitFor({state:'visible'});
  assert.equal(await body.textContent(),actor.text,'speech-only body, without duplicated speaker prefix');
  assert.equal(await page.locator('#poiMessageHeading').textContent(),'厩舎番','actual Japanese resident name becomes heading');
  assert.equal(await page.locator('#poiTownSpeech').isVisible(),false,'player to NPC is announcement-only');
  await typography(page,'dialogue','厩舎番');
  assert.deepEqual(await panel.evaluate(el=>[getComputedStyle(el).textAlign,getComputedStyle(el).justifyContent]),['left','flex-start']);
  assert.equal((await state(page)).combat.actionAt,attack);
  await geometry(page);
  if(out)await page.screenshot({path:out+'/v156-resident-name-heading-390.png'});
  await page.locator(action).tap();
  await page.waitForFunction(()=>document.querySelector('#poiMessageHeading')?.textContent==='アナウンス');
  assert.equal(await body.isVisible(),false,'closing dialogue clears speaker text');
  await page.locator(action).tap();
  await body.waitFor({state:'visible'});
  await move(page,'s',true,true);
  await page.locator('.poiMessageLine[data-kind="item"]').filter({hasText:/薬草を拾った/}).waitFor({state:'visible'});
  await typography(page,'item');
  assert.equal((await state(page)).inventory.potions,3,'actual new pickup restores ordinary notice after leaving conversation');
  assert.equal(await body.isVisible(),false);
  assert.deepEqual(errors,[]);await unchanged(page);
 }finally{await ctx.close();}
}
async function ambientInn(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:42,z:32},{clockStart:16*60+23,facing:0,width:390});
 try{
  const started=await page.waitForFunction(()=>{
   const state=window.__editorTest.townResidents(),a=state.ambientDialogue,el=document.querySelector('#poiTownSpeech');
   return a&&a.guest==='guestadventurer'&&!el.hidden&&el.textContent.includes(a.text)&&a;
  },null,{timeout:24000,polling:'raf'});
  const guest=await started.jsonValue();
  assert.equal(guest.speaker,'guestadventurer','booked guest actually initiates the exchange');
  assert.equal(guest.host,'innkeeper');
  assert.equal(guest.venue,'inn');
  const occupied=await page.evaluate(()=>window.__editorTest.townResidents().actors.find(a=>a.id==='guestadventurer').bedId);
  assert.equal(occupied,'inn-west','bubble came from successful actual NPC lodging service');
  const follow=await page.waitForFunction(()=>{
   const state=window.__editorTest.townResidents(),a=state.ambientDialogue,el=document.querySelector('#poiTownSpeech');
   return a&&a.speaker==='innkeeper'&&!el.hidden&&el.textContent.includes(a.text)&&a;
  },null,{timeout:4000,polling:'raf'});
  const host=await follow.jsonValue();
  assert.notEqual(guest.text,host.text,'genuine different host and guest lines');
  assert.equal(await page.locator('#poiMessageLog .poiMessageLine').count(),0,'NPC-to-NPC stays only overhead, not announcement');
  const measured=await page.locator('#poiTownSpeech').evaluate(el=>{
   const css=getComputedStyle(el),tail=getComputedStyle(el,'::after'),pad=getComputedStyle(document.querySelector('#poiWalkPad'));
   const a=window.__editorTest.townResidents().actors.find(a=>a.id==='innkeeper');
   const vp=window.__dialogueVP,d=document.querySelector('#view');
   if(!vp||!a)return null;
   const x=a.x+.5,y=a.y*1.4+1.68,z=a.z+.5;
   const w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
   const px=(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w,py=(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w;
   return {left:parseFloat(el.style.left),top:parseFloat(el.style.top),x:(1+px)*d.clientWidth/2,y:(1-py)*d.clientHeight/2,
    align:css.textAlign,opacity:css.opacity,surface:css.backgroundColor,pad:pad.backgroundColor,tail:tail.borderTopColor};
  });
  assert.ok(measured&&Math.abs(measured.left-measured.x)<2&&Math.abs(measured.top-measured.y)<2,'other NPC speech still follows the speaker’s live WebGL head');
  assert.equal(measured.align,'left');assert.equal(measured.opacity,'1');
  assert.equal(measured.surface,measured.pad);assert.equal(measured.tail,measured.surface);
  if(out)await page.screenshot({path:out+'/v154-npc-inn-ambient-only-390.png'});
  await page.locator('#poiTownSpeech').waitFor({state:'hidden',timeout:6000});
  assert.equal(await page.locator('#poiMessageLog .poiMessageLine').count(),0);
  assert.deepEqual(errors,[]);await unchanged(page);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await pickup(browser);
 await dialogue(browser);
 await ambientInn(browser);
 await defeatTypography(browser);
 console.log('PASS actual 320/390 Chromium: translucent game message geometry, live touch coin pickup, player dialogue only in log, NPC check-in only overhead, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
