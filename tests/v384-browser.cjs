const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
let html=fs.readFileSync('world-editor.html','utf8'),marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 terrainQA:{
  sample:()=>{
   const shop=facilitySite.buildings.find(b=>b.id==='frontierStore');
   let overlaps=0;
   for(let z=shop.z1;z<=shop.z2;z++)for(let x=shop.x1;x<=shop.x2;x++)overlaps+=frontierVillageFence(x,z)?1:0;
   const clearance=frontierVillageArcs().flat().reduce((m,[x,z])=>Math.min(m,
    Math.hypot(Math.max(shop.x1-x,x-shop.x2-1,0),Math.max(shop.z1-z,z-shop.z2-1,0))),Infinity);
   const trees=world.filter(o=>o.y===0&&frontierTreeTrunkType(o.type)&&o.x<100);
   const index=new Map(trees.map(o=>[o.x+','+o.z,o]));
   const step=(x,z,fromX,fromZ)=>poiWalkCanStep(x,z,fromX,fromZ,undefined,true,true);
   let gap=null;
   for(const tree of trees){
    const {x,z}=tree;
    if(!index.has((x+1)+','+z)||!step(x,z))continue;
    const common=frontierMovementClip(null,x+.5,z);
    const start=z-1.05,move=poiFreeAdvance(x+.5,start,0,2.10,POI_FREE_RADIUS,step,()=>true,common);
    const stop=poiFreeAdvance(x,start,0,1.05,POI_FREE_RADIUS,step,()=>true,common);
    if(move.z>=z+1&&stop.z<z-.25){gap={x,z,through:move.z,blocked:stop.z};break}
   }
   const now=performance.now(),hero=poiAimOrigin(now),a={id:'human:frontiersera',x:hero.x+4,z:hero.z},b={id:'human:frontierren',x:hero.x+4,z:hero.z};
   const targets=[frontierFollowTarget(a,hero,now),frontierFollowTarget(b,hero,now)];
   const state={},clip=(p,q,next)=>Math.min(next,.6);
   const push=[0,140,280,420,560,700,840].map(dt=>frontierPlayerTrafficClip(state,clip,now+dt,1)(0,0,1,false));
   const hard=poiFreeAdvance(0,0,1,0,POI_FREE_RADIUS,()=>false,()=>true,frontierPlayerTrafficClip(state,clip,now+900,1));
   const pair=[{x:0,z:.4}],swept=frontierNpcSweepBlocked(0,0,0,1,pair),goAround=!frontierNpcSweepBlocked(.55,0,.55,1,pair);
   return {overlaps,clearance,gap,targets,push,hard:hard.x,swept,goAround,styles:[a.followStyle,b.followStyle]};
  },
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 const q=await p.evaluate(()=>window.__editorTest.terrainQA.sample());console.log(q);
 a.equal(q.overlaps,0);a(q.clearance>.80);a(q.gap);a.notDeepEqual(q.targets[0],q.targets[1]);a.notEqual(q.styles[0].stop,q.styles[1].stop);
 a.deepEqual(q.push,[.6,.6,.6,.6,.6,1,1]);a(q.hard<=.30);a(q.swept&&q.goAround);a.deepEqual(errors,[]);
 console.log('PASS real Frontier tree gap opens, trunk/wall block, shop fence clear, peer collision and gentle formation');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
