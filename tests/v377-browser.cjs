const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 chiefQA:{
  stepTo:workshopResumeRestorePosition,
  actors:()=>poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z,y:n.y,status:poiTownNpcStatus(n)})),
  profile:()=>poiPlayerWeaponProfile('equipWalkingCane'),
  step:()=>poiWalkStep(1,0),
  weapon:()=>poiEquippedWeapon(),
  stickSlot:()=>poiInventorySlots(poiHotbarRead()).findIndex(c=>c?.type==='equipStick'),
  rangeQA:()=>{
   workshopResumeRestorePosition({x:78,z:28,y:0,facing:1});
   const now=performance.now(),[o,s]=[...poiMonsterStates].find(([o,s])=>o.x===81&&s.hp>0);
   const profile=poiPlayerWeaponProfile('equipWoodSpear'),p={x:78,z:28,y:0};
   const ray={aim:p,dx:1,dz:0,type:'equipWoodSpear',profile};
   const setup=x=>Object.assign(s,{x,z:28,fromX:x,fromZ:28,moveStarted:-10000,px:x,pz:28,nextAttack:now+10000});
   setup(82);
   const atLimit=poiAimTrace(ray,profile.range,now);
   const r={id:'human:frontierren',x:78,z:28,px:78,pz:28,y:0,nextHit:0,site:facilitySite};
   const hit=poiCompanionCommit(r,{o,s},now);
   const hp=s.hp;
   if(hit)poiCompanionResolve(r,r.attackMotion.hit,'fight');
   const renDamage=hp-s.hp;
   setup(83);r.nextHit=0;
   const renMiss=!poiCompanionCommit(r,{o,s},now);
   return {playerAtLimit:atLimit.monster?.[0]===o,playerBeyond:!!poiAimTrace(ray,profile.range,now).monster,renDamage,renMiss,limit:atLimit.spearLimit};
  },
  party:()=>poiPartyMembers(poiHotbarRead()).map(n=>({id:n.id,job:n.job,weapon:n.weapon,hp:n.hp})),
  kit:()=>({count:poiInventorySlots(poiHotbarRead()).filter(Boolean).length,estate:poiHotbarRead()[frontierEstateKey('frontierchief')]||null}),
  hut:()=>facilitySite.buildings.find(b=>b.id==='frontierHouse').name,
  art:()=>{const m=mesh();deco(m,'equipWalkingCane',0,0,0,0);return {vertices:m.p.length/3,width:Math.max(...m.p.filter((_,i)=>i%3===0))}},
  finish:()=>poiPartyWith('human:frontierchief',()=>{Object.assign(poiCompanionActor,{x:52,z:30,y:0});return poiCompanionHurt(1000,performance.now())}),
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errs=[];
 p.on('pageerror',e=>{errs.push(e.message);console.log(e.stack)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.chiefQA[name](...args),[name,args]);
 const ready=async(n)=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(n=>window.__editorTest?.chiefQA.actors().length===n,n)};
 const button=p.locator('#poiWalkAction'),menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]');
 async function greet(){
  const n=(await run('actors')).find(x=>x.id==='frontierchief');a.equal(n.status.job,'村長');a.equal(n.status.weapon,'equipWalkingCane');
  a(await run('stepTo',{x:n.x+1,z:n.z,y:0,facing:3}));
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');await button.tap();
  a.equal(await p.locator('#poiMessageHeading').textContent(),'ロアン');
 }
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready(3);
 await p.waitForFunction(()=>document.getElementById('poiLocationName').textContent==='リネア村');
 a.equal(await run('hut'),'村長の家');a.equal((await run('profile')).range,1.25);
 const art=await run('art');a(art.vertices>100&&art.width>.18,JSON.stringify(art));
 a(await run('stepTo',{x:76,z:30,y:0,facing:1}));
 await p.waitForFunction(()=>document.getElementById('poiLocationName').textContent==='川辺の原野');
 await greet();a.equal((await run('kit')).count,1,'the village chief gives the stick but not clothes');
 a.match(await p.locator('#poiMessageLog [data-kind=gift]').textContent(),/木の棒を手に入れた/);
 const stick=await run('stickSlot');a(stick>=0&&stick<9);
 await menu('back').tap();await p.locator('#poiHotbar [data-hotbar-slot="'+stick+'"]').tap();a.equal(await run('weapon'),'equipStick');
 await greet();a.equal((await run('kit')).count,1);
 await menu('back').tap();const measured=await run('rangeQA');a.deepEqual([measured.playerAtLimit,measured.playerBeyond,measured.renMiss,measured.limit],[true,false,true,4],JSON.stringify(measured));
 a(measured.renDamage>0,JSON.stringify(measured));
 await greet();await menu('request').tap();await menu('recruit').tap();
 a.deepEqual((await run('party')).map(x=>[x.id,x.weapon]),[['human:frontierchief','equipWalkingCane']]);
 await p.reload({waitUntil:'domcontentloaded'});await ready(2);
 a.equal((await run('party'))[0].job,'村長');
 a(await run('finish'));let k=await run('kit');a(k.estate.slots.some(c=>c?.type==='equipWalkingCane'));
 await p.reload({waitUntil:'domcontentloaded'});await ready(2);a.deepEqual(await run('party'),[]);
 k=await run('kit');a(k.estate.slots.some(c=>c?.type==='equipWalkingCane'));
 a(await run('stepTo',{x:k.estate.x-1,z:k.estate.z,y:0,facing:1}));a(await run('step'));
 await p.locator('#poiChestPanel').waitFor({state:'visible'});await p.locator('#poiChestTakeAll').tap();a(!(await run('kit')).estate);
 a.deepEqual(errs,[]);console.log('PASS village HUD boundary, one usable stick, chief recruitment and estate, player and Ren spear range');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
