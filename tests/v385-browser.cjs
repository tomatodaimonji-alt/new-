const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8'),marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 joinQA:{
  step:workshopResumeRestorePosition,
  hasChief:()=>poiTownNpcActors.some(a=>a.role.id==='frontierchief'),
  dialog:poiTownDialogueSnapshot,
  party:()=>poiPartyMembers(poiHotbarRead()).map(m=>m.id),
  sounds:()=>{const original=poiSound;window.qaSounds=[];poiSound=(...args)=>{window.qaSounds.push(args[0]);return original(...args)}},
  stop:()=>poiTownDialogueClose(),
  turn:()=>{poiWalkFacing=(poiWalkFacing+2)%4;poiTownDialogueUpdate(performance.now());poiShopSync()},
  tradePrep:()=>{
   workshopResumeRestorePosition({x:51,z:30,y:0,facing:1});
   const a=poiPartyActorById('human:frontierchief');
   Object.assign(a,{x:52,z:30,px:52,pz:30,fx:52,fz:30,next:performance.now()+6000,freeGoal:null});
   const kit=poiHotbarRead();return poiEconomyWrite({...kit,gold:25});
  },
  purse:()=>{const kit=poiHotbarRead();return {coin:kit.gold,herbs:kit.potions,chief:frontierVendorStock(kit,'frontierchief')}},
  sword:()=>{
   poiTownDialogueClose();workshopResumeRestorePosition({x:81,z:31,y:0,facing:1});
   const now=performance.now(),kit=poiHotbarRead(),result=poiInventoryAccept(kit,'equipWoodSword',1);
   if(!result.accepted||!poiEconomyWrite({...poiInventoryEdited(kit,result.slots),weapon:'equipWoodSword'}))return {error:'sword not armed'};
   const o={x:82,z:31,y:0,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);
   poiMonsterStates.set(o,s);
   const profile=poiPlayerWeaponProfile('equipWoodSword'),pre=poiPlayerProfilePose('equipWoodSword',profile.hit*.6),post=poiPlayerProfilePose('equipWoodSword',profile.hit*1.4);
   const hp=s.hp,armed=poiPlayerStartProfile('equipWoodSword',now);poiPlayerWeaponFrame(now+profile.hit-1);
   const early=s.hp;poiPlayerWeaponFrame(now+profile.hit);const contact=s.hp;
   return {armed,hp,early,contact,speed:poiItemDetailWeaponStats('equipWoodSword').speed,hit:profile.hit,ready:profile.ready,pre:pre.sweep,post:post.sweep};
  },

 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.joinQA[name](...args),[name,args]);
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(()=>window.__editorTest?.joinQA)};
 const button=p.locator('#poiWalkAction'),menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),confirm=()=>p.getByRole('button',{name:'仲間に迎える',exact:true});
 const meet=async at=>{a(await run('step',at));await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap()};
 const ask=async()=>{await menu('request').tap();await menu('recruit').tap();await confirm().waitFor({state:'visible'})};
 const roan={x:46,z:23,y:0,facing:3},mina={x:39,z:23,y:0,facing:3};
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();await p.waitForFunction(()=>window.__editorTest.joinQA.hasChief());
 await meet(roan);await p.getByRole('button',{name:'贈り物を受け取る',exact:true}).tap();
 await run('sounds');
 await meet(roan);await ask();
 const first=(await run('dialog')).text;a.match(first,/わし/);a.deepEqual(await run('party'),[]);a(await run('hasChief'));
 a.equal(await p.locator('#poiMessageLog [data-kind=recruit]').count(),0);
 await run('step',{x:51,z:30,y:0,facing:1});await p.waitForFunction(()=>window.__editorTest.joinQA.dialog()===null);
 a.deepEqual(await run('party'),[]);
 await meet(roan);await ask();await run('turn');
 await menu('join-confirm').waitFor({state:'visible'});await menu('join-confirm').tap();
 a.deepEqual(await run('party'),['human:frontierchief']);a(!(await run('hasChief')));
 a.equal(await p.locator('#poiMessageLog [data-kind=recruit]').last().textContent(),'ロアンが仲間になった。');
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x==='item-pickup').length),1);
 await meet(mina);await ask();a.notEqual((await run('dialog')).text,first);a.match((await run('dialog')).text,/店の外/);
 a.deepEqual(await run('party'),['human:frontierchief']);await confirm().tap();
 a.equal(await p.locator('#poiMessageLog [data-kind=recruit]').last().textContent(),'ミナが仲間になった。');
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x==='item-pickup').length),2);
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 a.deepEqual(await run('party'),['human:frontierchief','human:frontiershopkeeper']);
 a(await run('tradePrep'));await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
 await menu('request').tap();await menu('private-buy').tap();
 const trade=id=>p.locator('#poiNpcTradePanel [data-npc-action="'+id+'"]');
 const before=await run('purse');await trade('trade:healingHerb').tap();await trade('confirm').tap();
 const after=await run('purse');a.deepEqual([before.coin-after.coin,after.herbs-before.herbs,before.chief.healingHerb-after.chief.healingHerb],[9,1,1]);
 const cut=await run('sword');console.log(cut);
 a(cut.armed&&cut.hp===cut.early&&cut.contact<cut.early&&cut.pre>1&&cut.post<-.6,JSON.stringify(cut));
 a.deepEqual([cut.speed,cut.hit,cut.ready],[3,205,650]);
 a.deepEqual(errors,[]);console.log('PASS accepted recruitment despite turn, both confirmation routes, companion private trade and timed horizontal sword');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
