import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Browser-only random seam for the genuine first-open routine.
const rollAnchor='function poiOpenKitchenChest(rng=Math.random){';
assert.equal(html.split(rollAnchor).length,2,'unique genuine kitchen chest open routine');
const observed=html.replace(rollAnchor,`function poiOpenKitchenChest(rng=Math.random){
 const stored=sessionStorage.getItem('qa-kitchen-rng');
 if(stored!==null){rng=()=>{window.__qaChestRolls=(window.__qaChestRolls||0)+1;return Number(stored)};}
`);
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
   view:{yaw,zoom:1.05,panX:0,panZ:0,level,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
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



const selector='#poiChestPanel';
const chest=i=>'#poiChestGrid [data-chest-slot="'+i+'"]';
const bag=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const hot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const kitKey='world-workshop-hotbar-v1';
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade'],
 towerFind:{kind:'empty'}};
const inv=async page=>(await state(page)).inventory;
const readMap=page=>page.evaluate(()=>window.__editorTest.data());
const storage=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),kitKey);
const setRoll=(page,r)=>page.evaluate(r=>sessionStorage.setItem('qa-kitchen-rng',String(r)),r);
const rolls=page=>page.evaluate(()=>window.__qaChestRolls||0);
const knife={type:'kitchenKnife',count:1,durability:40},can={type:'cannedFood',count:1},herb={type:'healingHerb',count:3};
const action='#poiWalkAction';
const spot={x:28,z:32}, facing=3, level=-1;
async function center(page,target){
 const r=await page.locator(target).boundingBox();assert.ok(r,'actual touch target '+target);
 return [Math.round(r.x+r.width/2),Math.round(r.y+r.height/2)];
}
async function drag(ctx,page,from,to){
 const [x,y]=await center(page,from),[tx,tY]=typeof to==='string'?await center(page,to):to;
 const session=await ctx.newCDPSession(page);
 try{
  await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=6;i++)await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:Math.round(x+(tx-x)*i/6),y:Math.round(y+(tY-y)*i/6)}]});
  await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await session.detach();}
}
async function openChest(page){
 await page.waitForFunction(()=>/宝箱|箱を開|チェストを開/.test(document.querySelector('#poiWalkAction')?.innerText||'')||
  /宝箱|箱を開|チェストを開/.test(document.querySelector('#poiWalkAction')?.getAttribute('aria-label')||''));
 await page.locator(action).tap();
 await page.locator(selector).waitFor({state:'visible'});
 await page.locator('#poiBagPanel').waitFor({state:'visible'});
 const grid=await page.locator('#poiChestGrid [data-chest-slot]').evaluateAll(nodes=>nodes.map(e=>{
  const r=e.getBoundingClientRect();
  const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
  return [r.x,r.y,r.width,r.height,e.disabled,e.contains(hit),hit&&(hit.id||hit.className||hit.tagName)];
 }));
 assert.equal(grid.length,18);
 const bounds=await page.evaluate(()=>{
  const rect=id=>document.getElementById(id).getBoundingClientRect().toJSON();
  return {chest:rect('poiChestPanel'),bag:rect('poiBagPanel'),stage:rect('viewWrap'),close:rect('poiChestClose'),width:innerWidth,height:innerHeight};
 });
 assert.ok(bounds.chest.top>=Math.max(0,bounds.stage.top)-1&&bounds.chest.bottom<bounds.bag.top,
  'chest fully inside game viewport above bag: '+JSON.stringify(bounds));
 assert.ok(bounds.chest.left>=-1&&bounds.chest.right<=bounds.width+1&&bounds.bag.bottom<=Math.min(bounds.stage.bottom,bounds.height)+1,
  'both panels fit horizontally and vertically: '+JSON.stringify(bounds));
 assert.equal(new Set(grid.map(c=>c[0].toFixed(1))).size,9);
 assert.equal(new Set(grid.map(c=>c[1].toFixed(1))).size,2);
 assert.ok(grid.every(c=>c[2]>=22&&c[3]>=22&&Math.abs(c[2]-c[3])<=2&&!c[4]&&c[5]),'18 visible and enabled near-square chest cells: '+JSON.stringify(grid));
}
async function closeChest(page){
 await page.locator('#poiChestClose').tap();
 await page.locator(selector).waitFor({state:'hidden'});
}
async function reload(page){
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
}
const detail='#poiItemDetail';
const detailAction=k=>detail+' [data-item-detail-action="'+k+'"]';
async function single(page,slot,name){
 await page.locator(slot).tap();
 await page.locator(detail).waitFor({state:'visible'});
 assert.equal((await page.locator('#poiItemDetailName').innerText()).trim(),name);
 assert.ok((await page.locator('#poiItemDetailDescription').innerText()).trim().length>=5,'item detail has its own readable description');
 const fit=await page.locator(detail).evaluate(el=>{
  const r=el.getBoundingClientRect();
  return el.open&&r.width>=180&&r.x>=0&&r.right<=innerWidth+1&&r.y>=0&&r.bottom<=innerHeight+1;
 });
 assert.ok(fit,'visible native detail fits entirely in the portrait viewport');
}
async function double(page,slot){
 const [x,y]=await center(page,slot);
 // Direct consecutive native touches, with no locator retries between them.
 await page.touchscreen.tap(x,y);await page.touchscreen.tap(x,y);
}
async function detailClosed(page){
 await page.locator(detail).waitFor({state:'hidden'});
}

const ghost='#poiItemDragPreview';
const preview='#poiItemDetailIcon';
async function artwork(page,selector){
 const canvas=page.locator(selector+' canvas').first();
 await canvas.waitFor({state:'attached'});
 return canvas.evaluate(c=>{
  const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
  let silhouette=2166136261,opaque=2166136261,pixels=0;
  // Exact silhouette and fully opaque artwork; compositing engines may round
  // the RGB components of translucent edge pixels differently on readback.
  for(let i=0;i<p.length;i+=4){
   const a=p[i+3];silhouette=Math.imul(silhouette^(a>20?1:0),16777619);
   if(a>20)pixels++;
   if(a===255)for(let j=0;j<3;j++)opaque=Math.imul(opaque^p[i+j],16777619);
  }
  return {silhouette,opaque,pixels,width:c.width,height:c.height,model:c.dataset.itemModel};
 });
}
async function renderedGhost(page,position,icon,count){
 const g=page.locator(ghost);
 await g.waitFor({state:'visible'});
 const details=await g.evaluate((el,position)=>{
  const r=el.getBoundingClientRect(),css=getComputedStyle(el),[x,y]=position;
  return {near:Math.hypot(r.x+r.width/2-x,r.y+r.height/2-y),dx:r.x+r.width/2-x,dy:r.y+r.height/2-y,
   pointer:css.pointerEvents,hit:el.contains(document.elementFromPoint(x,y)),onScreen:r.x>=-1&&r.y>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};
 },position);
 assert.ok(details.near<65&&details.onScreen,'ghost follows touch within viewport: '+JSON.stringify(details));
 assert.equal(details.pointer,'none');
 assert.equal(details.hit,false,'ghost must not steal destination hit testing');
 const drawn=await artwork(page,ghost+' .hotbar-icon');
 assert.ok(drawn.pixels>10);
 assert.deepEqual(drawn,icon,'exact already-rendered source icon is copied, not new/blank artwork');
 if(count!==null)assert.match(await g.locator('.hotbar-count').innerText(),new RegExp('^'+count+'$'));
 return details;
}
async function exerciseDrag(ctx,page,{source,dest,count,cancel=false,photo=null}){
 const icon=await artwork(page,source+' .hotbar-icon');
 const before=await inv(page);
 const [x,y]=await center(page,source),[u,v]=typeof dest==='string'?await center(page,dest):dest;
 const native=await ctx.newCDPSession(page);
 try{
  const input=(type,x,y)=>native.send('Input.dispatchTouchEvent',{type,touchPoints:x===undefined?[]:[{x,y,id:1}]});
  await input('touchStart',x,y);
  assert.equal(await page.locator(ghost).isVisible(),false,'no ghost merely on pointer down');
  const mid=[Math.round((x+u)/2),Math.round((y+v)/2)];
  await input('touchMove',...mid);
  const first=await renderedGhost(page,mid,icon,count);
  await input('touchMove',u,v);
  const last=await renderedGhost(page,[u,v],icon,count);
  assert.ok(Math.hypot(last.dx-first.dx,last.dy-first.dy)<=28,'ghost tracks actual pointer motion, not source slot');
  assert.deepEqual(await inv(page),before,'in-flight preview does not move or persist the item');
  if(photo&&out)await page.screenshot({path:out+'/'+photo});
  await input(cancel?'touchCancel':'touchEnd');
  await page.locator(ghost).waitFor({state:'hidden'});
  if(cancel)assert.deepEqual(await inv(page),before,'canceled pointer does not move, drop, or duplicate an item');
 }finally{await native.detach();}
}
async function bagAndDetails(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{width:390,facing:1,kit:{...stock,potions:6}});
 try{
  const map=await readMap(page);
  assert.equal(await page.locator(ghost).isVisible(),false);
  await page.locator('#poiBagToggle').tap();
  await exerciseDrag(ctx,page,{source:hot(1),dest:bag(0),count:6,photo:'v164-hotbar-drag-390.png'});
  assert.deepEqual((await inv(page)).bag[0],{type:'healingHerb',count:6});
  assert.equal((await inv(page)).hotbar[1],null);
  const art=await artwork(page,bag(0)+' .hotbar-icon');
  await single(page,bag(0),'薬草');
  assert.equal(await page.locator(ghost).isVisible(),false,'short tap opens detail, never a drag ghost');
  assert.deepEqual(await artwork(page,preview),art,'detail renders exact inventory 3D item artwork');
  assert.equal((await page.locator(preview+' .hotbar-count').innerText()).trim(),'6','detail displays same stack count');
  const layout=await page.evaluate(()=>{
   const icon=document.querySelector('#poiItemDetailIcon').getBoundingClientRect();
   const heading=document.querySelector('#poiItemDetailName').getBoundingClientRect();
   return {w:icon.width,h:icon.height,left:icon.right<=heading.left+1};
  });
  assert.ok(layout.left&&layout.w>=40&&layout.w<=50&&Math.abs(layout.w-layout.h)<=1,'sized square artwork left of item heading');
  if(out)await page.screenshot({path:out+'/v164-detail-artwork-390.png'});
  await page.locator(detailAction('use')).tap();await detailClosed(page);
  const notice=page.locator('#poiMessageLog [data-kind="notice"]').filter({hasText:/^HPは満タンです。$/});
  await notice.waitFor({state:'visible'});
  assert.equal(await notice.count(),1,'full HP appears once in the announcement log');
  assert.equal((await inv(page)).bag[0].count,6,'full HP does not spend herbs');
  await exerciseDrag(ctx,page,{source:bag(0),dest:hot(5),count:6,cancel:true});
  assert.equal((await inv(page)).hotbar[5],null);
  const canvasPoint=await page.evaluate(()=>{
   const stage=document.querySelector('#viewWrap').getBoundingClientRect(),view=document.querySelector('#view');
   const forbidden=[...document.querySelectorAll('#poiHotbar,#poiBagPanel,#poiWalkPad,#poiMiniHud,#poiMessagePanel,.poiPartyCard')]
    .filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());
   for(let y=stage.top+120;y<stage.bottom-60;y+=20)
    for(let x=stage.left+stage.width*.40;x<stage.right-24;x+=17)
     if(document.elementFromPoint(x,y)===view&&!forbidden.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))return [x,y].map(Math.round);
   return null;
  });
  assert.ok(canvasPoint,'actual world-canvas destination outside overlays');
  await exerciseDrag(ctx,page,{source:bag(0),dest:canvasPoint,count:6});
  assert.equal((await inv(page)).bag[0].count,5);
  assert.ok((await inv(page)).drops.some(d=>d.type==='healingHerb'&&d.x===42&&d.z===43&&d.y===0),'world drop releases the preview and uses actual game target');
  if(await page.locator('#poiBagPanel').isVisible())await page.locator('#poiBagToggle').tap();
  await move(page,'e',true,true);
  assert.equal((await inv(page)).potions,6);
  assert.equal((await inv(page)).drops.length,0);
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function chestPreview(browser){
 const {ctx,page,errors}=await launch(browser,'base',spot,{width:320,height:568,level,facing,kit:stock});
 try{
  const map=await readMap(page);
  await setRoll(page,.85);await openChest(page);
  const art=await artwork(page,chest(0)+' .hotbar-icon');
  await single(page,chest(0),'包丁');
  assert.deepEqual(await artwork(page,preview),art);
  await page.locator(detailAction('back')).tap();await detailClosed(page);
  await exerciseDrag(ctx,page,{source:chest(0),dest:bag(2),count:null,photo:'v164-chest-drag-320.png'});
  assert.equal((await inv(page)).kitchenChest.slots[0],null);
  assert.deepEqual((await inv(page)).bag[2],knife);
  await exerciseDrag(ctx,page,{source:bag(2),dest:chest(1),count:null});
  assert.equal((await inv(page)).bag[2],null);
  assert.deepEqual((await inv(page)).kitchenChest.slots[1],knife);
  await closeChest(page);await reload(page);
  assert.deepEqual((await inv(page)).kitchenChest.slots[1],knife);
  assert.equal(await page.locator(ghost).isVisible(),false);
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await bagAndDetails(browser);await chestPreview(browser);
 console.log('PASS mobile Chromium: exact artwork and count follow true touch, no ghost on tap or cancel, correct transfers and no save loss');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
