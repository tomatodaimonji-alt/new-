const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa390:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  mina:()=>{
   const n=poiTownNpcActors.find(a=>a.role.id===POI_FRONTIER_SHOP_ID),p=poiHumanPartySpec('human:frontiershopkeeper');
   return {resident:n.weapon,party:p.weapon,name:poiInventoryItemName(p.weapon),status:poiTownNpcStatus(n).attack,
    partyAttack:p.attack,bare:poiTownNpcAttackPower({...n,weapon:null}),pen:poiItemDetailWeaponStats(p.weapon)};
  },
  damage:()=>{
   poiTownNpcActors.forEach(n=>n.recessed=true);poiMonsterStates.clear();
   if(!workshopResumeRestorePosition({x:45,z:30,y:0,facing:1}))throw Error('invalid fight fixture');
   const o={x:46,z:30,y:0,type:'monsterSlime',rot:0},s=poiCombatActorMake(o);
   s.nextAttack=performance.now()+9000;poiMonsterStates.set(o,s);
   const base=s.hp,t=performance.now(),began=poiPlayerStartProfile(null,t),wind=poiPlayerProfilePose(null,90);
   poiPlayerWeaponFrame(t+134);const before=s.hp;
   poiPlayerWeaponFrame(t+135);const after=s.hp;
   const fist={base,began,before,after,phase:wind.phase,extension:wind.extension,ready:poiAttackReady-t};
   const ally={x:45.14,z:30,y:0,id:'human:frontiershopkeeper',px:45.14,pz:30},target={o,s,until:t+2000};
   const started=poiCompanionCommit(ally,target,t+600);
   const pre=s.hp;
   poiCompanionResolve(ally,t+670,'fight');
   const post=s.hp;
   return {fist,ally:{started,pre,post,next:ally.nextHit-(t+600)}};
  }
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
 await p.waitForFunction(()=>window.__editorTest?.qa390.ready());
 const run=name=>p.evaluate(name=>window.__editorTest.qa390[name](),name);
 const mina=await run('mina');
 a.equal(mina.resident,'equipBallpointPen');a.equal(mina.party,mina.resident);a.equal(mina.name,'ペン');
 a(mina.status>0&&mina.status===mina.partyAttack&&mina.bare>0);
 a.deepEqual(mina.pen,{damage:12,speed:10,reach:1});
 const {fist,ally}=await run('damage');console.log({fist,ally});
 a(fist.began&&fist.before===fist.base&&fist.after===fist.base-14&&fist.ready===475&&fist.phase==='windup'&&fist.extension<.4);
 a(ally.started&&ally.pre-ally.post===mina.partyAttack&&ally.next===195);
 a.deepEqual(errors,[]);
 console.log('PASS Mina pen loadout in town and party, display grades and actual damage, slower fist hits at contact without weapon wear');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
