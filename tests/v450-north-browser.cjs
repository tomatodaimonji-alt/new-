const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');
a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qaHeavy:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
  profile:async()=>{
   const rows={},stages={},renders={},tally=(name,time)=>{const r=stages[name]??(stages[name]=[0,0,0]);r[0]++;r[1]+=time;r[2]=Math.max(r[2],time);};
   let scope='other';
   const wrap=(id,fn)=>(...args)=>{const prev=scope;scope=id;const t=performance.now();try{return fn(...args)}finally{tally(id,performance.now()-t);scope=prev}};
   const d=draw;
   draw=(m,vp,first=0,count=m?.count??0)=>{if(count){const r=renders[scope]??(renders[scope]=[0,0]);r[0]++;r[1]+=count;}return d(m,vp,first,count)};
   frontierDrawNorth=wrap('north',frontierDrawNorth);frontierDrawWater=wrap('river',frontierDrawWater);
   frontierDrawVillage=wrap('villageFence',frontierDrawVillage);frontierDrawHouse=wrap('houses',frontierDrawHouse);
   frontierDrawMapEdgeRocks=wrap('edges',frontierDrawMapEdgeRocks);frontierDrawSouth=wrap('south',frontierDrawSouth);
   stockGradeDraw=wrap('ground',stockGradeDraw);poiDrawSceneOcclusion=wrap('props',poiDrawSceneOcclusion);
   poiTownResidentsDraw=wrap('residents',poiTownResidentsDraw);poiWalkAvatar=wrap('avatar',poiWalkAvatar);
   poiTownResidentsFrame=wrap('ai',poiTownResidentsFrame);poiWalkFrame=wrap('walk',poiWalkFrame);poiMiniUpdate=wrap('minimap',poiMiniUpdate);
   poiTownClockFrame=wrap('clock',poiTownClockFrame);poiOrchestraTick=wrap('music',poiOrchestraTick);
   const dr=gl.drawArrays.bind(gl);gl.drawArrays=(mode,first,count)=>{if(scope==='props'){const r=renders['propsGL']??(renders['propsGL']=[0,0]);r[0]++;r[1]+=count;}return dr(mode,first,count)};
   const clear=(o)=>{for(const k of Object.keys(o))delete o[k];};
   poiTownNpcNext=Infinity;poiThirdPerson=true;poiCameraYaw=0;poiCameraPitch=.45;
   for(const [x,z] of [[105,-20],[105,-6],[105,2],[105,12],[105,20],[105,26]]){
    if(!workshopResumeRestorePosition({x,z,y:0,facing:2,cave:false})){rows[z]={ok:false};continue;}
    const t=performance.now();clear(stages);clear(renders);
    poiFreePose={x:poiWalkX,z:poiWalkZ,level:0,walking:true,distance:0,angle:0,changed:true};
    poiAnalogContact={id:991,dx:0,dy:-85,last:t,failures:new Map(),moved:true};
    const intervals=[];
    let prior=t;
    for(let i=0;i<8;i++)await new Promise(r=>requestAnimationFrame(now=>{intervals.push(now-prior);prior=now;r()}));
    poiAnalogStop();
    const copy=o=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,v.map(n=>+n.toFixed(2))]));
    rows[z]={ok:true,end:[poiWalkViewX,poiWalkViewZ],intervals:intervals.map(n=>+n.toFixed(1)),stages:copy(stages),renders:copy(renders)};
   }
   return rows;
  }
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
 await p.waitForFunction(()=>window.__editorTest?.qaHeavy?.ready(),null,{timeout:40000});
 const q=await p.evaluate(()=>window.__editorTest.qaHeavy.profile());
 for(const [z,line] of Object.entries(q))console.log('NORTH_ROW '+JSON.stringify({z,...line}));
 a.deepEqual(errors,[]);
 for(const z of [-20,-6,2,12,20])a.ok(q[z]?.ok);
 if(process.env.CHECK_NORTH==='1'){
  for(const z of [-20,-6,2,12,20])a.ok(q[z]?.renders);
  a.equal(q[-20].renders.villageFence,undefined,'do not submit village fence far from camera');
  a.equal(q[-20].renders.river,undefined,'do not submit southern river outside camera');
 }
}finally{if(b)await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
