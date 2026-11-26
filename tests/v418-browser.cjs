const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa418:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id==='frontiersugimoto'),
  walking:()=>{
   const candidate=world.find(o=>o.type==='rockMossy'&&o.y===0&&o.z>=40&&o.x>75&&o.x<145&&
    !frontierHomeCell(o.x,o.z)&&poiTownNpcStance(o)&&poiWalkCanStep(o.x,o.z,o.x-1,o.z,null,true,true,false)&&
    poiWalkCanStep(o.x-1,o.z,null,null,null,true,true,false));
   if(!candidate)throw Error('No riverside rock sample');
   const {x,z}=candidate;
   if(!workshopResumeRestorePosition({x:x-1,z,y:0,facing:1,cave:false}))throw Error('rock fixture');
   poiWalkNextReady=0;poiWalkStep(1,0);
   return {wanted:[x,z],actual:[poiWalkX,poiWalkZ]};
  },
  init:()=>{
   const at={x:124,z:30,y:0,facing:1,cave:false},n=performance.now();
   if(!workshopResumeRestorePosition(at))throw Error('bridge player position');
   const guard=poiTownNpcActors.find(a=>a.role.id==='frontiersugimoto');
   const ranks=Object.fromEntries(poiTownNpcActors.map(a=>[a.role.id,poiTownNpcStatus(a).rank]));
   const npcRows=[...poiNpcStatusView(guard).querySelectorAll('dt')].map(x=>x.textContent);
   if(!poiHumanPartyRecruit(guard,n).ok)throw Error('bridge ally fixture');
   const originalSound=poiSound;
   window.qaCoinSfx=0;
   poiSound=function(kind,weapon,...rest){
    if(kind==='item-pickup'&&weapon==='coin')window.qaCoinSfx++;
    return originalSound(kind,weapon,...rest);
   };
   const friend='human:'+guard.role.id;
   poiPartyAdoptHuman(friend,{...guard,x:125,z:30,actorLeg:null,moveAt:null},n);
   const ally=poiPartyActorById(friend);ally.next=0;ally.nextHit=0;
   for(const resident of poiTownNpcActors)resident.frontierPickupAt=n+30000;
   const obj={x:127,z:30,y:0,type:'monsterSlime',rot:0},body=poiCombatActorMake(obj);
   Object.assign(body,{hp:12,frontierRuins:false,wildSpawn:true,nextAttack:n+15000,nextMove:n+15000,moveStarted:-10000});
   poiMonsterStates.set(obj,body);poiMonsterMeshDirty=true;
   window.qaSlime={obj,body};
   poiBagSetOpen(true);
   const pose=poiMonsterPose(obj,body,n,true),deck=frontierSurfaceHeight(127.5,30.5,undefined,false);
   return {ranks,npcRows,poseY:pose.y,deck,raw:terrainY(127,30),loot:poiGroundLootSupport({x:127,z:30,y:0,frontierCave:false}),bag:!$('poiBagPanel').hidden,
    rankRow:[...$('poiBagPlayerStats').children].find(n=>n.textContent.includes('冒険者ランク'))?.textContent};
  },
  result:()=>{
   const q=window.qaSlime.body,coin=poiEconomyDrops.get(q.x+','+q.z);
   return {hp:q.hp,coin:coin?.amount??0,bag:!$('poiBagPanel').hidden,
    dropped:poiEconomyDropActors.has(q),onDeck:facilitySite.decks.has(q.x+','+q.z),
    gold:frontierVendorStock(poiHotbarRead(),'frontiersugimoto').gold,
    sfx:window.qaCoinSfx};
  },
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
 await p.waitForFunction(()=>window.__editorTest?.qa418?.ready(),null,{timeout:30000});
 const walk=await p.evaluate(()=>window.__editorTest.qa418.walking());a.deepEqual(walk.actual,walk.wanted);
 const s=await p.evaluate(()=>window.__editorTest.qa418.init());console.log(s);
 a.equal(s.ranks.frontiersugimoto,'F');a.equal(s.ranks.frontiermiyamoto,'F');a.equal(s.ranks.frontierren,'未登録');a.equal(s.rankRow,'冒険者ランク未登録');
 a.deepEqual(s.npcRows.slice(0,4),['名前','職業','冒険者ランク','HP']);a.ok(s.bag&&s.deck>s.raw+.25&&Math.abs(s.poseY-s.deck)<.03);a.equal(s.loot,s.deck);
 await p.waitForFunction(()=>window.__editorTest.qa418.result().gold===15,null,{timeout:14000,polling:300});
 const r=await p.evaluate(()=>window.__editorTest.qa418.result());console.log(r);
 a.equal(r.hp,0);a.equal(r.coin,0);a.equal(r.gold,15);a.equal(r.sfx,1);a.ok(r.bag&&r.dropped&&r.onDeck);a.deepEqual(errors,[]);
 console.log('PASS actual field mossy rock traversal; allied bridge kill, approach, exact coin credit and pickup sound');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
