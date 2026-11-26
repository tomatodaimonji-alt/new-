const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  worldTest:()=>{
   const R=FRONTIER_RUINS,before={x:poiWalkX,z:poiWalkZ,site:facilitySite.id,level:poiWalkLevel,travel:poiOtherworldTravelSerial,entrances:poiDungeonEntranceSerial,gl:gl.getError()};
   const stable=facilitySite,id=poiOtherworldTravelSerial,entry=poiDungeonEntranceSerial;
   const place=(x,z)=>{if(!workshopResumeRestorePosition({x,z,y:0,facing:3}))throw Error('invalid fixture '+x+','+z);};
   const old=workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'frontier',play:true,position:{x:51,z:30,y:0,facing:2}})).position;
   const fresh=workshopResumeDecode(JSON.stringify({version:1,route:'facility',id:'frontier',play:true,frontierWest:1,position:{x:20,z:29,y:0,facing:2}})).position;
   const map={w:MAP_W,h:MAP_H,trees:world.filter(o=>o.x<64&&/^tree/.test(o.type)).length,
    bridge:poiWalkCanStep(128,30),water:poiWalkCanStep(128,24),temple:facilitySite.davidTemple?.boss?.x,
    homes:facilitySite.buildings.filter(b=>b.frontierStyle).map(b=>b.door.x),bits:[poiLocalBit(115,30),poiLocalBit(243,30),poiLocalBit(30,30)]};
   const foe=[...poiMonsterStates].find(([o])=>frontierRuinsBoss(o));if(!foe)throw Error('no boss');
   const stats=poiMonsterStatsAt(foe[0]),mobTypes=[...poiMonsterStates].filter(([o,s])=>s.frontierRuins&&!s.frontierRuinsBoss).map(([o])=>o.type);
   const start={x:34,z:29,d:0},open=[start],visited=new Set([start.x+','+start.z]),dist=new Map();
   for(let i=0;i<open.length;i++){
    const p=open[i],key=p.x+','+p.z;dist.set(key,p.d);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const [x,z]=[p.x+dx,p.z+dz],k=x+','+z;
     if(x>34||x<0||z<8||z>55||visited.has(k)||!frontierBurrowCell(x,z)&&!(x>=32&&z===29)||!frontierBurrowWalkEdge(x,z,p.x,p.z))continue;
     visited.add(k);open.push({x,z,d:p.d+1});
    }
   }
   const publicLoot=R.LOOT.every(p=>dist.has(p.x+','+p.z)),bossDistance=dist.get(R.BOSS.x+','+R.BOSS.z);
   const gateBefore=poiWalkCanStep(R.GATE.x,R.GATE.z,R.GATE.x,R.GATE.z-1),gateRayBefore=poiPlayerRayClear(R.GATE.x,R.GATE.z,0,R.GATE.x,R.GATE.z-1);
   const depths=[];place(34,29);
   for(let x=33;x>=9;x--){
    poiWalkNextReady=0;poiWalkStep(-1,0);
    if(poiWalkX!==x||poiWalkZ!==29)throw Error('failed descent at '+x+' actual '+poiWalkX+','+poiWalkZ);
    depths.push(frontierWalkSurface(x+.5,29.5));
   }
   const depthBounds=[depths[0],depths.at(-1)],region=poiRegionAt(facilitySite,9,29,false,0).name;
   const camera=parameters(),same=stable===facilitySite&&id===poiOtherworldTravelSerial&&entry===poiDungeonEntranceSerial&&poiWalkLevel===0;
   const loot=poiHotbarRead().drops.filter(d=>R.LOOT.some(p=>p.x===d.x&&p.z===d.z));
   const roofBlocked=!poiWalkCanStep(20,32,20,33);
   place(5,41);
   poiPlayerDamageTarget(foe,foe[0].x,foe[0].z,1500,null,performance.now());
   const gateAfter=poiWalkCanStep(R.GATE.x,R.GATE.z,R.GATE.x,R.GATE.z-1);
   place(R.CHEST.x,R.CHEST.z-1);
   poiWalkAction();const chest=poiChestIsOpen(),title=$('poiChestHeading').textContent,
    items=poiHotbarRead().frontierRuinsChest?.slots.filter(Boolean).map(p=>p.type);
   const save=JSON.parse(localStorage.getItem(POI_HOTBAR_KEY));
   return {before,old,fresh,map,bossDistance,stats,mobTypes,publicLoot,gateBefore,gateRayBefore,
    depthBounds,region,same,cameraFinite:camera.vp.every(Number.isFinite),loot:loot.length,roofBlocked,gateAfter,
    chest,title,items,cleared:save.frontierRuinsCleared,progress:save.frontierWest};
  }
 },
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
 const q=await p.evaluate(()=>window.__editorTest.qa398.worldTest());console.log(q);
 a.equal(q.before.x,115);a.equal(q.before.gl,0);a.equal(q.old.x,115);a.equal(q.fresh.x,20);
 a(q.map.w===256&&q.map.h===64&&q.map.trees>230&&q.map.bridge&&!q.map.water&&q.map.temple>210&&new Set(q.map.bits).size===3);
 a(q.bossDistance>=60&&q.stats.hp>=250&&q.mobTypes.filter(x=>x==='monsterGoblin').length>=4&&q.mobTypes.filter(x=>x==='monsterSlime').length>=4);
 a(q.depthBounds[0]>0&&q.depthBounds[1]<-4.5&&q.same&&q.cameraFinite&&q.region==='森の地下遺跡');
 a(q.publicLoot&&q.loot===3&&!q.gateBefore&&!q.gateRayBefore&&q.gateAfter&&q.chest&&q.cleared&&q.progress===1&&q.items.length>=2);
 a.deepEqual(errors,[]);
 console.log('PASS western forest, continuous descent and long route, monsters, boss gate and saved chest');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
