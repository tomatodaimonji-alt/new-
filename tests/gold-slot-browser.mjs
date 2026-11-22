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
const bag=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const wallet='#poiBagWallet',panel='#poiBagPanel';
const shortcut=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const kitKey='world-workshop-hotbar-v1',read=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)||'null'),kitKey);
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const seedSlots=Array(27).fill(null);
seedSlots[0]={type:'equipWoodSword',count:1};
seedSlots[9+1]={type:'healingHerb',count:3};
seedSlots[9+6]={type:'cannedFood',count:2};
const initial={version:1,weapon:'equipWoodSword',gold:37,potions:3,slots:seedSlots};
async function frame(page){
 return page.evaluate(()=>{
  const query=s=>document.querySelector(s);
  const nodes=[...document.querySelectorAll('#poiBagGrid [data-bag-slot]')].filter(el=>Number(el.dataset.bagSlot)<9);
  return [...nodes,query('#poiBagWallet')].map(el=>{
   const r=el.getBoundingClientRect();
   return {id:el.id==='poiBagWallet'?9:Number(el.dataset.bagSlot),top:Math.round(r.top),left:Math.round(r.left)};
  }).sort((a,b)=>a.top-b.top||a.left-b.left).map(o=>o.id);
 });
}
async function center(page,target){
 const b=await page.locator(target).boundingBox();
 assert.ok(b?.width&&b.height,'real visible touch target '+target);
 return {x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2)};
}
async function drag(ctx,page,target,source=wallet){
 const a=await center(page,source),b=typeof target==='string'?await center(page,target):target;
 const c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...a,id:1}]});
  for(let i=1;i<=7;i++)await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[
   {x:Math.round(a.x+(b.x-a.x)*i/7),y:Math.round(a.y+(b.y-a.y)*i/7),id:1}
  ]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach()}
}
async function openBag(page){
 await page.locator('#poiBagToggle').tap();
 await page.locator(panel).waitFor({state:'visible'});
 assert.ok(await page.locator(wallet).isEnabled(),'wallet is a usable button');
}
async function verify(page,order){
 assert.deepEqual(await frame(page),order,'projected row/column order matches stable bag IDs');
 assert.equal((await state(page)).inventory.goldBagSlot,order.indexOf(9),'live inventory reports the same physical wallet slot');
 const save=await read(page);
 assert.equal(save.gold,initial.gold);
 assert.equal((await page.locator(wallet+' #poiGoldValue').innerText()).trim(),'37');
 assert.deepEqual(save.slots,seedSlots,'item and weapon indexes did not change');
 assert.equal(save.weapon,initial.weapon);
 assert.equal(save.potions,initial.potions);
 return save;
}
async function verifyHotbar(page,index){
 const inv=(await state(page)).inventory,k=await read(page);
 assert.equal(inv.goldHotbarSlot,index);
 assert.equal(inv.hotbar[index],null,'wallet is a reservation, not an ordinary carried item');
 assert.equal(k.gold,37);
 assert.equal(k.goldHotbarSlot,index);
 assert.deepEqual(k.slots,seedSlots);
 assert.equal(k.weapon,initial.weapon);
 assert.equal(k.potions,initial.potions);
 assert.equal(await page.locator(shortcut(index)+'[data-gold-shortcut]').count(),1);
 assert.equal(await page.locator('#poiHotbar [data-gold-shortcut]').count(),1,'wallet occupies only one shortcut');
 assert.equal(await page.locator(wallet+'[data-wallet-away]').count(),1,'bag position is a placeholder, not a second wallet');
 assert.match(await page.locator(shortcut(index)).innerText(),/37/,'coin count is shown in the genuine reserved shortcut');
 return k;
}
async function exercise(browser,width){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:39},{width,kit:initial});
 try{
  const mapBefore=await getMap(page);
  const defaultOrder=[0,1,2,3,4,5,6,7,8,9];
  await openBag(page);
  const start=await verify(page,defaultOrder);
  assert.deepEqual(start,initial,'loading the legacy default does not rewrite it');
  await page.locator(wallet).tap();
  assert.equal(await page.locator(wallet).getAttribute('aria-pressed'),'true','touch selects wallet');
  await page.locator(bag(2)).tap();
  const first=[0,1,9,3,4,5,6,7,8,2],one=await verify(page,first);
  assert.deepEqual(one.goldBagOrder,first);
  const second=[0,1,7,3,4,5,6,9,8,2];
  await drag(ctx,page,bag(7));
  const two=await verify(page,second);
  assert.deepEqual(two.goldBagOrder,second);
  for(const target of [bag(1),bag(9),shortcut(0),'[data-gear-slot="legs"]']){
   await drag(ctx,page,target);
   assert.deepEqual(await verify(page,second),two,'occupied, locked and gear targets cannot receive currency: '+target);
  }
  const stage=await page.locator('#view').boundingBox();
  assert(stage);const outside={x:Math.round(stage.x+stage.width*.67),y:Math.round(stage.y+stage.height*.31)};
  await drag(ctx,page,outside);
  assert.deepEqual(await verify(page,second),two,'outside drop does not move or spend gold');
  assert.equal((await state(page)).inventory.drops.length,0);
  const bank=shortcut(2);
  await page.locator(wallet).tap();
  await page.locator(bank).tap();
  await verifyHotbar(page,2);
  await page.locator('#poiBagClose').tap();
  await page.locator(panel).waitFor({state:'hidden'});
  const savedHot=await verifyHotbar(page,2);
  await page.locator(bank).tap();
  await page.waitForTimeout(360);
  assert.equal(await page.locator('#poiItemDetail[open]').count(),0,'gold shortcut never acts as a carried item');
  assert.deepEqual(await verifyHotbar(page,2),savedHot,'closed-bag wallet tap does not consume, equip, or relocate');
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await verifyHotbar(page,2),savedHot,'gold shortcut position survives a live reload');
  await openBag(page);
  await drag(ctx,page,bank,bag(1));
  assert.deepEqual(await verifyHotbar(page,2),savedHot,'wallet cannot be moved back over an occupied bag slot');
  await drag(ctx,page,bag(1),bank);
  assert.deepEqual(await verifyHotbar(page,2),savedHot,'regular items cannot occupy a wallet-reserved shortcut');
  await page.locator(bank).tap();await page.locator(bag(3)).tap();
  const afterReturn=await read(page);
  assert.equal((await state(page)).inventory.goldHotbarSlot,null);
  assert.equal((await state(page)).inventory.goldBagSlot,3);
  const returnOrder=await frame(page);
  assert.equal(returnOrder[3],9);
  assert.equal(returnOrder[1],1);assert.equal(returnOrder[6],6);
  assert.deepEqual(await verify(page,returnOrder),afterReturn);
  await drag(ctx,page,shortcut(4));
  await verifyHotbar(page,4);
  await drag(ctx,page,bag(0),shortcut(4));
  assert.equal((await state(page)).inventory.goldHotbarSlot,null);
  const finalOrder=await frame(page);
  const final=await verify(page,finalOrder);
  assert.equal(finalOrder[0],9);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await openBag(page);
  assert.deepEqual(await verify(page,finalOrder),final,'return to bag persists without reordering item indexes');
  if(out)await page.screenshot({path:out+'/v186-gold-slot-'+width+'.png'});
  assert.deepEqual(await getMap(page),mapBefore);
  await unchanged(page);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const width of [320,390])await exercise(browser,width);
 console.log('PASS mobile wallet tap/drag both ways, reserved shortcut guard, closed no-op, stable items/gold, and real reload persistence');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
