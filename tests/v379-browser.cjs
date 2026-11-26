const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 lifeQA:{
  stepTo:workshopResumeRestorePosition,
  step:(dx,dz)=>poiWalkStep(dx,dz),
  pose:()=>[poiWalkX,poiWalkZ],
  available:()=>poiTownNpcActors.length,
  gifts:()=>poiInventorySlots(poiHotbarRead()).filter(Boolean).map(c=>c.type),
  actor:id=>{const a=poiTownNpcActors.find(o=>o.role.id===id);return {x:a.x,z:a.z,y:a.y}},

  life:()=>{
   const now=performance.now(),clock={hour:12},actor=poiTownNpcActors.find(o=>o.role.id==='frontierren'),sera=poiTownNpcActors.find(o=>o.role.id==='frontiersera');
   const start=actor.role.public,bed=actor.role.bed,stands=[actor.role.home,sera.role.home],beds=[bed,sera.role.bed];
   const long=poiTownFindPath(start,actor.role.home);
   const house=facilitySite.buildings.find(b=>b.id==='frontierCoupleHome').name;
   const obj={x:actor.x+1,z:actor.z,y:0,type:'monsterSlime',rot:0};
   const s=poiCombatActorMake(obj);Object.assign(s,{hp:1,wildSpawn:true,nextAttack:0});
   poiMonsterStates.set(obj,s);
   const before=frontierVendorStock(poiHotbarRead(),actor.role.id).gold;
   frontierNpcLifeStep(actor,clock,now,{plans:2});
   const armed=actor.frontierStrike?.weapon;
   if(actor.frontierStrike)frontierNpcStrike(actor,actor.frontierStrike.hit+1);
   const after=frontierVendorStock(poiHotbarRead(),actor.role.id).gold;
   poiMonsterStates.delete(obj);
   const damaged=frontierLifeSetHp(actor,35);const used=frontierNpcHeal(actor,now+1000);
   const healed=actor.hp,healSpeech=frontierLifeSpeech.get(actor.role.id)?.text;
   let k=poiHotbarRead(),stock=frontierVendorStock(k,actor.role.id);
   poiEconomyWrite(frontierLifeStock(k,actor.role.id,{...stock,gold:30,healingHerb:0}));
   Object.assign(actor,{x:38,z:25,y:0,fromX:38,fromZ:25,actorLeg:null,frontierCombat:null});
   const bought=frontierNpcBuyHerb(actor,now+1600);
   const purchase=frontierVendorStock(poiHotbarRead(),actor.role.id);
   Object.assign(actor,{...actor.role.home,fromX:actor.role.home.x,fromZ:actor.role.home.z,moveAt:null,actorLeg:null,frontierTradeAt:0});
   frontierLifeSetHp(actor,60);
   frontierNpcLifeStep(actor,{hour:23},now+2000,{plans:2});
   const rest={hp:actor.hp,activity:actor.activity};
   const cloth={type:'cannedFood',x:actor.x,z:actor.z,y:0,count:1};
   k=poiHotbarRead();poiEconomyWrite({...k,drops:[...(k.drops||[]),cloth]});
   const picked=frontierNpcCollect(actor,now+2100);
   return {house,stands,beds,realBeds:beds.every(poiTownNpcExistsBed),bridged:long?.some(t=>facilitySite.decks.has(t.x+','+t.z)),
    armed,before,after,enemy:s.hp,damaged,used,healed,healSpeech,bought,purchase,rest,picked};
  },
  clerk:()=>{const a=poiTownNpcActors.find(n=>n.role.id===POI_FRONTIER_SHOP_ID);return {x:a.x,z:a.z,y:a.y,here:poiTownDialogueTarget(performance.now())?.role.id}},
  party:()=>poiPartyMembers(poiHotbarRead()).map(m=>m.id),
  allyHeal:()=>{
   const id='human:frontiershopkeeper',key='frontiershopkeeper',kit=poiHotbarRead(),party=poiHumanPartyDecode(kit.humanParty),member=party.find(m=>m.id===id);
   if(!member)return null;
   member.hp=32;let stock=frontierVendorStock(kit,key);poiEconomyWrite(frontierLifeStock({...kit,humanParty:party},key,{...stock,healingHerb:1}));
   const actor=poiPartyActors().find(a=>a.id===id);
   frontierHumanCompanionHeal(actor,performance.now());
   return {hp:poiPartyMembers(poiHotbarRead()).find(m=>m.id===id).hp,herbs:frontierVendorStock(poiHotbarRead(),key).healingHerb,line:frontierLifeSpeech.get(key)?.text};
  },
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);
 p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.lifeQA[name](...args),[name,args]);
 const ready=async(n)=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(n=>window.__editorTest?.lifeQA.available()===n,n)};
 const menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),button=p.locator('#poiWalkAction');
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready(4);
 const meet=async(id,side=1)=>{
  const at=await run('actor',id);
  a(await run('stepTo',{x:at.x+side,z:at.z,y:0,facing:side===1?3:1}));
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');
  await button.tap();await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='決定');
 };
 await meet('frontierchief');a.deepEqual(await run('gifts'),[]);
 await run('stepTo',{x:51,z:30,y:0,facing:1});
 await p.waitForFunction(()=>window.__editorTest.lifeQA.clerk().here!=='frontierchief'&&document.getElementById('poiWalkAction').textContent!=='決定');
 a.deepEqual(await run('gifts'),[]);await meet('frontierchief');await button.tap();
 a.deepEqual(await run('gifts'),['equipStick']);a.match(await p.locator('#poiMessageLog [data-kind=gift]').last().textContent(),/木の棒を手に入れた/);
 await meet('frontiersera');a.deepEqual(await run('gifts'),['equipStick']);await button.tap();
 a.deepEqual(await run('gifts'),['equipStick','starterTunic','starterTrousers','armorLeatherShoes']);
 const life=await run('life');console.log(life);
 a.equal(life.house,'セラとレンの家');a(life.realBeds&&life.bridged);a.equal(life.armed,'equipWoodSpear');a.equal(life.enemy,0);a.equal(life.after-life.before,3);
 a(life.damaged&&life.used&&life.picked);a.equal(life.healed,65);a.match(life.healSpeech,/薬草/);
 a(life.bought);a.deepEqual([life.purchase.gold,life.purchase.healingHerb],[21,1]);a.equal(life.rest.activity,'sleep-home');a.equal(life.rest.hp,72);
 a(await run('stepTo',{x:38,z:25,y:0,facing:0}));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
 a.equal(await menu('buy').count(),1);await menu('back').tap();
 a(await run('stepTo',{x:39,z:25,y:0,facing:0}));a(await run('step',0,-1));
 await p.waitForTimeout(400);a(await run('step',0,-1));
 await p.waitForTimeout(450);a.deepEqual(await run('pose'),[39,23]);
 a(await run('stepTo',{x:39,z:23,y:0,facing:3}));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
 a.equal(await menu('status').count(),1);a.equal(await menu('buy').count(),0);
 await menu('request').tap();await menu('recruit').tap();a.deepEqual(await run('party'),['human:frontiershopkeeper']);
 const partyHeal=await run('allyHeal');a.deepEqual([partyHeal.hp,partyHeal.herbs],[62,0]);a.match(partyHeal.line,/薬草/);
 await p.waitForFunction(()=>[...document.querySelectorAll('#frontierLifeSpeech .frontierLifeLine')].some(el=>!el.hidden&&/薬草/.test(el.textContent)));
 await p.reload({waitUntil:'domcontentloaded'});await ready(3);a.deepEqual(await run('party'),['human:frontiershopkeeper']);
 a.deepEqual(errors,[]);console.log('PASS Frontier residents fight, loot, buy and rest, ally speaks/heals, merchant access and recruitment');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
