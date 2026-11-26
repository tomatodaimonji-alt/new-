const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa435:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&!!frontierSouthStairGpu,
  run:()=>{
   poiWildClear();poiNextMobTick=Infinity;poiTownNpcNext=Infinity;
   if(!workshopResumeRestorePosition({x:160,z:73,y:0,facing:2,cave:false}))throw Error('entry restore');
   const scene=facilitySite,origin=poiOtherworldTravelSerial,stair=frontierSouthStairGpu, roof=frontierSouthCeilingGpu;
   const begin=poiDungeonEntranceSerial;
   frontierSouthWarmCellar();const cellar=facilityScenes.get('cellar:-1');
   const d=mesh();frontierSouthDoorArt(d);
   let lo=Infinity,hi=-Infinity,low=Infinity,high=-Infinity;
   for(let i=0;i<d.p.length;i+=3){lo=Math.min(lo,d.p[i]);hi=Math.max(hi,d.p[i]);low=Math.min(low,d.p[i+1]);high=Math.max(high,d.p[i+1]);}
   const gateClosed=!frontierSouthDoorWanted(160.5,72.9,null,[]);
   let doorSeen=false;
   const trace=[],now=performance.now();
   poiCameraYaw=0;poiThirdPerson=true;
   const c={id:912,dx:0,dy:-38,last:now-16,moved:true,failures:new Map()};
   poiAnalogContact=c;poiWalkNextReady=0;
   for(let i=0;i<300&&poiWalkZ<82;i++){
    poiAnalogFrame(now+i*16);
    if(poiFreePose){poiWalkViewX=poiFreePose.x;poiWalkViewZ=poiFreePose.z;}
    doorSeen ||= frontierSouthDoorWanted(poiWalkViewX+.5,poiWalkViewZ+.5,poiWalkDoorOpen,[]);
    trace.push({z:poiWalkViewZ,f:poiWalkLevel,h:poiWalkLevel*1.4+poiCreekPlayerHeight(now+i*16)});
    if(!poiAnalogContact)throw Error('analog contact was interrupted');
   }
   const down=[poiWalkX,poiWalkZ,poiWalkLevel],hall=poiWalkCanStep(160,83),blocked=!poiWalkCanStep(154,80);
   c.dy=38;
   for(let i=0;i<300&&poiWalkZ>75;i++){
    poiAnalogFrame((c.last??now)+16);
    if(poiFreePose){poiWalkViewX=poiFreePose.x;poiWalkViewZ=poiFreePose.z;}
    if(!poiAnalogContact)throw Error('analog contact was interrupted on ascent');
   }
   poiAnalogStop();
   const up=[poiWalkX,poiWalkZ,poiWalkLevel];
   return {origin,travel:poiOtherworldTravelSerial,scene:scene===facilitySite,noFade:begin===poiDungeonEntranceSerial,
     down,up,hall,blocked,gateClosed,doorSeen,doorSize:[lo,hi,low,high],
     warm:!!cellar&&cellar===facilityScenes.get('cellar:-1'),noBanner:!poiLocationAnimation,
     verts:[stair.count,roof.count,frontierSouthInteriorGateGpu.count],trace};
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
 await p.waitForFunction(()=>window.__editorTest?.qa435?.ready(),null,{timeout:40000});
 const q=await p.evaluate(()=>window.__editorTest.qa435.run());
 a.deepEqual(q.down,[160,82,-1]);a.deepEqual(q.up,[160,75,0]);
 a.ok(q.hall&&q.blocked&&q.scene&&q.noFade);a.equal(q.travel,q.origin);a.ok(q.verts.every(n=>n>200));
 const grade=q.trace.filter(t=>t.z+.5>76.05&&t.z+.5<80.95);
 a.ok(grade.some(t=>t.f===0)&&grade.some(t=>t.f===-1));
 a.ok(grade.every((t,i)=>i===0||Math.abs(t.h-grade[i-1].h)<.08),'camera height remains continuous');
 a.ok(q.warm&&q.noBanner&&q.gateClosed&&q.doorSeen);
 a.ok(q.doorSize[0]<158.9&&q.doorSize[1]>162.1&&q.doorSize[2]<0&&q.doorSize[3]>2.4);
 a.deepEqual(errors,[]);
 console.log('PASS mobile gate traversal, sealed bounds, prewarmed cellar, silent area label and continuous stair height');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
