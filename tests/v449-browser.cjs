const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');
a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qaGap:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
  run:()=>{
   const report={},x=120.42,z=24.95,t=performance.now();
   poiTownNpcNext=Infinity;poiMonsterStates.clear();
   if(!workshopResumeRestorePosition({x:120,z:25,y:0,facing:2,cave:false,subX:x,subZ:z}))throw Error('restore above the cedar');
   poiThirdPerson=true;poiCameraYaw=0;
   const start=[poiWalkViewX,poiWalkViewZ];
   const drive=(sign,t,target)=>{
    poiAnalogContact={id:993,dx:0,dy:-sign*44,last:t,failures:new Map(),moved:true};
    for(let i=1;i<=130;i++){
     poiWalkFrame(t+i*16);
     if(!poiAnalogContact||sign*(poiWalkViewZ-target)>=0)break;
    }
    const res=[poiWalkViewX,poiWalkViewZ,poiWalkLevel];
    poiAnalogStop();return res;
   };
   const south=drive(1,t,28.07);
   const fine=frontierResumeCoordinates();
   const remount=workshopResumeRestorePosition({x:poiWalkX,z:poiWalkZ,y:0,facing:0,cave:false,...fine});
   const north=drive(-1,t+2300,25.05);
   const cedar=poiWalkObjectsAt(121,26,0).find(o=>o.type==='treeCedar');
   return {start,south,north,fine,remount,cedar:!!cedar,glError:gl.getError()};
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
 await p.waitForFunction(()=>window.__editorTest?.qaGap?.ready(),null,{timeout:40000});
 const q=await p.evaluate(()=>window.__editorTest.qaGap.run());
 console.log('GAP '+JSON.stringify(q));a.deepEqual(errors,[]);
 a.ok(q.cedar&&q.glError===0&&q.south[2]===0&&q.remount&&q.fine.subX>120.35&&q.south[1]>=28.07&&q.north[1]<=25.05);

}finally{if(b)await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
