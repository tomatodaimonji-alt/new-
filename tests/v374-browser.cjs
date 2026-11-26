const a=require('node:assert/strict'),{chromium}=require('playwright'),{readFileSync}=require('node:fs'),{createServer}=require('node:http');
let html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 stepTo:workshopResumeRestorePosition,
 dialog:poiTownDialogueSnapshot,
 actors:()=>poiTownNpcActors.map(n=>({id:n.role.id,x:n.x,z:n.z})),
 clothes:()=>poiInventorySlots(poiHotbarRead()).filter(Boolean).map(c=>c.type),
 equip:part=>{const i=poiInventorySlots(poiHotbarRead()).findIndex(c=>c?.type===FRONTIER_FITTED_GEAR[part]);return poiMoveArmorSlot({zone:'bag',index:i-POI_HOTBAR_SIZE},{zone:'armor',part})},
 party:()=>poiPartyMembers(poiHotbarRead()).map(x=>x.id),
 sounds:()=>{const real=poiSound;window.qaSounds=[];poiSound=(...args)=>{window.qaSounds.push(args);return real(...args)}},
 saveReject:()=>{const real=Storage.prototype.setItem;Storage.prototype.setItem=function(key,...rest){if(key===POI_HOTBAR_KEY)throw Error('test write failure');return real.call(this,key,...rest)};window.restoreStore=()=>{Storage.prototype.setItem=real}},
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({executablePath:process.env.CHROMIUM||undefined,headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errs=[];p.on('pageerror',e=>errs.push(String(e)));
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest[name](...args),[name,args]);
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(()=>window.__editorTest?.actors().length===2)};
 const button=p.locator('#poiWalkAction'),menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),dialog=()=>run('dialog');
 const meet=async(id,name)=>{
  const actor=(await run('actors')).find(x=>x.id===id),sera=id==='frontiersera';
  a(await run('stepTo',{x:actor.x+(sera?1:-1),z:actor.z,y:0,facing:sera?3:1}));
  await p.waitForFunction(name=>document.getElementById('poiWalkAction').getAttribute('aria-label')===name+'と話す',name);
  await button.tap();
  a.equal((await dialog()).name,name);
  a((await dialog()).text.length>0,'NPC should speak on first press');
  a.equal(await menu('talk').count(),0);
 };
 const dismiss=async()=>{await menu('back').tap();a.equal(await dialog(),null)};
 const notices=p.locator('#poiMessageLog [data-kind="gift"]:visible');
 const expected=['starterTunic','starterTrousers','armorLeatherShoes'];
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();await run('sounds');
 a.deepEqual(await run('clothes'),[]);
 await run('saveReject');await meet('frontiersera','セラ');a.match((await dialog()).text,/渡せなかった/);
 a.deepEqual(await run('clothes'),[]);a.equal(await notices.count(),0);await dismiss();
 await p.evaluate(()=>window.restoreStore());
 await meet('frontiersera','セラ');a.match((await dialog()).text,/裸/);a.deepEqual(await run('clothes'),expected);
 a.match(await notices.textContent(),/布の服、布のズボン、革の靴を手に入れた。/);
 const dimensions=await notices.evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('#poiMessageLog').getBoundingClientRect();return {bottom:r.bottom,end:p.bottom}});
 a(dimensions.bottom<=dimensions.end+1,JSON.stringify(dimensions));
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x[0]==='item-pickup').length),1);
 await dismiss();a.equal(await p.locator('#poiMessageHeading').textContent(),'アナウンス');a.equal(await notices.count(),1);
 await p.reload({waitUntil:'domcontentloaded'});await ready();await run('sounds');
 a.deepEqual(await run('clothes'),expected);
 await meet('frontierren','レン');a.match((await dialog()).text,/装備/);a.deepEqual(await run('clothes'),expected);
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x[0]==='item-pickup').length),0);
 await dismiss();for(const part of ['torso','legs','feet'])a((await run('equip',part)).ok,part);
 for(const [id,name] of [['frontiersera','セラ'],['frontierren','レン']]){
  await meet(id,name);a.match((await dialog()).text,/似合/);
  await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='次へ');await button.tap();
  a.match((await dialog()).text,/依頼/);a(!(await run('party')).includes('human:'+id));
  await menu('request').tap();await menu('recruit').tap();a((await run('party')).includes('human:'+id));
 }
 a.deepEqual(errs,[]);console.log('PASS direct dialogue, failed-save retry, one audible and visible gift, reload, two optional recruits');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
