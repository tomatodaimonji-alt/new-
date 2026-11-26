const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  seed:()=>{
   if(!poiEconomyWrite({...poiHotbarRead(),gold:37,goldStacks:[],goldHotbarSlot:null}))throw Error('seed wallet');
   poiEconomyRefresh();
   return poiEconomyGold();
  },
  sync:()=>{poiShopSync();return {total:$('poiBagGoldTotal').textContent,amount:$('poiGoldValue').textContent,
   icon:!$('poiBagWallet').hasAttribute('data-wallet-empty'),hp:poiPlayerHP,gold:poiEconomyGold(),
   playerMs:poiChapelStepMs(poiWalkX,poiWalkZ),residentMs:POI_TOWN_RESIDENT_TICK,
   unchangedMonster:poiCompanionSpeed({id:'slimeSoul'})===poiMovementFactor(poiStatBase(null,'monsterSlime').speed,3)/POI_MONSTER_FREE_TICK};}

 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 a.equal(await p.evaluate(()=>window.__editorTest.qa398.seed()),37);
 await p.locator('#poiBagToggle').tap();await p.locator('#poiBagPanel').waitFor({state:'visible'});
 const before=await p.evaluate(()=>window.__editorTest.qa398.sync());console.log(before);
 a.equal(before.total,'37G');a.equal(before.amount,'37');a(before.icon&&before.unchangedMonster);
 a.equal(before.playerMs,218.75);a.equal(before.residentMs,475);
 await p.waitForTimeout(750);
 a.equal(await p.locator('#poiGoldValue').textContent(),'37');
 await p.locator('#poiBagClose').tap();await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 await p.locator('#poiBagToggle').tap();await p.locator('#poiBagPanel').waitFor({state:'visible'});
 a.equal(await p.locator('#poiGoldValue').textContent(),'37');
 console.log('PASS Frontier wallet remains visible after redraw and reopen; 80% player and human speed');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
