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
async function inventory(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{kit:{...stock,potions:7},facing:1,width:390});
 try{
  const map=await readMap(page);
  await page.locator('#poiBagToggle').tap();
  await drag(ctx,page,hot(1),bag(0));
  const prior=await inv(page);
  assert.deepEqual(prior.bag[0],{type:'healingHerb',count:7});
  await single(page,bag(0),'薬草');
  assert.deepEqual(await inv(page),prior,'one tap opens details without spending or transferring item');
  if(out)await page.screenshot({path:out+'/v163-herb-detail-390.png'});
  await page.locator(detailAction('split')).tap();
  await page.locator(detail).waitFor({state:'visible'});
  let now=await inv(page);
  assert.deepEqual(now.bag.slice(0,2),[{type:'healingHerb',count:3},{type:'healingHerb',count:4}]);
  await page.locator(detailAction('split')).tap();
  await page.locator(detail).waitFor({state:'visible'});
  now=await inv(page);
  assert.deepEqual([now.bag[0].count,now.bag[1].count,now.bag[9].count],[1,4,2],
   'repeat without retapping acts on original stack and chooses adjacent free slot');
  assert.equal(now.potions,7);
  await page.locator(detailAction('back')).tap();await detailClosed(page);
  await page.evaluate(()=>window.__editorTest.testWound(55));
  await single(page,bag(1),'薬草');
  await page.locator(detailAction('use')).tap();await detailClosed(page);
  assert.equal((await state(page)).combat.playerHP,75,'uses the selected bag item directly');
  assert.equal((await inv(page)).bag[1].count,3);
  assert.equal((await inv(page)).bag[0].count,1,'different stacks are not consumed');
  await drag(ctx,page,hot(0),bag(3));
  await single(page,bag(3),'木の剣');
  const split=page.locator(detailAction('split'));
  assert.ok(!await split.isVisible()||!await split.isEnabled(),'single weapon cannot be split');
  await page.locator(detailAction('equip')).tap();await detailClosed(page);
  const equipped=await inv(page);
  assert.equal(equipped.weapon,'equipWoodSword');
  assert.equal(equipped.bag[3],null);
  assert.equal(equipped.hotbar[0].type,'equipWoodSword','bag equip moves the original whole item to the first empty shortcut');
  assert.equal(equipped.hotbar.filter(c=>c?.type==='equipWoodSword').length,1,'equipping never duplicates the physical sword');
  await reload(page);assert.deepEqual(await inv(page),equipped,'bag-selected equipment and stacks survive restart');
  await page.locator(hot(8)).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.weapon===null);
  assert.deepEqual((await inv(page)).bag,equipped.bag,'unequipping preserves bag contents');
  assert.equal((await inv(page)).hotbar[0].type,'equipWoodSword','unequipping preserves physical sword');
  await page.locator('#poiBagToggle').tap();
  await single(page,bag(9),'薬草');
  await page.locator(detailAction('drop')).tap();await detailClosed(page);
  const ground=(await inv(page)).drops.find(d=>d.type==='healingHerb'&&d.x===42&&d.z===43&&d.y===0);
  assert.ok(ground,'detail drop creates one actual adjacent world item');
  assert.equal((await inv(page)).bag[9].count,1,'drops just one of the selected stack');
  // Leave ordinary bag open state before moving, using its real toggle.
  if(await page.locator('#poiBagPanel').isVisible())await page.locator('#poiBagToggle').tap();
  await move(page,'e',true,true);
  assert.equal((await inv(page)).drops.length,0);
  assert.equal((await inv(page)).potions,6,'recover drop without duplicate or loss');
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function chestDetails(browser){
 const {ctx,page,errors}=await launch(browser,'base',spot,{kit:{...stock,potions:7},level,facing,width:320});
 try{
  const map=await readMap(page);
  await setRoll(page,.85);await openChest(page);
  await drag(ctx,page,hot(1),bag(0));
  assert.equal((await inv(page)).bag[0].count,7);
  await single(page,chest(0),'包丁');
  await page.locator(detailAction('back')).tap();await detailClosed(page);
  assert.deepEqual((await inv(page)).kitchenChest.slots[0],knife);
  await double(page,chest(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag.some(c=>c?.type==='kitchenKnife'));
  await page.waitForTimeout(330);
  let now=await inv(page);
  assert.equal(await page.locator(detail).isVisible(),false,'double tap does not also open a single tap detail');
  assert.deepEqual(now.bag[1],knife,'without changing the hotbar, always choose first empty bag slot');
  assert.equal(now.kitchenChest.slots[0],null);
  await single(page,bag(0),'薬草');
  await page.locator(detailAction('transfer')).tap();await detailClosed(page);
  now=await inv(page);
  assert.deepEqual(now.kitchenChest.slots[0],{type:'healingHerb',count:7});
  assert.equal(now.bag[0],null);
  assert.equal(now.hotbar[1],null,'storage transfer never routes through shortcut row');
  await double(page,chest(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.bag[0]?.count===7);
  await page.waitForTimeout(330);
  now=await inv(page);
  assert.equal(now.kitchenChest.slots[0],null);
  assert.equal(now.bag.filter(i=>i?.type==='healingHerb').length,1);
  assert.equal(now.potions,7);
  assert.equal(await page.locator(detail).isVisible(),false);
  await double(page,bag(0));
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.kitchenChest.slots[0]?.count===7);
  await page.waitForTimeout(330);
  assert.equal(await page.locator(detail).isVisible(),false,'bag double tap also stays distinct from detail');
  now=await inv(page);
  assert.equal(now.bag[0],null);
  assert.equal(now.kitchenChest.slots[0].count,7);
  await closeChest(page);await reload(page);
  assert.deepEqual(await inv(page),now);
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await inventory(browser);await chestDetails(browser);
 console.log('PASS 320/390 Chromium: item details, actual double-touch and separate single-touch, splitting, bag equip/use, exact transfer and saved items');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
