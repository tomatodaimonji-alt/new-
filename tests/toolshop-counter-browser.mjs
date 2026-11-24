import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.TOOLSHOP_SYNTAX_ONLY){console.log('exact game scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Tool shop QA</title>':html)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const origin='http://127.0.0.1:'+server.address().port;
let browser,checkpoint='boot';
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const openCounter of [true,false]){
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.75});
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(16000);
  await page.goto(origin+'/seed');
  await page.evaluate(openCounter=>{
   const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:77};slots[1]={type:'healingHerb',count:1};
   localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:1,gold:12,slots,
    toolshopSupply:{version:1,stock:5,delivered:1,cargo:0}}));
   localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:12*60*500}));
   localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:openCounter?{x:69,z:35,y:0,facing:1}:{x:71,z:36,y:0,facing:0},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },openCounter);
  await page.goto(origin+'/?resume=1&test=1');
  await page.locator('#pineStartupCover').waitFor({state:'hidden'});
  await page.waitForFunction(()=>window.__editorTest?.townResidents()?.actors.some(x=>x.id==='toolkeeper'&&x.activity==='work'&&x.x===71&&x.z===35&&x.y===0));
  const state=()=>page.evaluate(()=>window.__editorTest.townResidents().dialogue);
  const kit=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
  const menu=page.locator('#poiNpcMenu'),trade=page.locator('#poiNpcTradePanel'),act=page.locator('#poiWalkAction');
  const choose=(r,id)=>r.locator('[data-npc-action="'+id+'"]').first().tap();
  const labels=()=>menu.locator('button').allTextContents();
  await act.tap();await menu.waitFor({state:'visible'});
  assert.equal((await state()).id,'toolkeeper');
  if(openCounter){
   checkpoint='customer buy/cancel/sell';
   assert.deepEqual(await labels(),['買う','売る','戻る']);
   await choose(menu,'shop');const offer=menu.locator('[data-npc-action="trade:shop-herb"]');
   assert.match(await offer.innerText(),/薬草\s*6\s*G.*[（(]5[）)]/);
   await offer.tap();await choose(menu,'back');assert.equal((await kit()).gold,12,'cancel must not transact');
   await offer.tap();await choose(menu,'confirm');
   const bought=await kit();assert.equal(bought.gold,6);assert.equal(bought.toolshopSupply.stock,4);
   await choose(menu,'back');assert.deepEqual(await labels(),['買う','売る','戻る']);
   await choose(menu,'sell');await trade.waitFor({state:'visible'});
   assert.equal(await trade.locator('[data-npc-action="trade-sell:0"]').count(),0,'equipped sword still ineligible');
   await choose(trade,'trade-sell:1');
   assert.equal(await trade.locator('#poiNpcTradeDetail').getAttribute('data-price'),'3');
   await choose(trade,'confirm');const sold=await kit();
   assert.equal(sold.gold,9);assert.equal(sold.toolshopSupply.stock,4,'private sale does not credit official resupply');
   assert.equal(sold.slots[0].durability,77);
   await choose(trade,'back');assert.deepEqual(await labels(),['買う','売る','戻る']);
  }else{
   checkpoint='side conversation';
   assert.deepEqual(await labels(),['話す','状態','依頼','戻る']);
   await choose(menu,'request');assert.deepEqual(await labels(),['仲間になってほしい','戻る']);
   await choose(menu,'back');
  }
  await choose(menu,'back');await menu.waitFor({state:'hidden'});
  assert.equal(await state(),null);assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('customer-side retail and normal side conversation verified with real touch; exact old official price/stock and sale restrictions');
}catch(e){console.error('Tool shop failed at:',checkpoint);throw e}
finally{await browser?.close();server.close()}
