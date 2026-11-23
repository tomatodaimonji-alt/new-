import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url==='/seed'?'<!doctype html>Seed':html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
const page=await ctx.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base='http://127.0.0.1:'+server.address().port;
const save='world-workshop-hotbar-v1',resume='world-workshop-resume-v1';
const read=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),save);
const detail='#poiItemDetail';
const shortcut=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const state=()=>page.evaluate(()=>window.__editorTest.facility());
const active=()=>page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
async function hold(target){
 const b=await page.locator(target).boundingBox();assert.ok(b?.width&&b.height);
 const point={x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2),id:15};
 const cdp=await ctx.newCDPSession(page);
 try{
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  await page.locator(detail).waitFor({state:'visible'});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await cdp.detach()}
}
const wallet='#poiBagWallet';
async function center(selector){
 const box=await page.locator(selector).boundingBox();assert(box?.width&&box.height,selector+' must be visible');
 return {x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2)};
}
async function bareCanvas(from){
 const point=await page.evaluate(from=>{
  const stage=document.querySelector('#viewWrap').getBoundingClientRect(),canvas=document.querySelector('#view');
  const zones=['#poiBagPanel','#poiHotbar','#poiChestPanel','#poiMiniHud','#poiLocationPanel','#poiMessagePanel','#poiNpcMenu','#poiPartyHud .poiPartyCard'];
  const protectedRects=zones.map(s=>document.querySelector(s)).filter(e=>e&&!e.hidden).map(e=>e.getBoundingClientRect());
  const inside=(r,x,y)=>x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;
  for(let y=Math.round(stage.top)+16;y<stage.bottom-16;y+=14)for(let x=Math.round(stage.left)+16;x<stage.right-16;x+=14){
   if(Math.hypot(x-from.x,y-from.y)<74||x<56||x>innerWidth-56||
      protectedRects.some(r=>inside(r,x,y))||document.elementFromPoint(x,y)!==canvas)continue;
   return {x,y};
  }
  return null;
 },from);
 assert(point,'real uncovered game canvas is available outside the inventory');
 return point;
}
async function swipe(selector,destination=null){
 const from=await center(selector),to=destination?await center(destination):await bareCanvas(from);
 const t=(x,y)=>({x:Math.round(x),y:Math.round(y),id:4,force:.7,radiusX:3,radiusY:3});
 const cdp=await ctx.newCDPSession(page);
 try{
  const send=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  await send('touchStart',[t(from.x,from.y)]);
  for(const f of [.22,.58,1])await send('touchMove',[t(from.x+(to.x-from.x)*f,from.y+(to.y-from.y)*f)]);
  await send('touchEnd',[]);
 }finally{await cdp.detach()}
}
const splitButton=detail+' [data-item-detail-action="split"]';
const detailBack=detail+' [data-item-detail-action="back"]';
const cellFor=slot=>slot<9?shortcut(slot):'#poiBagSlots [data-bag-slot="'+(slot-9)+'"]';
async function goldDetails(selector,count){
 await page.locator(selector).tap();
 await page.locator(detail).waitFor({state:'visible'});
 assert.match(await page.locator('#poiItemDetailName').innerText(),/金貨/);
 assert.match(await page.locator('#poiItemDetailDescription').innerText(),new RegExp(count+'G'));
}
try{
 await page.goto(base+'/seed');
 await page.evaluate(({save,resume})=>{
  const slots=Array(27).fill(null);
  slots[0]={type:'equipWoodSword',count:1,durability:13};slots[1]={type:'healingHerb',count:2};
  localStorage.setItem(save,JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:null,potions:2,gold:21,slots,goldHotbarSlot:8}));
  localStorage.setItem(resume,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:41,z:43,y:0,facing:1},townLayout:5,view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false}}));
 },{save,resume});
 await page.goto(base+'/?resume=1&test=1');await active();
 const sword=await read();
 await page.locator(shortcut(0)).tap();
 assert.equal((await read()).weapon,'equipWoodSword','regular tap still equips');
 await hold(shortcut(0));
 const held=await read();
 assert.ok(!held.drops?.length,'touch hold never drops by itself');
 await page.locator(detail+' [data-item-detail-action="back"]').tap();
 await page.locator('#poiBagToggle').tap();
 assert.equal(await page.locator('#poiBagGoldDrop,#poiGoldDropDialog').count(),0,'old button and amount picker are gone');
 await swipe(shortcut(8),wallet);
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).goldHotbarSlot==null,save);
 const walletHeld=await read();
 assert.equal(walletHeld.gold,held.gold,'internal swipe moves the wallet, not its money');
 assert(!walletHeld.groundGold?.length);
 await goldDetails(wallet,21);
 assert.deepEqual(await read(),walletHeld,'tapping only opens Details');
 await page.locator(splitButton).tap();
 assert.equal(await page.locator(detail+' [data-item-detail-action="drop"]').isVisible(),false,'coin details provide Split, not a second drop action');
 const firstSplit=await read();assert.equal(firstSplit.gold,21);
 assert.equal(firstSplit.goldStacks.length,1);assert.equal(firstSplit.goldStacks[0].amount,10);
 assert.match(await page.locator('#poiItemDetailDescription').innerText(),/11G/);
 await page.locator(detailBack).tap();
 const firstCell=cellFor(firstSplit.goldStacks[0].slot);
 await swipe(firstCell,shortcut(8));
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).goldStacks?.[0]?.slot===8,save);
 await goldDetails(shortcut(8),10);
 await page.locator(detailBack).tap();
 await swipe(shortcut(8));
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).groundGold?.[0]?.amount===10,save);
 assert.equal((await read()).gold,11);
 assert(!((await read()).goldStacks?.length),'only selected split stack moved to ground');
 assert.equal(await page.locator(detail).isVisible(),false,'swiping never opens a picker or Details');
 await goldDetails(wallet,11);
 await page.locator(splitButton).tap();
 await page.locator(detailBack).tap();
 await swipe(wallet);
 await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k)).groundGold?.[1]?.amount===6,save);
 const coin=await read();
 assert.equal(coin.gold,5);assert.equal(coin.goldStacks[0].amount,5);
 assert.deepEqual(coin.slots,held.slots);assert.equal(coin.groundGold.length,2);
 assert.deepEqual(coin.groundGold.map(p=>p.amount),[10,6]);
 const near=(p)=>Math.abs(p.x-41)+Math.abs(p.z-43);
 assert.ok(coin.groundGold.every(p=>near(p)>0&&near(p)<=4&&p.y===0));
 assert.notDeepEqual([coin.groundGold[0].x,coin.groundGold[0].z],[coin.groundGold[1].x,coin.groundGold[1].z]);
 await page.locator('#poiBagClose').tap();
 await page.locator(shortcut(0)).focus();await page.keyboard.press('Shift+F10');
 await page.locator(detail+' [data-item-detail-action="drop"]').tap();
 const after=await read(),ground=after.drops.find(d=>d.type==='equipWoodSword');
 assert.equal(ground.durability,sword.slots[0].durability);assert.equal(after.weapon,null);
 assert.equal(after.sword,false,'compact save retains explicit no-sword marker');
 assert.notEqual(after.slots?.[0]?.type,'equipWoodSword');
 assert.ok(coin.groundGold.every(p=>p.x!==ground.x||p.z!==ground.z),'items and gold occupy distinct cells');
 for(let i=0;i<2;i++){
  await page.locator(shortcut(1)).focus();await page.keyboard.press('Shift+F10');
  await page.locator(detail+' [data-item-detail-action="drop"]').tap();
 }
 const ordinary=(await read()).drops.filter(p=>p.type==='healingHerb');
 assert.equal(ordinary.length,2,'even the same item stack uses two separately placed pickups');
 assert.equal(new Set([...coin.groundGold,ground,...ordinary].map(({x,z,y})=>x+','+z+','+y)).size,5);
 await page.reload();await active();
 assert.deepEqual((await read()).groundGold,coin.groundGold);
 assert.deepEqual((await read()).goldStacks,coin.goldStacks);
 assert.equal((await read()).drops.find(d=>d.type==='equipWoodSword').durability,ground.durability);
 const first=coin.groundGold[0],start=(await state()).position;
 assert.equal(Math.abs(start.x-first.x)+Math.abs(start.z-first.z),1,'known dry field has nearby free space');
 const arrow=first.x>start.x?'ArrowRight':first.x<start.x?'ArrowLeft':first.z>start.z?'ArrowDown':'ArrowUp';
 await page.keyboard.press(arrow);
 await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z},first);
 const recovered=await read();
 assert.equal(recovered.gold,15);assert.deepEqual(recovered.goldStacks,coin.goldStacks);
 assert.deepEqual(recovered.groundGold,[coin.groundGold[1]]);
 assert.deepEqual(errors,[]);
 console.log('PASS real coin Details and split, selected stack swipes including hotbar, durable weapon, persisted independent piles');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}

