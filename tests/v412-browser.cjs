const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa412:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontiersugimoto'&&a.activity==='sleep-home'),
  at:(x,z,facing)=>{if(!workshopResumeRestorePosition({x,z,y:0,facing,cave:false}))throw Error('fixture '+x+','+z);poiShopSync()},
  walk:(dx,dz)=>{poiWalkNextReady=0;poiWalkStep(dx,dz);return [poiWalkX,poiWalkZ]},
  target:()=>poiTownDialogueTarget(performance.now())?.role?.id??null,
  sync:()=>poiShopSync(),
  dialogue:()=>poiTownDialogueSnapshot(),
  exitDraw:()=>[...poiValdiaDoorGpu.keys()].some(k=>k.startsWith('frontierWatchHouse:')&&k.endsWith(':exit')),
  party:()=>poiHumanPartyMembers(poiHotbarRead()).map(x=>x.id),
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}); const e=[];
 p.on('pageerror',err=>{e.push(String(err));console.error(err.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa412?.ready(),null,{timeout:30000});
 const at=(x,z,f)=>p.evaluate(args=>window.__editorTest.qa412.at(...args),[x,z,f]);
 const get=()=>p.evaluate(()=>window.__editorTest.qa412.dialogue());
 const sync=()=>p.evaluate(()=>window.__editorTest.qa412.sync());
 const tap=()=>p.locator('#poiWalkAction').tap();
 await at(115,28,0);a.deepEqual(await p.evaluate(()=>window.__editorTest.qa412.walk(0,-1)),[115,27]);
 await at(101,37,0);a.equal(await p.evaluate(()=>window.__editorTest.qa412.target()),null);
 await at(101,32,2);a.deepEqual(await p.evaluate(()=>window.__editorTest.qa412.walk(0,1)),[101,33]);a.deepEqual(await p.evaluate(()=>window.__editorTest.qa412.walk(0,1)),[101,34]);
 await at(100,34,1); // face along the room, not toward either bed
 await p.waitForFunction(()=>window.__editorTest.qa412.target()==='frontiersugimoto',null,{timeout:5000});
 await p.waitForFunction(()=>window.__editorTest.qa412.exitDraw(),null,{timeout:5000});
 await sync();await tap();a.equal((await get()).text,'ZZZ…');
 a.equal(await p.locator('#poiWalkAction').textContent(),'次へ');
 await tap();a.match((await get()).text,/遺跡/);
 await p.locator('[data-npc-action="request"]').tap();await p.locator('[data-npc-action="recruit"]').tap();
 await p.locator('[data-npc-action="join-confirm"]').tap();
 a.deepEqual(await p.evaluate(()=>window.__editorTest.qa412.party()),['human:frontiersugimoto']);
 await at(102,25,0);await p.waitForFunction(()=>window.__editorTest.qa412.target()==='frontiershopkeeper',null,{timeout:8000});
 await sync();await tap();const q=await get();a.equal(q.menu,'toolshop');a.match(q.text,/何をお探し/);a.doesNotMatch(q.text,/カウンター/);
 a.deepEqual(e,[]);console.log('PASS rock step, wall-side negative, mobile bedside tap + recruit, counter-specific greeting');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
