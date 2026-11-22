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
const weaponAnchor='function poiWeaponSound(kind,sound,now){';
assert.equal(html.split(weaponAnchor).length,2,'shared weapon foley dispatch');
const observed=html.replace(weaponAnchor,weaponAnchor+`
 if(sound===POI_WEAPON_SE.kitchenKnife)(window.__qaKnifeFoley??=[]).push({kind,at:now,running:poiAudioContext?.state==='running'});
`).replace(rollAnchor,`function poiOpenKitchenChest(rng=Math.random){
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
const knife={type:'kitchenKnife',count:1,durability:20},can={type:'cannedFood',count:1},herb={type:'healingHerb',count:3};
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
async function groundPoint(page){
 return page.evaluate(()=>{
  const wrap=document.querySelector('#viewWrap').getBoundingClientRect(),canvas=document.querySelector('#view');
  const controls=[...document.querySelectorAll('#poiHotbar,#poiBagPanel,#poiChestPanel,#poiWalkPad,#poiMiniHud,#poiMessagePanel,.poiPartyCard')]
   .filter(e=>!e.hidden).map(e=>e.getBoundingClientRect());
  for(let y=wrap.top+60;y<wrap.bottom-60;y+=20)
   for(let x=wrap.left+wrap.width*.38;x<wrap.right-24;x+=20)
    if(document.elementFromPoint(x,y)===canvas&&!controls.some(r=>x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom))return [Math.round(x),Math.round(y)];
  return null;
 });
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
async function stake(page,setup=spot,direction=facing){
 // A repeat session restores only checkpoint position; no inventory rewrite.
 await page.evaluate(({resumeKey,setup,direction,level})=>{
  const prior=JSON.parse(localStorage.getItem(resumeKey)||'null');
  localStorage.setItem(resumeKey,JSON.stringify({...prior,version:1,id:'base',route:'facility',play:true,townLayout:5,
   position:{...setup,y:level,facing:direction},view:{...prior?.view,level,top:false,third:false}}));
 },{resumeKey,setup,direction,level});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
}
async function dragToGround(ctx,page,source){
 const target=await groundPoint(page);assert.ok(target,'an unobstructed scene-canvas target exists outside both grids');
 await drag(ctx,page,source,target);
}
async function pickAdjacent(page,item){
 const before=(await state(page)).position;
 const direction=Object.entries(dirs).find(([,d])=>before.x+d[0]===item.x&&before.z+d[1]===item.z)?.[0];
 assert.ok(direction,'swipe landed on legal adjacent ground');
 await move(page,direction,true,true);
}
async function exercise(browser,success){
 const {ctx,page,errors}=await launch(browser,'base',success?{x:26,z:33}:spot,{kit:stock,level:success?0:level,facing,width:success?390:320,height:success?740:568});
 try{
  const map=await readMap(page);
  if(success){
   assert.doesNotMatch(await page.locator(action).innerText(),/宝箱/,'chest has no interact prompt from the floor above');
   await move(page,'w',true,true);
   await page.waitForFunction(()=>window.__editorTest.facility().position.level===-1);
   for(let i=0;i<3;i++)await move(page,'e');
   await move(page,'n');
   await page.keyboard.press('ArrowLeft'); // chest itself blocks stepping; this only turns toward it.
  }
  assert.deepEqual((await state(page)).position,{...spot,level});
  await setRoll(page,success ? .21 : .81);
  assert.equal((await storage(page))?.kitchenChest,undefined,'no treasure generated before actual interaction');
  await openChest(page);
  assert.equal(await rolls(page),1);
  const initial=await inv(page);
  assert.deepEqual(initial.kitchenChest.slots[0],knife);
  assert.deepEqual(initial.kitchenChest.slots[1],success?can:null);
  if(out&&success)await page.screenshot({path:out+'/v162-kitchen-chest-390.png'});
  await setRoll(page,success ? .85 : .1);
  await closeChest(page);await reload(page);
  if(success)await page.keyboard.press('ArrowLeft');
  await openChest(page);
  assert.equal(await rolls(page),0,'no reroll on reopen or refresh even if random value changed');
  assert.deepEqual((await inv(page)).kitchenChest,initial.kitchenChest);
  if(success){
   await drag(ctx,page,chest(0),bag(0));
   assert.deepEqual((await inv(page)).bag[0],knife);
   assert.equal((await inv(page)).kitchenChest.slots[0],null);
   await drag(ctx,page,chest(1),hot(1));
   const swapped=await inv(page);
   assert.deepEqual(swapped.hotbar[1],can,'real cross-grid occupied drop swaps');
   assert.deepEqual(swapped.kitchenChest.slots[1],herb);
   await drag(ctx,page,bag(0),chest(0));
   assert.deepEqual((await inv(page)).kitchenChest.slots[0],knife);
   await dragToGround(ctx,page,chest(0));
   const dropp=(await inv(page)).drops.find(d=>d.type==='kitchenKnife');
   assert.ok(dropp&&dropp.y===level,'chest external swipe drops knife on a legal same-floor tile');
   assert.equal((await inv(page)).kitchenChest.slots[0],null);
   await closeChest(page);
   await pickAdjacent(page,dropp);
   assert.ok((await inv(page)).hotbar.some(i=>i?.type==='kitchenKnife'),'walking onto the actual ground item restores one knife');
   assert.ok(!(await inv(page)).drops.some(d=>d.type==='kitchenKnife'));
   const knifeSlot=(await inv(page)).hotbar.findIndex(i=>i?.type==='kitchenKnife');
   await page.locator(hot(knifeSlot)).tap();
   assert.equal((await inv(page)).weapon,'kitchenKnife','real recovered knife equips from hotbar');
   await page.locator(action).tap();
   const foley=await page.evaluate(()=>window.__qaKnifeFoley||[]);
   assert.equal(foley.length,1,'knife swing routes to its own shared weapon Foley once');
   assert.deepEqual([foley[0].kind,foley[0].running],['attack',true]);
   assert.equal((await inv(page)).hotbar[knifeSlot].durability,20,'swinging without actual contact does not spend durability');
   await page.evaluate(()=>window.__editorTest.testWound(60));
   await page.locator(hot(1)).tap();
   const hp=(await state(page)).combat.playerHP;
   assert.ok(hp>70&&hp<=100,'canned food heals more than one herb from same wound');
   assert.equal((await inv(page)).hotbar[1],null);
   await stake(page);await openChest(page);
   assert.equal(await rolls(page),0,'moving away/returning never duplicates loot');
   assert.equal((await inv(page)).kitchenChest.slots[0],null);
   assert.deepEqual((await inv(page)).kitchenChest.slots[1],herb);
   await drag(ctx,page,chest(1),bag(0));
   await dragToGround(ctx,page,bag(0));
   const herbDrop=(await inv(page)).drops.find(d=>d.type==='healingHerb');
   assert.ok(herbDrop&&herbDrop.y===level,'bag also supports a valid outside swipe while chest stays open');
   assert.deepEqual((await inv(page)).bag[0],{...herb,count:2},'outside swipe spends only one member of the stack');
   await closeChest(page);await pickAdjacent(page,herbDrop);
  }else{
   await closeChest(page);
   await page.locator('#enterGameWorld').tap();
   await page.locator('#poiResetGameConfirm').tap();
   await page.waitForFunction(()=>window.__editorTest?.facility?.().active&&window.__editorTest.facility().position.level===0);
   assert.equal((await storage(page))?.kitchenChest,undefined,'confirmed reset clears chest progression only');
   await stake(page);
   await setRoll(page,.18);
   await openChest(page);
   assert.equal(await rolls(page),1,'fresh playthrough can roll guaranteed knife and optional food again');
   assert.deepEqual((await inv(page)).kitchenChest.slots.slice(0,2),[knife,can]);
  }
  assert.deepEqual(await readMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,true);await exercise(browser,false);
 console.log('PASS 320/390 Chromium: actual kitchen chest, live touch swaps/ground loot, persistent first roll, stronger canned healing, protected saves after reset');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
