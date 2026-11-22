import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const wrap=(s,anchor,patch)=>{assert.equal(s.split(anchor).length,2,'production diagnostic hook '+anchor);return s.replace(anchor,patch)};
let observed=wrap(html,'function poiWalkAvatar(now=performance.now()){',`function poiWalkAvatar(now=performance.now()){
 window.__avatarBuildDepth=(window.__avatarBuildDepth||0)+1;
 try{return __nativeAvatarBuild(now)} finally{window.__avatarBuildDepth--}
}
function __nativeAvatarBuild(now=performance.now()){`);
observed=wrap(observed,'function upload(m,reuse=null,usage=gl.STATIC_DRAW){',`function upload(m,reuse=null,usage=gl.STATIC_DRAW){
 if(window.__avatarBuildDepth){
  let p=1,c=1;
  for(let i=0;i<m.p.length;i++){
   p=(Math.imul(p,33)^Math.round(m.p[i]*1000))>>>0;
   c=(Math.imul(c,33)^Math.round(m.c[i]*1000))>>>0;
  }
  window.__nativeAvatarGeometry={vertexCount:m.p.length/3,p,c};
 }
 return __nativeUpload(m,reuse,usage);
}
function __nativeUpload(m,reuse=null,usage=gl.STATIC_DRAW){`);
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
 await ctx.addInitScript(()=>{
  const put=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(...args){
   if(this.canvas?.id==='poiAvatarPreview')window.__portraitDepthPaints=(window.__portraitDepthPaints||0)+1;
   return put.apply(this,args);
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
async function center(page,sel){
 const b=await page.locator(sel).boundingBox();assert.ok(b,'visible '+sel);
 return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};
}
async function drag(context,page,from,to){
 const a=await center(page,from),b=typeof to==='string'?await center(page,to):to;
 const c=await context.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  for(let i=1;i<=7;i++){
   await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:Math.round(a.x+(b.x-a.x)*i/7),y:Math.round(a.y+(b.y-a.y)*i/7)}]});
  }
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach();}
}
const parts=['head','torso','legs','feet'];
const items=['starterCap','starterTunic','starterTrousers','starterBoots'];
const expected=Object.fromEntries(parts.map((p,i)=>[p,{type:items[i],count:1}]));
const bag='#poiBagPanel', close='#poiBagClose', chest='#poiChestPanel';
const gear=p=>'#poiGearColumn [data-gear-slot="'+p+'"]';
const slot=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const kitKey='world-workshop-hotbar-v1';
const legacy={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const save=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),kitKey);
const inv=async page=>(await state(page)).inventory;
const mapState=page=>page.evaluate(()=>window.__editorTest.data());
async function openBag(page){
 await page.locator('#poiBagToggle').tap();
 await page.locator(bag).waitFor({state:'visible'});
}
async function closeBag(page){
 await page.locator(close).tap();
 await page.locator(bag).waitFor({state:'hidden'});
}
async function appearance(page){
 await page.waitForFunction(()=>window.__nativeAvatarGeometry?.vertexCount>0);
 return page.evaluate(()=>({preview:document.querySelector('#poiAvatarPreview').toDataURL(),
  avatar:window.__nativeAvatarGeometry}));
}
async function layout(page){
 return page.evaluate(()=>{
  const r=e=>{const q=e.getBoundingClientRect();return {x:q.left,y:q.top,w:q.width,h:q.height,right:q.right,bottom:q.bottom}};
  const cells=[...document.querySelectorAll('#poiBagGrid [data-bag-slot]')].filter(e=>e.getBoundingClientRect().width>0)
   .map(e=>({i:Number(e.dataset.bagSlot),lock:e.disabled||e.getAttribute('aria-disabled')==='true',...r(e)}));
  const gear=[...document.querySelectorAll('#poiGearColumn [data-gear-slot]')].map(e=>({p:e.dataset.gearSlot,...r(e)}));
  return {cells,gear,preview:r(document.querySelector('#poiAvatarPreview')),close:r(document.querySelector('#poiBagClose')),
   bag:r(document.querySelector('#poiBagPanel')),view:r(document.querySelector('#viewWrap')),
   wallet:r(document.querySelector('#poiBagWallet')),
   headerGold:document.querySelector('#poiBagHeading').parentElement.contains(document.querySelector('#poiBagWallet'))};
 });
}
const playerCard='.poiPartyCard[data-party-slot="0"]';
const underPortrait='#poiBagPlayerStats';
async function playerStatus(page){
 const panel=page.locator(underPortrait),hp=page.locator('#poiBagPlayerHpValue'),attack=page.locator('#poiBagPlayerAttackValue');
 await panel.waitFor({state:'visible'});
 assert.equal(await page.locator(playerCard).isVisible(),false,'no duplicate player HUD while bag is up');
 assert.match(await hp.innerText(),/100\s*[/／]\s*100/);
 assert.match(await attack.innerText(),/\b28\b/,'status uses the actual wooden sword damage');
 const [status,art,bag]=await Promise.all([panel.boundingBox(),page.locator('#poiAvatarPreview').boundingBox(),
  page.locator('#poiBagPanel').boundingBox()]);
 assert(status&&art&&bag&&status.y>=art.y+art.height-1,'status sits beneath, not over character art');
 assert(status.x>=bag.x-1&&status.x+status.width<=bag.x+bag.width+1&&status.y+status.height<=bag.y+bag.height+1);
 await page.evaluate(()=>window.__editorTest.testWound(36));
 await page.waitForFunction(()=>/64\s*[/／]\s*100/.test(document.querySelector('#poiBagPlayerHpValue')?.textContent||''));
 assert.equal((await state(page)).combat.playerHP,64);
}
async function exercise(browser,width){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width,kit:legacy});
 try{
  assert.deepEqual(await save(page),legacy,'old kit is not rewritten on load');
  assert.deepEqual((await inv(page)).worn,expected,'legacy hero is wearing all four original garment types');
  const original=await mapState(page);
  assert.ok(await page.locator(playerCard).isVisible(),'closed bag retains existing gameplay HUD');
  await openBag(page);
  await playerStatus(page);
  assert.equal(await page.locator('#poiGoldHud').count(),0,'no left HUD gold panel');
  assert.equal(await page.locator('#poiBagWallet #poiGoldValue').textContent(),String(legacy.gold),'legacy currency is visible in the bag');
  assert.ok(await page.locator('#poiClockHud').isVisible(),'clock remains in gameplay HUD');
  const dims=await layout(page),first=dims.cells[0];
  assert.deepEqual(dims.cells.map(c=>c.i),Array.from({length:24},(_,i)=>i),'24 bag cells and one wallet');
  assert.deepEqual(dims.cells.filter(c=>!c.lock).map(c=>c.i),Array.from({length:9},(_,i)=>i),'only first nine ordinary destinations are usable');
  const all=[...dims.cells,dims.wallet];
  assert.equal(new Set(all.map(c=>Math.round(c.x))).size,5,'exactly five bag columns; no lower ghost cells');
  assert.equal(new Set(all.map(c=>Math.round(c.y))).size,5);
  assert(Math.abs(dims.wallet.y-dims.cells[5].y)<=1&&Math.abs(dims.wallet.x-dims.cells[4].x)<=1,'wallet at second row rightmost cell');
  assert.equal(dims.headerGold,false,'coin indicator is not in bag header');
  assert(dims.gear[0].x-dims.wallet.right>=4,'visible gutter separates bag and gear');
  assert.deepEqual(dims.gear.map(c=>c.p),parts);
  assert(dims.gear.every(c=>Math.abs(c.w-first.w)<=2&&Math.abs(c.h-first.h)<=2&&c.x===dims.gear[0].x));
  assert(dims.gear.every((c,i)=>i===0||c.y>dims.gear[i-1].y),'gear slots are one vertical column');
  assert(dims.preview.w>first.w*2&&dims.preview.h>first.h*3&&dims.preview.x>=dims.gear[0].right-1);
  assert(dims.close.right<=dims.bag.right+1&&dims.bag.right-dims.close.right<15&&dims.close.y<first.y);
  assert(dims.bag.x>=dims.view.x-1&&dims.bag.right<=dims.view.right+1&&dims.bag.bottom<=dims.view.bottom+1,
   'whole bag is within playable mobile frame');
  const dressed=await appearance(page);
  assert.notEqual(dressed.preview,'data:,','preview canvas has rendered dimensions');
  await drag(ctx,page,gear('feet'),slot(8));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.worn.feet===null);
  const removed=await appearance(page);
  assert.notEqual(removed.preview,dressed.preview,'preview pixels change after removing boots');
  assert.notDeepEqual(removed.avatar,dressed.avatar,'actual uploaded 3D player geometry changes too');
  const boot={type:'starterBoots',count:1},before=await save(page);
  assert.deepEqual((await inv(page)).bag[8],boot);
  assert.equal(before.worn.feet,null);
  assert.equal(before.gold,legacy.gold);
  await drag(ctx,page,slot(8),gear('legs'));
  assert.deepEqual(await save(page),before,'wrong armor part refuses, neither item is lost');
  await drag(ctx,page,slot(8),slot(9));
  assert.deepEqual(await save(page),before,'locked destination likewise refuses without a ground drop');
  await closeBag(page);
  assert.ok(await page.locator(playerCard).isVisible(),'closing the bag restores the single gameplay HUD');
  assert.equal(await page.locator(underPortrait).isVisible(),false);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.equal((await inv(page)).worn.feet,null);
  assert.deepEqual((await inv(page)).bag[8],boot,'one nonstacking boot item survives reload');
  await openBag(page);
  assert.equal((await appearance(page)).preview,removed.preview,'reopened preview matches saved loadout');
  await drag(ctx,page,slot(8),gear('feet'));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.worn.feet?.type==='starterBoots');
  assert.equal((await inv(page)).bag[8],null);
  assert.deepEqual((await inv(page)).worn,expected);
  const restored=await appearance(page);
  assert.equal(restored.preview,dressed.preview,'equipping again restores exact preview pixels');
  assert.deepEqual(restored.avatar,dressed.avatar,'equipping again restores exact actual 3D appearance');
  const portraitPaints=await page.evaluate(()=>window.__portraitDepthPaints);
  assert.ok(portraitPaints>0,'portrait uses the depth-resolved canvas painter');
  for(let i=0;i<3;i++){
   await closeBag(page);await openBag(page);
   assert.equal((await appearance(page)).preview,restored.preview,'portrait pixels remain stable across reopening');
  }
  assert.equal(await page.evaluate(()=>window.__portraitDepthPaints),portraitPaints,'same outfit does not redraw portrait on each open or animation frame');
  if(out)await page.screenshot({path:out+'/v179-equipped-'+width+'.png'});
  await closeBag(page);
  assert.deepEqual(await mapState(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function chestPanel(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{width:390,level:-1,facing:3,kit:legacy});
 try{
  const original=await mapState(page);
  await page.locator('#poiWalkAction').tap();
  await page.locator(chest).waitFor({state:'visible'});
  await page.locator(bag).waitFor({state:'visible'});
  const [bx,cx]=await Promise.all([page.locator(close).boundingBox(),page.locator('#poiChestClose').boundingBox()]);
  assert(bx&&cx&&Math.abs(bx.width-cx.width)<=1&&Math.abs(bx.height-cx.height)<=1,'matching compact X controls');
  await closeBag(page);
  await page.locator(chest).waitFor({state:'hidden'});
  assert.deepEqual(await mapState(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function legacyWithdrawal(browser){
 const slots=Array(27).fill(null);
 slots[0]={type:'equipWoodSword',count:1};slots[1]={type:'healingHerb',count:3};
 const food={type:'cannedFood',count:1};
 slots[9+9]=food;slots[9+17]=food;
 const old={...legacy,slots};
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width:390,kit:old});
 try{
  await openBag(page);
  assert.deepEqual(await save(page),old,'read does not migrate or collapse old indexes');
  assert.deepEqual((await inv(page)).bagLegacy,[9,17]);
  const hold=await save(page);
  // An occupied legacy cell can be a source, never a new destination. A
  // swap that would place another item in its old cell is also rejected.
  await drag(ctx,page,'#poiHotbar [data-hotbar-slot="1"]',slot(9));
  assert.deepEqual(await save(page),hold);
  await drag(ctx,page,slot(9),'#poiHotbar [data-hotbar-slot="1"]');
  assert.deepEqual(await save(page),hold);
  await drag(ctx,page,slot(9),slot(8));
  const result=await inv(page);
  assert.deepEqual([result.bag[8],result.bag[9],result.bag[17]],[food,null,food]);
  assert.deepEqual(result.bagLegacy,[17]);
  const after=await save(page);
  assert.equal(after.slots.length,27);
  assert.deepEqual([after.slots[17],after.slots[18],after.slots[26]],[food,null,food]);
  await closeBag(page);await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual((await inv(page)).bagLegacy,[17]);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const width of [320,390])await exercise(browser,width);
 await legacyWithdrawal(browser);await chestPanel(browser);
 console.log('PASS mobile Chromium garment slots, touch transfers, pixels and live 3D mesh, reload, X and chest coupling, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
