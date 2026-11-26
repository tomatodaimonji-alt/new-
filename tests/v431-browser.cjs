const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa431:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&!!frontierSouthMeshes,
  setup:()=>{
   poiWildClear();poiNextMobTick=Infinity;
   return workshopResumeRestorePosition({x:160,z:73,y:0,facing:2,cave:false})
  },
  state:()=>({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,site:facilitySite.id,cave:frontierPlayCave,
    name:poiRegionAt(facilitySite,poiWalkX,poiWalkZ,false,poiWalkLevel).name}),
  frame:()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))),
  walk:(dz)=>{poiWalkNextReady=0;return poiWalkStep(0,dz)},
  content:()=>{
   const os=[...poiMonsterStates].filter(([o])=>frontierSouthRecordId(o));
   return {width:MAP_W,height:MAP_H,depth:os.length,y:os.map(([o])=>o.y),
    visible:poiDungeonVisualVisible(160,122,-1),gate:poiWalkCanStep(160,74),edge:!validPos(127,64),
    east:poiTownNpcStance({x:148,z:65,y:0})}
  },
  floor:()=>({hall:poiWalkCanStep(160,78),void:!poiWalkCanStep(160,75),ledger:poiLocalBit(160,78),
    path:poiTownNpcStance({x:160,z:78,y:-1})}),
  startExpedition:()=>{
   poiTownClockSetTest(FRONTIER_EXPEDITION_DEPART);
   const now=performance.now();
   frontierExpeditionTick(poiTownClockSnapshot(),now);
   return poiHotbarRead().frontierExpedition;
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
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:70000});
 await p.waitForFunction(()=>window.__editorTest?.qa431?.ready(),null,{timeout:40000});
 const via=(m,arg)=>p.evaluate(([m,arg])=>window.__editorTest.qa431[m](arg),[m,arg]);
 a.equal(await via('setup'),true);await via('frame');
 const top=await via('content');a.deepEqual([top.width,top.height,top.depth],[256,128,13]);
 a.ok(top.gate&&top.edge&&top.east&&top.y.every(y=>y===-1));a.equal(top.visible,false);
 for(let i=0;i<4;i++)await via('walk',1);await via('frame');
 a.deepEqual(await via('state'),{x:160,z:77,y:-1,site:'frontier',cave:false,name:'灰刻の地下遺跡'});
 const fl=await via('floor');a.ok(fl.hall&&fl.void&&fl.path);a.ok(fl.ledger>=20480);
 a.equal((await via('content')).visible,true);
 await via('walk',1);await via('walk',-1);await via('frame');
 a.equal((await via('state')).y,0);
 const exp=await via('startExpedition');
 a.equal(exp?.phase,'out');a.ok(exp?.positions?.frontierregna);a.ok(exp?.positions?.frontierlyzel);
 a.deepEqual(errors,[]);
 console.log('PASS mobile scene, stone gate, stair down/up, blocked underground void, surface visibility and real expedition departure');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
