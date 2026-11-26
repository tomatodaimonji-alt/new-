const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 shopQA:{
  stepTo:workshopResumeRestorePosition,
  move:(dx,dz)=>poiWalkStep(dx,dz),
  state:()=>({gold:poiHotbarRead().gold||0,herbs:poiHotbarRead().potions,area:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,0).name,
   house:facilitySite.buildings.find(b=>b.id==='frontierStore').name,trade:poiTownDialogueSnapshot()}),
  probe:()=>{
   const a=poiTownNpcActors.find(r=>r.role.id===POI_FRONTIER_SHOP_ID);
   return {shop:poiFrontierAtCounter(a),target:poiTownDialogueTarget(performance.now())?.role.id,merchant:a?.role.name,job:a?.role.job,pose:[poiWalkX,poiWalkZ,poiWalkFacing]};
  },
  setup:()=>{
   poiWildClear();
   let n=14533;const rng=()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);
   const t=performance.now();
   const simulate=()=>{for(let i=0;i<40;i++)poiWildSpawnFrame(t+i*1000,rng)};
   const read=()=>[...poiWildActors].filter(o=>poiMonsterStates.get(o)?.hp>0).map(o=>({x:o.x,z:o.z,h:frontierGroundKind(o.x,o.z),d:Math.hypot(o.x-poiWalkX,o.z-poiWalkZ)}));
   workshopResumeRestorePosition({x:51,z:30,y:0,facing:1});
   simulate();const safe=read();
   workshopResumeRestorePosition({x:82,z:30,y:0,facing:1});
   simulate();const first=read();
   const o=[...poiWildActors][0],s=poiMonsterStates.get(o);if(o){
    s.hp=0;poiEconomyDrop(o,s);const q=poiEconomySnapshot();
    for(let i=40;i<68;i++)poiWildSpawnFrame(t+i*1000,rng);
    return {safe,first,again:read(),drop:q.drops[0],baseCount:world.filter(v=>v.type==='monsterSlime'&&v.y===0).length};
   }
   return {safe,first,again:[],drop:null,baseCount:0};
  },
  earn:()=>{
   const list=[...poiWildActors].filter(o=>poiMonsterStates.get(o)?.hp>0).slice(0,3);
   const points=[];
   for(const o of list){const s=poiMonsterStates.get(o);s.hp=0;poiEconomyDrop(o,s);points.push({x:s.x,z:s.z});}
   return points;
  },
  pickup:p=>{workshopResumeRestorePosition({...p,y:0,facing:1});return poiEconomyCollect(p.x,p.z)},
  closedSide:()=>{const n=poiTownNpcActors.find(a=>a.role.id===POI_FRONTIER_SHOP_ID);return poiNpcTradeCatalog(n,'buy').length},
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errs=[];
 p.setDefaultTimeout(13000);
 p.on('pageerror',e=>{errs.push(e.message);console.log(e.stack)});p.on('console',m=>{if(m.type()==='error')console.log(m.text())});
 const url='http://127.0.0.1:'+server.address().port+'/?test=1';
 const run=(name,...args)=>p.evaluate(([name,args])=>window.__editorTest.shopQA[name](...args),[name,args]);
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});await p.waitForFunction(()=>window.__editorTest?.shopQA.probe().merchant==='ミナ')};
 const menu=id=>p.locator('#poiNpcMenu [data-npc-action="'+id+'"]'),trade=id=>p.locator('#poiNpcTradePanel [data-npc-action="'+id+'"]');
 await p.goto(url,{waitUntil:'domcontentloaded'});await ready();
 a.equal((await run('state')).house,'道具屋');
 const waves=await run('setup');console.log(waves);
 a.deepEqual(waves.safe,[]);a.equal(waves.baseCount,0);a.equal(waves.first.length,5);a(waves.first.every(v=>v.d>=8&&v.h!=='river'));
 a.equal(waves.again.length,5);a(!waves.again.some(v=>v.x===waves.first[0].x&&v.z===waves.first[0].z));a.equal(waves.drop.amount,3);
 const earned=await run('earn');a.equal(earned.length,3);for(const item of earned)a(await run('pickup',item));
 a((await run('state')).gold>=9);
 a(await run('stepTo',{x:38,z:25,y:0,facing:2}));a.equal(await run('closedSide'),0);
 a(await run('stepTo',{x:38,z:27,y:0,facing:0}));a.equal(await run('closedSide'),0);
 a(await run('stepTo',{x:38,z:25,y:0,facing:0}));
 const merchant=await run('probe');a(merchant.shop&&merchant.target==='frontiershopkeeper',JSON.stringify(merchant));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent==='話す');
 await p.locator('#poiWalkAction').tap();await menu('buy').tap();
 await trade('trade:healingHerb').tap();await trade('confirm').tap();
 a.equal((await run('state')).herbs,1);
 await p.reload({waitUntil:'domcontentloaded'});await ready();a.equal((await run('state')).herbs,1);
 await run('stepTo',{x:38,z:25,y:0,facing:0});await p.screenshot({path:'v378-shop.png'});
 a.deepEqual(errs,[]);console.log('PASS outdoor safe spawn, five plus replacement, earned coins and buy herb across real counter');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
