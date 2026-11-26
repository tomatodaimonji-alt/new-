const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa425:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(n=>n.role.id==='frontierlyzel'),
  pair:()=>['frontierregna','frontierlyzel'].map(id=>poiTownNpcActors.find(n=>n.role.id===id)),
  audit:()=>{
   const [r,l]=window.__editorTest.qa425.pair(),positions=[r.role.public,l.role.public];
   const h=mesh();frontierGuardHat(h,'armorSilverHood');
   return {heads:r.gear.head,ornament:poiInventoryItemName(r.gear.head),mesh:h.p.length,
    hairOnSide:h.p.filter((_,i)=>i%3===0).every(x=>x>.07),gap:Math.hypot(r.x-l.x,r.z-l.z),
    same:r.role.worldParty===l.role.worldParty,bank:positions.every(g=>g.x>=FRONTIER_BRIDGE.east&&g.z<FRONTIER_BRIDGE.north&&poiTownNpcStance(g)),
    roles:[r,l].map(n=>[n.role.name,n.role.job,n.role.adventureRank,n.weapon]),
    gear:l.gear,ap:poiTownNpcAttackPower(l),def:poiTownNpcDefense(l),sense:frontierNpcSense(l),
    bows:['equipWoodBow','equipBlackwingBow'].map(type=>{const p=poiPlayerWeaponProfile(type),m=mesh();deco(m,type,0,0,0,0);return [p.damage,p.range,p.hit,p.ready,m.p.length]})};
  },
  aim:()=>{
   const [r,l]=window.__editorTest.qa425.pair();
   const o={y:0,type:'monsterSlime'},s={x:r.x,z:r.z,hp:35};poiMonsterStates.set(o,s);
   r.frontierCombat=o;const focus=frontierNpcPartyTarget(l)?.o===o;
   r.frontierCombat=null;poiMonsterStates.delete(o);return focus;
  },
  at:()=>{
   poiWildClear();poiTownNpcNext=Infinity;
   const l=window.__editorTest.qa425.pair()[1],g=l.role.public;
   Object.assign(l,{x:g.x,z:g.z,facing:g.facing,actorLeg:null,target:null,frontierCombat:null,frontierStrike:null,activity:'visit'});
   for(const [dx,dz,facing] of [[0,1,0],[-1,0,1],[0,-1,2],[1,0,3]]){
    if(!workshopResumeRestorePosition({x:g.x+dx,z:g.z+dz,y:0,facing,cave:false}))continue;
    poiShopSync();if(poiTownDialogueTarget(performance.now())===l)return true;
   }
   return false;
  },
  talk:()=>poiTownDialogueSnapshot(),
  fire:()=>{
   poiTownDialogueClose();poiShopSync();
   if(!workshopResumeRestorePosition({x:115,z:30,y:0,facing:1,cave:false}))throw Error('bow position');
   const now=performance.now(),type='equipBlackwingBow',p=poiPlayerWeaponProfile(type);
   const kit=poiHotbarRead(),slots=poiInventorySlots(kit).slice();slots[0]={type,count:1};
   if(!poiEconomyWrite(poiInventoryEdited({...kit,weapon:type},slots)))throw Error('equip bow');
   if(!poiPlayerStartProfile(type,now))throw Error('bow start');
   const armed=poiPlayerWeaponPending?.type===type;
   poiPlayerWeaponFrame(now+p.hit+5);
   return {armed,flight:poiPlayerWeaponVisual?.type===type};
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
 await p.waitForFunction(()=>window.__editorTest?.qa425?.ready(),null,{timeout:30000});
 const via=m=>p.evaluate(m=>window.__editorTest.qa425[m](),m);
 const q=await via('audit');console.log(q);
 a.equal(q.ornament,'銀羽の髪飾り');a.equal(q.hairOnSide,true);a.ok(q.mesh>100);
 a.equal(q.bank,true);a.equal(q.same,true);a.ok(q.gap>=1&&q.gap<=2);
 a.deepEqual(q.roles,[['レグナ','魔法剣士','B','equipMithrilSword'],['リゼル','弓使い','B','equipBlackwingBow']]);
 a.equal(await via('aim'),true);a.equal(await via('at'),true);
 await p.locator('#poiWalkAction').tap();a.match((await via('talk')).text,/レグナと同じ依頼.*何その顔/);
 a.deepEqual(q.gear,{head:'armorBlackFeather',torso:'armorOwlMantle',legs:'armorIndigoTrousers',feet:'armorGaldShoes'});
 a.equal(q.ap,38);a.equal(q.def,9);a.ok(q.sense>=8);
 a.deepEqual(q.bows.map(b=>b.slice(0,4)),[[22,6,325,1030],[32,8,255,875]]);
 a.ok(q.bows[1][4]>q.bows[0][4]);a.deepEqual(await via('fire'),{armed:true,flight:true});
 a.deepEqual(errors,[]);console.log('PASS ornament, east bridge party, shared target and player dialogue');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
