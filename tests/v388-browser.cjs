const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa388:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontiersera'),
  coinBag:(gold,items,balance)=>{
   poiTownDialogueClose();poiBagSetOpen(false);
   const pos={x:45,z:30,y:0,facing:0};
   if(!workshopResumeRestorePosition(pos))throw Error('invalid fixture position');
   const kit=poiHotbarRead(),npcId='frontierren';
   const slots=Array(POI_CHEST_SIZE).fill(null).map((_,i)=>i<items?{type:'healingHerb',count:1}:null);
   const saved=frontierEstateDecode({version:1,...pos,npcId,gold,slots});
   if(!saved||!poiEconomyWrite({...kit,gold:balance,frontierFallen:[npcId],'estate:frontierren':saved}))throw Error('cannot create legacy bag');
   frontierEstateWalkover();
   return poiChestIsOpen();
  },
  contents:()=>{
   const kit=poiHotbarRead(),bag=kit['estate:frontierren'];
   return {gold:kit.gold,bagGold:bag?.gold,items:bag?.slots.filter(Boolean).length};
  },
  sleep:()=>{
   poiBagSetOpen(false);poiTownDialogueClose();
   const n=poiTownNpcActors.find(a=>a.role.id==='frontiersera');
   poiTownClockGameMs=23*60*POI_TOWN_MINUTE_MS;
   Object.assign(n,{...n.role.home,actorLeg:null,moveAt:null,activity:'sleep-home',target:null,frontierCombat:null});
   if(!workshopResumeRestorePosition({x:41,z:36,y:0,facing:3}))throw Error('invalid speech fixture position');
   poiShopSync();
   return poiTownDialogueTarget(performance.now())?.role.id;
  },
  camera:(test=false)=>{
   if(test){
    toggleTopDown();togglePoiThirdPerson();
    workshopResumeApplyView({...workshopResumeView(),top:true,third:false,orbitYaw:.75});
   }
   return {top:cameraTopDown,third:poiThirdPerson,orbit:poiCameraYaw};
  },
  stick:()=>{
   const m=mesh();deco(m,'equipStick',0,0,0,0);
   const ring=[];
   for(let i=0;i<m.p.length;i+=3)if(Math.abs(m.p[i+1]-1.274)<.02&&m.p[i]>-.10)ring.push(m.p[i]);
   return Math.max(...ring)-Math.min(...ring);
  },
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qa388.ready());
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.qa388[name](...args),[name,args]);
 const boot=await run('camera');a(boot.third&&!boot.top,JSON.stringify(boot));
 a.deepEqual(await run('camera',true),{top:false,third:true,orbit:.75});
 a.equal(await p.locator('[data-landscape-action=view]').count(),0);
 a((await run('stick'))>.141);
 a(await run('coinBag',23,0,4));
 const coin=p.locator('#poiChestGrid [data-chest-slot]').filter({has:p.locator('[data-art="gold"]')});
 a.equal(await p.locator('#poiChestHeader #poiEstateGold,#poiEstateGold').count(),0);
 a.equal(await coin.count(),1);a.equal(await coin.locator('.hotbar-count').textContent(),'23');
 await coin.tap();
 const detail=p.locator('#poiItemDetail');await detail.waitFor({state:'visible'});
 a.equal(await p.locator('#poiItemDetailName').textContent(),'金貨');
 await detail.locator('[data-item-detail-action=transfer]').tap();
 a.deepEqual(await run('contents'),{gold:27,bagGold:undefined,items:undefined});
 await p.locator('#poiChestPanel').waitFor({state:'hidden'});
 a(await run('coinBag',4,18,999999));await coin.waitFor({state:'visible'});
 a.equal(await coin.getAttribute('data-chest-slot'),'18');
 await coin.tap();await detail.locator('[data-item-detail-action=transfer]').tap();
 a.equal(await p.locator('#poiItemDetailFeedback').textContent(),'金貨が上限です。');
 await detail.locator('[data-item-detail-action=back]').tap();
 a.deepEqual(await run('contents'),{gold:999999,bagGold:4,items:18});
 a(await run('coinBag',9,1,10));
 await p.locator('#poiChestTakeAll').tap();
 a.deepEqual(await run('contents'),{gold:19,bagGold:undefined,items:undefined});
 a.equal(await run('sleep'),'frontiersera');
 a.equal(await p.locator('[data-npc-sleep]').count(),0);
 await p.locator('#poiWalkAction').tap();
 const line=p.locator('#poiMessageLog [data-kind=dialogue]');
 await line.waitFor({state:'visible'});
 await p.waitForFunction(()=>document.querySelector('#poiMessageLog [data-kind=dialogue]')?.textContent==='zzz...');
 a(await p.locator('#poiNpcMenu').isHidden());a.equal(await p.locator('[data-npc-sleep]').count(),0);
 a.deepEqual(errors,[]);
 console.log('PASS estate coin slot, old and full bags, receive and take all, thicker stick, sleep speech only, fixed third-person with saved orbit');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
