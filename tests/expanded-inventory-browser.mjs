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


const sword={type:'equipWoodSword',count:1}, herb=count=>({type:'healingHerb',count});
const bar=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const bag=i=>'[data-bag-slot="'+i+'"]';
const toggle='#poiBagToggle';
const panel='#poiBagPanel';
const bagState=async page=>(await state(page)).inventory;
const kitKey='world-workshop-hotbar-v1';
const pot=[42,43];
const startKit={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
async function reload(page){
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
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
async function geometry(page){
 const dims=await page.evaluate(({panel,toggle})=>{
  const rect=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return [r.x,r.y,r.width,r.height]};
  const hot=[...document.querySelectorAll('#poiHotbar [data-hotbar-slot]')].map(el=>{
   const r=el.getBoundingClientRect();return [r.x,r.y,r.width,r.height];
  });
  return {wrap:rect('#viewWrap'),panel:rect(panel),hotbar:rect('#poiHotbar'),toggle:rect(toggle),pad:rect('#poiWalkPad'),action:rect('#poiWalkAction'),hot};
 },{panel,toggle});
 assert.equal(dims.hot.length,8);
 assert.ok(dims.hotbar[2]>=dims.wrap[2]*.90,'hotbar spans nearly the full mobile view width');
 assert.ok(dims.hot.every(([x,y,w,h],i)=>y===dims.hot[0][1]&&w>=27&&h>=27&&(i===0||x>dims.hot[i-1][0])),'one line of eight tap-sized slots');
 assert.ok(dims.hotbar[0]>=dims.wrap[0]&&dims.hotbar[0]+dims.hotbar[2]<=dims.wrap[0]+dims.wrap[2]+1,'no horizontal overflow');
 const [x,y,w,h]=dims.toggle;
 assert.ok(x<dims.action[0]&&Math.abs(w-dims.action[2])<=2&&Math.abs(h-dims.action[3])<=2,'inventory button sits left of D-pad and matches its touch size: '+JSON.stringify(dims));
 const [px,py,pw,ph]=dims.pad;
 const gap=px-x-w;
 assert.ok(gap>=-1&&gap<=8&&Math.abs(y-py)<=2,'inventory toggle is outside and aligned to upper-left of D-pad panel: '+JSON.stringify(dims));
 assert.ok(y+2*h+3<=py+ph,'room for another same-height button below without moving other controls');
 const reserved=await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.closest('button')?.id||null,{x:x+w/2,y:y+h*1.5+3});
 assert.equal(reserved,null,'below-toggle space is not covered by a stray button');
}
async function openBag(page){
 await page.locator(toggle).tap();await page.locator(panel).waitFor({state:'visible'});
 const layout=await page.evaluate(panel=>{
  const el=document.querySelector(panel),r=el.getBoundingClientRect();
  const title=el.querySelector('#poiBagHeading'),h=title.getBoundingClientRect(),css=getComputedStyle(title);
  return {panel:[r.left,r.top,r.right,r.bottom],title:{text:title.textContent,x:h.left,y:h.top,bottom:h.bottom,size:parseFloat(css.fontSize),align:css.textAlign},cells:[...el.querySelectorAll('[data-bag-slot]')].map(b=>{
   const q=b.getBoundingClientRect();return {disabled:b.disabled||b.getAttribute('aria-disabled')==='true',x:q.x,y:q.y,width:q.width,height:q.height};
  })};
 },panel);
 assert.equal(layout.cells.length,40);
 assert.equal(layout.title.text,'インベントリ');
 assert.ok(layout.title.x-layout.panel[0]>=0&&layout.title.x-layout.panel[0]<=14&&layout.title.y-layout.panel[1]>=0&&layout.title.y-layout.panel[1]<=14,'small title at bag top-left');
 assert.ok(layout.title.bottom<=layout.cells[0].y+1&&layout.title.size<=14&&layout.title.align!=='center','heading stays compact and above the slot grid');
 assert.ok(layout.cells.every(slot=>slot.width>=23&&slot.height>=23&&Math.abs(slot.width-slot.height)<=2),'all 40 slots stay near-square, including locked slots');
 assert.equal(new Set(layout.cells.map(c=>c.x.toFixed(1))).size,8);
 assert.equal(new Set(layout.cells.map(c=>c.y.toFixed(1))).size,5);
 assert.deepEqual(layout.cells.map(c=>c.disabled),Array.from({length:40},(_,i)=>i>=16),'top two rows only usable');
 assert.equal((await bagState(page)).bagUnlocked,16);
}
async function closeBag(page){
 await page.locator(toggle).tap();
 await page.locator(panel).waitFor({state:'hidden'});
}
async function transfers(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{width:320,facing:1,kit:startKit});
 try{
  await geometry(page);
  assert.deepEqual((await bagState(page)).hotbar,[sword,herb(3),null,null,null,null,null,null],'legacy slots migrate faithfully');
  await page.locator(bar(0)).tap();
  assert.equal((await bagState(page)).weapon,'equipWoodSword');
  await openBag(page);
  if(out)await page.screenshot({path:out+'/v157-inventory-320.png'});
  await drag(ctx,page,bar(0),bag(0));
  let now=await bagState(page);
  assert.deepEqual([now.hotbar[0],now.bag[0],now.weapon],[null,sword,null],'touch drag stows and unequips sword');
  await drag(ctx,page,bar(1),bag(0));
  now=await bagState(page);
  assert.deepEqual([now.hotbar[1],now.bag[0]],[sword,herb(3)],'occupied destination swaps without loss');
  await drag(ctx,page,bag(0),bag(16));
  assert.deepEqual(await bagState(page),now,'locked slot refuses transfer and does not drop the item');
  await drag(ctx,page,bag(0),bar(7));
  now=await bagState(page);
  assert.deepEqual([now.hotbar[7],now.bag[0]],[herb(3),null],'bag can move items back to the full-width hotbar');
  await closeBag(page);
  const slot=await center(page,bar(7));
  await drag(ctx,page,bar(7),{x:slot.x,y:slot.y-145});
  now=await bagState(page);
  assert.deepEqual(now.hotbar[7],herb(2),'outside swipe drops one item, not its stack');
  assert.ok(now.drops.some(d=>d.type==='healingHerb'&&d.x===pot[0]&&d.z===pot[1]&&d.y===0),'one actual adjacent dry-ground herb');
  await reload(page);
  assert.deepEqual(await bagState(page),now,'moved slots and ground stock survive browser restart');
  await move(page,'e',true,true);
  now=await bagState(page);
  assert.deepEqual(now.hotbar[7],herb(3),'step-over merges the dropped item back');
  assert.equal(now.drops.length,0);
  const once=now;
  await move(page,'w');await move(page,'e');
  assert.deepEqual(await bagState(page),once,'re-entering the same tile grants no duplicate');
  const raw=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),kitKey);
  assert.deepEqual([raw.version,raw.gold,raw.claimedCaches],[1,12,['glade']]);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function overflow(browser){
 const full=[sword,...Array.from({length:7},()=>herb(9)),...Array(16).fill(null)];
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{width:390,facing:1,
  kit:{...startKit,potions:9,slots:full,drops:[{type:'healingHerb',x:42,z:43,y:0}]}});
 try{
  await geometry(page);
  const before=await bagState(page);
  assert.deepEqual(before.hotbar,full.slice(0,8));
  assert.deepEqual(before.bag,Array(40).fill(null));
  await move(page,'e',true,true);
  const filled=await bagState(page);
  assert.deepEqual(filled.hotbar,before.hotbar,'full hotbar remains unchanged');
  assert.deepEqual(filled.bag[0],herb(1),'actual pickup falls through into the first unlocked bag slot');
  assert.equal(filled.drops.length,0);
  await openBag(page);
  if(out)await page.screenshot({path:out+'/v157-overflow-bag-390.png'});
  await reload(page);
  assert.deepEqual(await bagState(page),filled,'overflow bag inventory persists exactly once');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await transfers(browser);await overflow(browser);
 console.log('PASS actual mobile 320/390 Chromium inventory: slot grids, touch transfers, blocked rows, drop/pickup, overflow and persisted saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
