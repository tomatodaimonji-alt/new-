const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa422:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(n=>n.role.id==='frontierregna'),
  npc:()=>poiTownNpcActors.find(n=>n.role.id==='frontierregna'),
  audit:()=>{
   const n=window.__editorTest.qa422.npc(),g=n.role.public;
   return {status:poiTownNpcStatus(n),bank:g.x>=FRONTIER_BRIDGE.east&&g.z<FRONTIER_BRIDGE.north&&frontierRiver(g.x+.5,g.z+.5)>0,
    free:poiTownNpcStance(g),meshes:[n.weapon,...Object.values(n.gear)].map(t=>{const m=mesh();deco(m,t,0,0,0,0);return m.p.length})};
  },
  at:()=>{
   poiWildClear();poiTownNpcNext=Infinity;
   const n=window.__editorTest.qa422.npc(),g=n.role.public;
   Object.assign(n,{x:g.x,z:g.z,facing:g.facing,actorLeg:null,target:null,frontierCombat:null,frontierStrike:null,activity:'visit'});
   for(const [dx,dz,facing] of [[0,1,0],[-1,0,1],[0,-1,2],[1,0,3]]){
    if(!workshopResumeRestorePosition({x:g.x+dx,z:g.z+dz,y:0,facing,cave:false}))continue;
    poiShopSync();
    if(poiTownDialogueTarget(performance.now())===n)return true;
   }
   return false;
  },
  preview:()=>poiHumanPartyRecruit(window.__editorTest.qa422.npc(),performance.now(),true),
  rank:rank=>{if(!poiEconomyWrite({...poiHotbarRead(),adventureRank:rank}))throw Error('rank fixture');poiEconomyRefresh()},
  talk:()=>poiTownDialogueSnapshot(),
  member:()=>poiHumanPartyMembers(poiHotbarRead()).find(m=>m.id==='human:frontierregna'),
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
 await p.waitForFunction(()=>window.__editorTest?.qa422?.ready(),null,{timeout:30000});
 const via=(m,v)=>p.evaluate(([m,v])=>window.__editorTest.qa422[m](v),[m,v]);
 const q=await via('audit');console.log(q);a.equal(q.bank,true);a.ok(q.free);a.equal(q.status.job,'魔法剣士');a.equal(q.status.rank,'B');
 a.deepEqual(q.status.equipment,['equipMithrilSword','armorSilverHood','armorMithrilTorso','armorIndigoTrousers','armorGaldShoes']);a.ok(q.meshes.every(x=>x>100));
 a.equal(await via('at'),true);
 const tap=id=>p.locator('[data-npc-action="'+id+'"]:visible').tap();
 await p.locator('#poiWalkAction').tap();a.match((await via('talk')).text,/クエストで.*辺境.*なんだ、お前/);
 await tap('request');await tap('recruit');a.match((await via('talk')).text,/ザコ.*ゴミカス/);a.equal(await via('member'),undefined);
 await via('rank','C');a.equal((await via('preview')).reason,'rank');
 await via('rank','B');a.equal((await via('preview')).ok,true);await tap('recruit');await tap('join-confirm');
 a.ok(await via('member'));a.deepEqual(errors,[]);console.log('PASS east-bank B-rank magic swordsman gear, greeting, refusal, and eligible recruitment');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
