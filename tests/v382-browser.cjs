const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8'),marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 marketQA:{
  step:workshopResumeRestorePosition,
  loaded:()=>poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  state:()=>{const k=poiHotbarRead(),n=poiTownNpcActors.find(a=>a.role.id===POI_FRONTIER_SHOP_ID);
   return {k:{gold:k.gold,herbs:k.potions},n:frontierVendorStock(k,POI_FRONTIER_SHOP_ID),status:poiTownNpcStatus(n),
     buy:poiNpcTradeCatalog(n,'buy').filter(x=>x.quantity>0).map(x=>[x.code,x.quantity])}},
  seed:()=>poiEconomyWrite(frontierLifeEdit({...poiHotbarRead(),gold:110},POI_FRONTIER_SHOP_ID,{items:[{type:'equipStick',count:1,durability:19}]})),
  item:()=>poiInventorySlots(poiHotbarRead()).find(c=>c?.type==='equipStick'),
  selfHeal:()=>{const a=poiTownNpcActors.find(n=>n.role.id===POI_FRONTIER_SHOP_ID);a.hp=34;const ok=frontierNpcHeal(a,performance.now());a.hp=90;return ok},
  visit:()=>{const k=poiHotbarRead(),a=poiTownNpcActors.find(n=>n.role.id==='frontiersera');
   poiEconomyWrite(frontierLifeStock(k,a.role.id,{gold:30,healingHerb:0,cannedFood:0}));return frontierNpcBuyHerb(a,performance.now())},
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.marketQA[name](...args),[name,args]);
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(()=>window.__editorTest?.marketQA.loaded())};
 const button=p.locator('#poiWalkAction'),menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),trade=id=>p.locator('#poiNpcTradePanel [data-npc-action="'+id+'"]');
 const front={x:38,z:25,y:0,facing:0},side={x:39,z:23,y:0,facing:3};
 const meet=async at=>{a(await run('step',at));await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap()};
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();a(await run('seed'));
 await meet(front);let s=await run('state');a.equal(s.status.herbs,8);a.deepEqual(s.buy,[['healingHerb',8]]);
 await menu('buy').tap();await trade('trade:healingHerb').tap();await trade('confirm').tap();
 s=await run('state');a.deepEqual([s.k.herbs,s.n.healingHerb,s.status.herbs,s.n.gold],[1,7,7,21]);
 await trade('back').tap();await menu('back').tap();
 a(await run('selfHeal'));a(await run('visit'));s=await run('state');a.equal(s.status.herbs,5);
 await meet(side);await menu('request').tap();await menu('private-buy').tap();
 s=await run('state');a.deepEqual(s.buy,[['cannedFood',1],['equipStick',1]]);a.equal(await trade('trade:healingHerb').count(),0);
 await trade('trade:equipStick').tap();await trade('confirm').tap();a.equal((await run('item')).durability,19);
 await p.reload({waitUntil:'domcontentloaded'});await ready();s=await run('state');a.equal(s.n.healingHerb,5);a.equal((await run('item')).durability,19);
 a.deepEqual(errors,[]);console.log('PASS shared live stock counts after player trade, self-heal and resident purchase; off-counter reserved item retains durability on reload');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
