const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa420:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontierren'),
  at:(x,z,facing)=>{poiTownDialogueClose();if(!workshopResumeRestorePosition({x,z,y:0,facing,cave:false}))throw Error('scene '+x+','+z);poiShopSync()},
  seed:()=>{if(!poiEconomyWrite({...poiHotbarRead(),gold:300,frontierClothesGift:true}))throw Error('seed');poiEconomyRefresh()},
  shop:()=>poiNpcTradeCatalog(poiTownNpcActors.find(a=>a.role.id===POI_FRONTIER_SHOP_ID),'buy').map(r=>[r.type,r.quantity]),
  stuff:()=>{const kit=poiHotbarRead(),slots=poiInventorySlots(kit),ren=poiTownNpcActors.find(a=>a.role.id==='frontierren');
   return {slots:slots.filter(Boolean),ren:poiTownNpcStatus(ren),worn:frontierLifeRecord(kit,ren.role.id).worn,player:poiArmorWorn(kit),
    speech:[...document.querySelectorAll('.frontierLifeLine,#poiTownSpeech')].map(el=>getComputedStyle(el).overflowWrap)};
  },
  meetRen:()=>{
   poiTownDialogueClose();poiWildClear();poiTownNpcNext=Infinity;
   const a=poiTownNpcActors.find(a=>a.role.id==='frontierren');
   Object.assign(a,{x:110,z:29,facing:2,activity:'visit',target:null,frontierCombat:null,actorLeg:null,moveAt:null,hitAt:null});
   if(!workshopResumeRestorePosition({x:110,z:30,y:0,facing:0,cave:false}))throw Error('trading spot');
   poiShopSync();
   return poiTownDialogueTarget(performance.now())?.role.id;
  },
  equip:()=>{
   const kit=poiHotbarRead(),i=poiInventorySlots(kit).findIndex(q=>q?.type==='armorLeatherLegs');
   if(i<0)throw Error('bought item missing');
   poiEconomyWrite({...poiInventoryEdited(kit,poiInventorySlots(kit).map((q,j)=>j===i?null:q)),worn:{...poiArmorWorn(kit),legs:'armorLeatherLegs'},wornDurability:{legs:19}});
   poiEconomyRefresh();
  },
  loot:()=>{
   poiTownDialogueClose();
   const id='frontiermiyamoto',npc=poiTownNpcActors.find(a=>a.role.id===id),n=performance.now();
   if(!workshopResumeRestorePosition({x:125,z:30,y:0,facing:1,cave:false}))throw Error('bridge');
   if(!poiHumanPartyRecruit(npc,n).ok)throw Error('recruit');
   poiPartyAdoptHuman('human:'+id,{...npc,x:126,z:30,actorLeg:null,moveAt:null},n);
   for(const a of poiTownNpcActors)a.frontierPickupAt=n+30000;
   const kit=poiHotbarRead();
   if(!poiEconomyWrite({...kit,drops:[...(kit.drops||[]),{x:128,z:30,y:0,frontierCave:false,type:'armorLeatherLegs',durability:23}]}))throw Error('drop');
  },
  lootStatus:()=>{const id='frontiermiyamoto',kit=poiHotbarRead();return {party:poiHumanPartySpec('human:'+id)?.gear.legs,wear:frontierLifeRecord(kit,id).worn?.legs,
   drop:kit.drops?.some(q=>q.x===128&&q.z===30&&q.type==='armorLeatherLegs')??false};},
  audit:()=>{
   const r=poiTownNpcActors.find(a=>a.role.id==='frontierren');
   poiItemDetailRenderWeaponStats('equipIronSpear');
   const shown=document.getElementById('poiItemDetailWeaponSpeed').textContent;
   const specs=['frontiersugimoto','frontiermiyamoto'].map(id=>{const a=poiTownNpcActors.find(a=>a.role.id===id);return [poiHumanPartyRecruit(a,performance.now(),true).ok,poiTownNpcAttackPower(a)]});
   return {shown,specs,ren:poiTownNpcAttackPower({...r,weapon:'equipWoodSpear'}),bare:poiTownNpcAttackPower({...r,weapon:null}),
    timers:['equipWoodSpear','equipIronSpear','equipIronSword','equipWoodSword','equipWoodBow'].map(t=>{const p=poiPlayerWeaponProfile(t);return [t,p.range,p.damage,p.ready,p.hit,p.shaftScale??null]})};
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});await p.waitForFunction(()=>window.__editorTest?.qa420?.ready(),null,{timeout:30000})};await ready();
 const get=()=>p.evaluate(()=>window.__editorTest.qa420.stuff());
 const at=(x,z,f)=>p.evaluate(q=>window.__editorTest.qa420.at(...q),[x,z,f]);
 const tap=id=>p.locator('[data-npc-action="'+id+'"]:visible').tap();
 const action=()=>p.locator('#poiWalkAction').tap();
 await p.evaluate(()=>window.__editorTest.qa420.seed());
 const audit=await p.evaluate(()=>window.__editorTest.qa420.audit());a.equal(audit.ren,24);a.equal(audit.bare,0);a.equal(audit.shown,'★★★☆☆☆☆☆☆☆');a.deepEqual(audit.specs,[[true,31],[true,29]]);console.log('combat audit',audit);
 await at(102,25,0);await action();await tap('buy');
 const entries=await p.evaluate(()=>window.__editorTest.qa420.shop());console.log('shop',entries);
 for(const t of ['armorLeatherShoes','armorLeatherTorso','armorLeatherLegs','armorBandana','equipWoodSword'])a.ok(entries.some(([k,q])=>k===t&&q===1));
 await tap('trade:armorLeatherLegs');await tap('confirm');
 a.ok((await get()).slots.some(x=>x.type==='armorLeatherLegs'));
 a.deepEqual((await p.evaluate(()=>window.__editorTest.qa420.shop())).find(([k])=>k==='armorLeatherLegs'),['armorLeatherLegs',0]);
 await p.evaluate(()=>window.__editorTest.qa420.equip());
 a.equal(await p.evaluate(()=>window.__editorTest.qa420.meetRen()),'frontierren');await action();await tap('request');await tap('sell');await tap('trade-sell:-13');await tap('confirm');
 const sold=await get();console.log('sold equipped trousers',sold.worn,sold.ren.gear);
 a.equal(sold.player.legs,null);a.equal(sold.ren.gear.legs,'armorLeatherLegs');a.equal(sold.worn.legs.durability,19);a.equal(sold.ren.equipmentCells[3].durability,19);
 a.ok(sold.ren.carried.some(x=>x.type==='starterTrousers'));
 await tap('back');await tap('buy');await tap('trade:wear:weapon');await tap('confirm');
 const bought=await get();a.equal(bought.ren.weapon,null);a.equal(bought.ren.attack,0);a.ok(bought.slots.some(x=>x.type==='equipWoodSpear'));
 await p.reload({waitUntil:'domcontentloaded'});await ready();const saved=await get();a.equal(saved.ren.weapon,null);a.equal(saved.worn.legs.durability,19);
 await p.evaluate(()=>window.__editorTest.qa420.loot());
 await p.waitForFunction(()=>window.__editorTest.qa420.lootStatus().party==='armorLeatherLegs',null,{timeout:15000,polling:350});
 const loot=await p.evaluate(()=>window.__editorTest.qa420.lootStatus());a.equal(loot.wear.durability,23);a.equal(loot.drop,false);
 a.deepEqual(errors,[]);console.log('PASS real shop, worn sell/purchase, persistent gear, and ally walks to loot then equips it');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
