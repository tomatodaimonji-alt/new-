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
 await meet(roan);await ask();await confirm().tap();
 a.deepEqual(await run('party'),['human:frontierchief']);a(!(await run('hasChief')));
 a.equal(await p.locator('#poiMessageLog [data-kind=recruit]').last().textContent(),'ロアンが仲間になった。');
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x==='item-pickup').length),1);
 await meet(mina);await ask();a.notEqual((await run('dialog')).text,first);a.match((await run('dialog')).text,/店の外/);
 a.deepEqual(await run('party'),['human:frontierchief']);await confirm().tap();
 a.equal(await p.locator('#poiMessageLog [data-kind=recruit]').last().textContent(),'ミナが仲間になった。');
 a.equal(await p.evaluate(()=>qaSounds.filter(x=>x==='item-pickup').length),2);
 await p.reload({waitUntil:'domcontentloaded'});await ready();
 a.deepEqual(await run('party'),['human:frontierchief','human:frontiershopkeeper']);
 a.deepEqual(errors,[]);console.log('PASS NPC-specific answer, no automatic enlistment, cancel, confirmed roster, announcement and item pickup SE');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
