const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qaPickup:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontierchief'),
  read:()=>{
   const k=poiHotbarRead();
   return {ren:frontierVendorStock(k,'frontierren'),roan:frontierVendorStock(k,'frontierchief'),
    gear:frontierLifeRecord(k,'frontierren').items,ground:k.groundGold||[],drops:k.drops||[],player:poiWalletGold(k)};
  },
  run:()=>{
   const t=performance.now()+200;
   if(!poiEconomyWrite({...poiHotbarRead(),worn:{...poiArmorWorn(poiHotbarRead()),torso:'starterTunic',legs:'starterTrousers'}}))
    throw Error('isolated clothes fixture');
   const role=poiTownNpcActors.find(r=>r.role.id==='frontierren');
   const recruit=poiHumanPartyRecruit(role,t),party=recruit.ok&&poiPartyActorById(recruit.id);
   const roan=poiTownNpcActors.find(r=>r.role.id==='frontierchief');
   if(!party||!roan)throw Error('fixture missing actual party and village humans '+JSON.stringify(recruit));
   if(!workshopResumeRestorePosition({x:19,z:38,y:0,facing:0}))throw Error('fixture player cell');
   Object.assign(party,{x:20,z:38,fx:20,fz:38,px:20,pz:38,site:facilitySite,y:0,attackMotion:null,frontierPickupAt:0});
   Object.assign(roan,{x:21,z:38,fromX:21,fromZ:38,fromY:0,y:0,moveAt:null,actorLeg:null,frontierStrike:null,frontierPickupAt:0});
   for(const v of poiMonsterStates.values())v.hp=0;
   const k=poiHotbarRead(),groundGold=[{x:21,z:38,y:0,amount:7}];
   const drops=[{x:20,z:38,y:0,type:'equipIronSword',durability:31}];
   if(!poiEconomyWrite({...k,groundGold,drops}))throw Error('isolated real piles setup failed');
   const before=window.__editorTest.qaPickup.read();
   frontierNpcLifeStep(roan,poiTownClockSnapshot(),t,{plans:2});
   frontierHumanCompanionHeal(party,t+35);
   return {before,after:window.__editorTest.qaPickup.read(),gl:gl.getError()};
  }
 },
`);
for(const [,js] of h.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))if(js.trim())new vm.Script(js);
if(process.argv.includes('--syntax-only')){console.log('PASS exact browser probe and HTML parse');process.exit(0)}
const {chromium}=require('playwright');
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];
 p.on('pageerror',e=>errors.push(String(e.stack)));
 const ready=async()=>{await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
  await p.waitForFunction(()=>window.__editorTest?.qaPickup.ready(),null,{timeout:25000});};
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});await ready();
 const q=await p.evaluate(()=>window.__editorTest.qaPickup.run());console.log(q);
 a.equal(q.gl,0);a.equal(q.after.player,q.before.player);
 a.equal(q.after.roan.gold,q.before.roan.gold+7);a.equal(q.after.ren.gold,q.before.ren.gold);a.deepEqual(q.after.ground,[]);
 a.deepEqual(q.after.drops,[]);a(q.after.gear.some(k=>k.type==='equipIronSword'&&k.durability===31));
 await p.reload();await ready();
 const cold=await p.evaluate(()=>window.__editorTest.qaPickup.read());
 a.deepEqual(cold,q.after);a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
