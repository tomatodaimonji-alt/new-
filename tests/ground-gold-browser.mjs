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
const dialog='#poiGoldDropDialog',detail='#poiItemDetail';
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
 await page.locator('#poiBagGoldDrop').tap();
 assert.equal(await page.locator('#poiGoldDropAmount').inputValue(),'1');
 await page.locator('#poiGoldDropAmount').fill('22');
 await page.locator(dialog+' [type="submit"]').tap();
 assert.ok(await page.locator('#poiGoldDropFeedback').textContent());
 assert.deepEqual(await read(),held,'out-of-range amount changes no save fields');
 await page.locator('#poiGoldDropCancel').tap();
 assert.deepEqual(await read(),held,'cancel changes no save fields');
 for(const amount of [3,4]){
  await page.locator('#poiBagGoldDrop').tap();await page.locator('#poiGoldDropAmount').fill(String(amount));
  await page.locator(dialog+' [type="submit"]').tap();await page.locator(dialog).waitFor({state:'hidden'});
 }
 const coin=await read();
 assert.equal(coin.gold,14);assert.equal(coin.goldHotbarSlot,8);
 assert.deepEqual(coin.slots,held.slots);assert.equal(coin.groundGold.length,2);
 assert.deepEqual(coin.groundGold.map(p=>p.amount),[3,4]);
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
 assert.equal((await read()).drops.find(d=>d.type==='equipWoodSword').durability,ground.durability);
 const first=coin.groundGold[0],start=(await state()).position;
 assert.equal(Math.abs(start.x-first.x)+Math.abs(start.z-first.z),1,'known dry field has nearby free space');
 const arrow=first.x>start.x?'ArrowRight':first.x<start.x?'ArrowLeft':first.z>start.z?'ArrowDown':'ArrowUp';
 await page.keyboard.press(arrow);
 await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z},first);
 const recovered=await read();
 assert.equal(recovered.gold,17);assert.equal(recovered.goldHotbarSlot,8);
 assert.deepEqual(recovered.groundGold,[coin.groundGold[1]]);
 assert.deepEqual(errors,[]);
 console.log('PASS physical touch hold and normal tap, keyboard detail/drop, amount cancellation/validation, separate piles, durable weapon and persisted collectible gold');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
