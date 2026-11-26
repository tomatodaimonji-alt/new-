const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 estateQA:{
  stepTo:workshopResumeRestorePosition,
  step:()=>poiWalkStep(1,0),
  actors:()=>poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z})),
  state:()=>{const k=poiHotbarRead();
   return {gold:k.gold||0,items:poiInventorySlots(k).filter(Boolean),fallen:k.frontierFallen||[],
    party:poiPartyMembers(k).map(x=>x.id),stock:frontierVendorStock(k,'frontiersera'),
    bag:k[frontierEstateKey('frontiersera')]||null}},
  seed:()=>poiEconomyWrite({...poiHotbarRead(),gold:20}),
  equip:part=>{const i=poiInventorySlots(poiHotbarRead()).findIndex(c=>c?.type===FRONTIER_FITTED_GEAR[part]);return poiMoveArmorSlot({zone:'bag',index:i-POI_HOTBAR_SIZE},{zone:'armor',part})},
  finish:()=>poiPartyWith('human:frontiersera',()=>{Object.assign(poiCompanionActor,{x:79,z:30,y:0});return poiCompanionHurt(1000,performance.now())}),
  stars:type=>{poiItemDetailRenderWeaponStats(type);const s=poiItemDetailWeaponStats(type);return {s,speed:$('poiItemDetailWeaponSpeed').textContent,reach:$('poiItemDetailWeaponReach').textContent,aria:$('poiItemDetailSpeedAnnounce').textContent}},
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errs=[];
 p.on('pageerror',e=>{errs.push(e.message);console.log(e.stack)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 p.setDefaultTimeout(10000);
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.estateQA[name](...args),[name,args]);
 const ready=async(n)=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(n=>window.__editorTest?.estateQA.actors().length===n,n)};
 const menu=(id)=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),trade=(id)=>p.locator('#poiNpcTradePanel [data-npc-action="'+id+'"]');
 const button=p.locator('#poiWalkAction'),state=()=>run('state');
 const greet=async()=>{
  const actor=(await run('actors')).find(q=>q.id==='frontiersera');a(actor);
  a(await run('stepTo',{x:actor.x+1,z:actor.z,y:0,facing:3}));
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
 };
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready(2);a(await run('seed'));
 const stars=await run('stars','equipWoodBow');a.equal(stars.speed.length,10);a.equal(stars.reach.length,10);a.match(stars.aria,/10段階中/);
 await greet();await menu('request').tap();
 await menu('buy').tap();await trade('trade:healingHerb').tap();await trade('confirm').tap();
 let k=await state();a.equal(k.gold,11);a.equal(k.stock.gold,21);a.equal(k.stock.healingHerb,1);a.equal(k.items.find(x=>x.type==='healingHerb').count,1);
 await trade('back').tap();await menu('sell').tap();
 await p.locator('#poiNpcTradePanel [data-npc-action^="trade-sell:"]').first().tap();await trade('confirm').tap();
 k=await state();a.equal(k.gold,14);a.equal(k.stock.gold,18);a.equal(k.stock.healingHerb,2);a(!k.party.length);
 await trade('back').tap();await menu('back').tap();await menu('back').tap();
 for(const part of ['torso','legs','feet'])a((await run('equip',part)).ok,part);
 await greet();await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='次へ');await button.tap();
 await menu('request').tap();await menu('recruit').tap();
 a.deepEqual((await state()).party,['human:frontiersera']);
 a(await run('stepTo',{x:78,z:30,y:0,facing:1}));
 a(await run('finish'));k=await state();a.deepEqual(k.fallen,['frontiersera']);a.equal(k.bag.gold,18);a.equal(k.bag.slots.filter(Boolean).length,6);
 await p.reload({waitUntil:'domcontentloaded'});await ready(1);
 k=await state();a.equal(k.bag.gold,18);a.deepEqual(k.party,[]);
 a(await run('stepTo',{x:k.bag.x-1,z:k.bag.z,y:0,facing:1}));a(await run('step'));
 await p.locator('#poiChestPanel').waitFor({state:'visible'});
 a.equal(await p.locator('#poiChestHeading').textContent(),'セラの遺品袋');
 a.match(await p.locator('#poiEstateGold').textContent(),/18G/);
 await p.locator('#poiEstateGold').tap();
 k=await state();a.equal(k.gold,32);a.equal(k.bag.gold,0);
 await p.locator('#poiChestTakeAll').tap();
 k=await state();a(!k.bag);a(k.items.some(x=>x.type==='equipWoodBow'));
 a(k.items.some(x=>x.type==='starterTunic'));a.equal(k.items.find(x=>x.type==='healingHerb').count,2);
 await p.locator('#poiChestPanel').waitFor({state:'hidden'});
 await p.reload({waitUntil:'domcontentloaded'});await ready(1);
 k=await state();a.equal(k.gold,32);a(!k.bag);a(k.items.some(x=>x.type==='equipWoodBow'));a.deepEqual(errs,[]);
 console.log('PASS two-way pre-recruitment trade, saved death & steps open estate, coins, take all and no reappearance, 10-star details');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
