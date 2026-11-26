const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa414:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontiermiyamoto'),
  seed:()=>{if(!poiEconomyWrite({...poiHotbarRead(),gold:24}))throw Error('seed wallet');poiEconomyRefresh()},
  wallet:()=>({gold:poiEconomyGold(),hot:poiGoldHotbarSlot(poiHotbarRead()),order:poiInventorySnapshot().goldBagSlot,count:$('poiGoldValue').textContent,
    visible:getComputedStyle($('poiBagWallet').querySelector('svg')).visibility,header:!!$('poiBagGoldTotal')}),
  shop:()=>{
   const a=poiTownNpcActors.find(n=>n.role.id==='frontiermiyamoto'),store=poiTownNpcActors.find(n=>n.role.id===POI_FRONTIER_SHOP_ID),pos=facilitySite.toolShop;
   const k=frontierLifeStock(poiHotbarRead(),a.role.id,{gold:12,healingHerb:0,cannedFood:0});
   if(!poiEconomyWrite(k))throw Error('shop fixture');
   Object.assign(a,{x:pos.x,z:pos.z+1,facing:0,activity:'going-toolshop',moveAt:null,actorLeg:null});
   if(!workshopResumeRestorePosition({x:106,z:27,y:0,facing:3,cave:false}))throw Error('shop witness fixture');
   poiTownClockGameMs=18*60*POI_TOWN_MINUTE_MS;
   const n=performance.now(),cost=frontierMerchantPrice('healingHerb',true);
   frontierNpcLifeStep(a,poiTownClockSnapshot(),n,{plans:2});
   const done={stock:frontierVendorStock(poiHotbarRead(),a.role.id),speech:poiTownAmbientSnapshot(),length:a.frontierTradeAt-n,both:store.frontierTradeAt===a.frontierTradeAt,cost};
   return done;
  },
  clock:h=>{poiTownClockGameMs=h*60*POI_TOWN_MINUTE_MS},
  guard:()=>poiTownNpcActors.filter(a=>FRONTIER_GUARD_STATS[a.role.id]).map(a=>({x:a.x,z:a.z,activity:a.activity, clear:poiTownNpcStance(a.role.public)})),
  activity:id=>poiTownNpcActors.find(a=>a.role.id===id)?.activity
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>{errors.push(String(e));console.error(e.stack)});
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
  await p.waitForFunction(()=>window.__editorTest?.qa414?.ready(),null,{timeout:30000});};
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});await ready();
 await p.evaluate(()=>window.__editorTest.qa414.seed());
 const gold=()=>p.evaluate(()=>window.__editorTest.qa414.wallet());
 const cdp=await p.context().newCDPSession(p);
 const drag=async(from,to)=>{
  const middle=async q=>{const r=await p.locator(q).boundingBox();a.ok(r,q);return {x:r.x+r.width/2,y:r.y+r.height/2}};
  const f=await middle(from),t=await middle(to),send=(type,point)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:point?[{...point,id:1}]:[]});
  await send('touchStart',f);
  for(let i=1;i<=5;i++)await send('touchMove',{x:f.x+(t.x-f.x)*i/5,y:f.y+(t.y-f.y)*i/5});
  await send('touchEnd');
 };
 const bag='#poiBagWallet',slot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
 await p.locator('#poiBagToggle').tap();
 a.equal((await gold()).count,'24');await drag(bag,slot(4));
 const moved=await gold();console.log('after drag',moved);
 a.deepEqual([moved.gold,moved.hot,moved.count,moved.visible,moved.header],[24,4,'','hidden',false]);
 a.equal(await p.locator(slot(4)+' .hotbar-count').textContent(),'24');
 await p.reload({waitUntil:'domcontentloaded'});await ready();await p.locator('#poiBagToggle').tap();
 a.deepEqual(await gold(),moved);
 await drag(slot(4),'#poiBagSlots [data-bag-slot="3"]');
 const back=await gold();a.equal(back.gold,24);a.equal(back.hot,null);a.equal(back.count,'24');a.equal(back.order,3);
 a.equal(await p.locator(slot(4)+' .hotbar-count').textContent(),'');
 await p.locator('#poiBagClose').tap();
 const sold=await p.evaluate(()=>window.__editorTest.qa414.shop());console.log('shop',sold);
 a.equal(sold.stock.healingHerb,1);a.equal(sold.stock.gold,12-sold.cost);a.equal(sold.length,2400);a.ok(sold.both);a.equal(sold.speech?.venue,'frontier-shop');
 await p.waitForFunction(()=>window.__editorTest.qa414.activity('frontiermiyamoto')==='off-duty',null,{timeout:11000});
 await p.evaluate(()=>window.__editorTest.qa414.clock(21));
 await p.waitForFunction(()=>window.__editorTest.qa414.guard().every((g,i)=>g.activity==='watch'&&g.x===95&&g.z===(i?32:28)),null,{timeout:60000,polling:600});
 const posts=await p.evaluate(()=>window.__editorTest.qa414.guard());
 a.deepEqual(posts.map(p=>[p.x,p.z,p.clear]),[[95,28,true],[95,32,true]]);a.deepEqual(errors,[]);
 console.log('PASS physical gold drag there and back + reload, finite trade and departure, outside west gate watch');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
