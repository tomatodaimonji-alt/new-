import a from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 tutorialQA:{
  stepTo:workshopResumeRestorePosition,
  dialog:poiTownDialogueSnapshot,
  actors:()=>poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z,y:n.y,job:poiTownNpcStatus(n).job})),
  kit:()=>{const k=poiHotbarRead();return {gear:poiArmorWorn(k),items:poiInventorySlots(k).filter(Boolean).map(c=>c.type),gift:k.frontierClothesGift??false,dead:k.frontierFallen||[],party:poiPartyMembers(k).map(m=>({id:m.id,job:m.job,hp:m.hp})),runtime:poiPartyActors().map(n=>n.id)}},
  equip:part=>{const k=poiHotbarRead(),i=poiInventorySlots(k).findIndex(c=>c?.type===FRONTIER_FITTED_GEAR[part]);return poiMoveArmorSlot({zone:'bag',index:i-POI_HOTBAR_SIZE},{zone:'armor',part})},
  finalHit:()=>poiPartyWith('human:frontiersera',()=>poiCompanionHurt(1000,performance.now())),
  practice:()=>{
   const now=performance.now(),entry=[...poiMonsterStates.entries()].find(([o,s])=>o.type==='monsterSlime'&&o.x===81&&s.hp>0);
   if(!entry)return {error:'no live slime'};
   const [o,s]=entry;
   workshopResumeRestorePosition({x:79,z:28,y:0,facing:1});
   return poiPartyWith('human:frontiersera',()=>{
    const f=poiCompanionActor;if(!f)return {error:'no actor'};
    Object.assign(f,{x:76,z:28,px:76,pz:28,nextHit:0,attackMotion:null,site:facilitySite});
    const hp=s.hp,started=poiCompanionCommit(f,{o,s},now);
    const motion=f.attackMotion;
    if(!started)return {error:'bow did not commit',hp,range:poiCompanionMeleeReach(f),dx:s.x-f.x,dz:s.z-f.z};
    poiCompanionResolve(f,motion.hit,'fight');
    if(!motion.arrow)return {error:'bow did not launch'};
    poiCompanionResolve(f,motion.arrow.end,'fight');
    return {hp,after:s.hp,flight:motion.arrow.end-motion.arrow.at};
   })
  },
  dirt:()=>({soil:frontierEarthTint(47.5,30.5),grass:frontierEarthTint(45.5,17.5)})
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];p.on('pageerror',e=>{console.log(e.stack);errors.push(e.message)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 const ready=async(n)=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(n=>window.__editorTest?.tutorialQA.actors().length===n,n)};
 await ready(2);
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.tutorialQA[name](...args),[name,args]);
 const button=p.locator('#poiWalkAction'),menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]');
 const speech=()=>run('dialog'),kit=()=>run('kit');
 const meet=async(id,name)=>{
  const actor=(await run('actors')).find(x=>x.id===id);
  a.equal(actor.job,'村人');
  const stand=id==='frontiersera'?{x:actor.x+1,z:actor.z,y:0,facing:3}:{x:actor.x-1,z:actor.z,y:0,facing:1};
  a(await run('stepTo',stand));
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');
  await button.tap();
  await menu('talk').waitFor({state:'visible'});
  a.equal((await speech()).text,'');
  a.equal(await p.locator('#poiMessageHeading').textContent(),name);
  a.equal(await p.locator('#poiMessageLog [data-kind=dialogue]:visible').count(),0);
 };
 const close=async()=>{await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='閉じる');await button.tap();a.equal(await speech(),null)};
 const dirt=await run('dirt');a(dirt.soil[0]<.455&&dirt.soil[0]>dirt.soil[1]);a(dirt.grass[1]<.48);
 a.deepEqual((await kit()).items,[]);
 await meet('frontiersera','セラ');await menu('talk').tap();a((await speech()).text.includes('裸'));await close();
 a.deepEqual((await kit()).items,['starterTunic','starterTrousers','armorLeatherShoes']);
 await p.reload({waitUntil:'domcontentloaded'});await ready(2);
 await meet('frontierren','レン');await menu('talk').tap();a((await speech()).text.includes('インベントリ'));a.equal((await kit()).items.length,3);await close();
 for(const part of ['torso','legs','feet'])a((await run('equip',part)).ok,part);
 for(const [id,name] of [['frontiersera','セラ'],['frontierren','レン']]){
  await meet(id,name);await menu('talk').tap();
  a((await speech()).text.includes('似合'));
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='次へ');
  await button.tap();a((await speech()).text.includes('依頼'));await close();
  a(!(await kit()).party.some(m=>m.id==='human:'+id),'offer does not auto-accept');
  await meet(id,name);await menu('request').tap();await menu('recruit').tap();
  a((await kit()).party.some(m=>m.id==='human:'+id&&m.job==='村人'));
 }
 const combat=await run('practice');console.log('Bow from five tiles',combat);a(combat.hp>combat.after&&combat.flight>0,JSON.stringify(combat));
 a(await run('finalHit'));a(!(await kit()).party.some(m=>m.id==='human:frontiersera'));
 await p.reload({waitUntil:'domcontentloaded'});await ready(0);
 const saved=await kit();a.deepEqual(saved.dead,['frontiersera']);a.equal(saved.party[0].id,'human:frontierren');a(saved.gift);
 a.deepEqual(errors,[]);console.log('Name only, one gift shared across reload, optional offer, both recruits, bow attack, saved permadeath.');
}finally{await b?.close();server.close()}
