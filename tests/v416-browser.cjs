const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa416:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length,
  stats:()=>{const k=poiHotbarRead();return {attack:poiPlayerAttackDamage(null),defense:poiPlayerDefense({...k,worn:POI_FRESH_ARMOR}),
   looks:facilitySite.residents.filter(r=>FRONTIER_GUARD_STATS[r.id]).map(r=>[r.appearance,FRONTIER_HUMANS[r.appearance].beard]),
   sight:[frontierRuinsBarLineClear({x:7.5,z:29.5},[9.5,-3,29.5]),frontierRuinsBarLineClear({x:5.5,z:22.5},[9.5,-3,29.5])]};},
  seed:()=>{if(!poiEconomyWrite({...poiHotbarRead(),gold:24,goldHotbarSlot:4}))throw Error('seed');poiEconomyRefresh()},
  gold:()=>({gold:poiEconomyGold(),piles:poiHotbarRead().groundGold?.map(p=>p.amount)??[],bag:$('poiBagPanel').hidden}),
  atChest:()=>{
   if(!poiEconomyWrite({...poiHotbarRead(),frontierRuinsCleared:true}))throw Error('gate fixture');
   if(!workshopResumeRestorePosition({x:5,z:52,y:0,facing:2,cave:true}))throw Error('chest fixture');
   poiShopSync();return frontierRuinsChestReachable();
  },
  chest:()=>({unlock:poiMineUnlockSnapshot(),open:poiChestIsOpen(),saved:!!poiHotbarRead()[FRONTIER_RUINS_CHEST_KEY],
   shown:!$('poiMineUnlockProgress').hidden,value:$('poiMineUnlockProgress').querySelector('progress').value})
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa416?.ready(),null,{timeout:30000});
 const q=()=>window.__editorTest.qa416;
 const s=await p.evaluate(()=>window.__editorTest.qa416.stats()); console.log('stats, guards, walls',s);
 a.deepEqual([s.attack,s.defense,s.sight],[1,1,[true,false]]);a.ok(s.looks.every(x=>x[1]===false));
 await p.evaluate(()=>window.__editorTest.qa416.seed());
 const loc=await p.locator('#poiHotbar [data-hotbar-slot="4"]').boundingBox();
 const cdp=await p.context().newCDPSession(p);
 const f={x:loc.x+loc.width/2,y:loc.y+loc.height/2},t={x:420,y:170};
 const send=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});
 await send('touchStart',f);for(let i=1;i<=5;i++)await send('touchMove',{x:f.x+(t.x-f.x)*i/5,y:f.y+(t.y-f.y)*i/5});await send('touchEnd');
 const g=await p.evaluate(()=>window.__editorTest.qa416.gold());console.log('gold drop',g);
 a.deepEqual(g,{gold:0,piles:[24],bag:true});
 a.ok(await p.evaluate(()=>window.__editorTest.qa416.atChest()));
 const c=()=>p.evaluate(()=>window.__editorTest.qa416.chest());await p.locator('#poiWalkAction').tap();
 const u=await c();console.log('initial chest state',u);
 a.ok(u.unlock.active&&!u.open&&!u.saved);a.equal(u.unlock.duration,2500);
 await p.waitForFunction(()=>{const c=window.__editorTest.qa416.chest();return c.shown&&c.value>0&&c.value<2500},null,{timeout:3500});
 await p.waitForFunction(()=>window.__editorTest.qa416.chest().open,null,{timeout:7000});
 const end=await c();a.ok(end.open&&end.saved&&!end.unlock.active&&!end.shown);
 await p.locator('#poiChestClose').tap();await p.locator('#poiWalkAction').tap();
 const again=await c();a.ok(again.open&&!again.unlock.active);a.deepEqual(errors,[]);
 console.log('PASS wall occlusion and stats; wallet shortcut throws 24 coins with bag closed; 2.5s unlock progress and repeat open');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
