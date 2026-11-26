const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync(process.argv[2]||'candidate.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qaPartyHerbs:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontierchief'),
  run:()=>{
   const start=performance.now()+200;
   let starting=poiHotbarRead();
   if(!poiEconomyWrite({...starting,worn:{...poiArmorWorn(starting),torso:'starterTunic',legs:'starterTrousers'}}))
    throw Error('isolated clothing setup failed');
   const roles=['frontierren','frontierchief'],actors=[];
   for(const id of roles){
    const resident=poiTownNpcActors.find(r=>r.role.id===id);
    const r=resident&&poiHumanPartyRecruit(resident,start),actor=r?.ok&&poiPartyActorById(r.id);
    if(!actor)throw Error('cannot recruit '+id+': '+JSON.stringify(r));
    actors.push(actor);
   }
   if(!workshopResumeRestorePosition({x:19,z:38,y:0,facing:0}))throw Error('open room fixture');
   const place=(actor,x,z)=>Object.assign(actor,{x,z,px:x,pz:z,fx:x,fz:z,y:0,site:facilitySite,freeMoving:false,attackMotion:null});
   place(actors[0],20,38);place(actors[1],21,38);
   if(!poiCompanionAttackClear(actors[0],actors[1],0))throw Error('fixture stock actors separated by wall');
   let kit=poiHotbarRead();
   const player=poiWalletGold(kit);
   const recruits=poiHumanPartyDecode(kit.humanParty);
   Object.assign(recruits.find(q=>q.id===actors[0].id),{hp:40,mode:'follow'});
   Object.assign(recruits.find(q=>q.id===actors[1].id),{hp:85,mode:'fight'});
   kit=frontierLifeStock({...kit,humanParty:recruits},roles[0],{gold:10,healingHerb:0,cannedFood:1});
   kit=frontierLifeStock(kit,roles[1],{gold:2,healingHerb:2,cannedFood:1});
   if(!poiEconomyWrite(kit))throw Error('isolated store setup failed');
   frontierNeedSpeech.clear();frontierHerbExchange=null;frontierHerbScanAt=0;frontierLifeSpeech.clear();
   frontierPartyHerbFrame(start,actors);
   const asks=frontierLifeSpeech.get(roles[0])?.text,before=frontierVendorStock(poiHotbarRead(),roles[0]).healingHerb;
   frontierPartyHerbFrame(start+1100,actors);
   const donor=frontierLifeSpeech.get(roles[1])?.text;
   const handoff=roles.map(id=>frontierVendorStock(poiHotbarRead(),id));
   frontierHumanCompanionHeal(actors[0],start+2900);
   const paid=roles.map(id=>frontierVendorStock(poiHotbarRead(),id));
   return {asks,donor,before,handoff,paid,playerSame:player===poiWalletGold(poiHotbarRead()),
    hp:poiHumanPartyMembers(poiHotbarRead()).find(m=>m.id===actors[0].id)?.hp,gl:gl.getError()};
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
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qaPartyHerbs.ready(),null,{timeout:25000});
 const out=await p.evaluate(()=>window.__editorTest.qaPartyHerbs.run());console.log(out);
 a.match(out.asks,/薬草余ってないか/);a.match(out.donor,/6G/);
 a.equal(out.before,0);a.equal(out.playerSame,true);a.equal(out.gl,0);
 a.deepEqual(out.handoff.map(v=>[v.gold,v.healingHerb]),[[4,1],[8,1]]);
 a.deepEqual(out.paid.map(v=>v.healingHerb),[0,1]);a.equal(out.hp,70);
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
