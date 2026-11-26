const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');
a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qaHeavy:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
  run:()=>{
   if(!workshopResumeRestorePosition({x:100,z:30,y:0,facing:1,cave:false}))throw Error('restore');
   const stats={},av=new Set(),creates=new Map(),bufferSizes=new Map();let frame='outside',scope='none';
   const wrap=(key,fn)=>(...args)=>{
    const old=scope,t=performance.now();scope=key;
    try{return fn(...args)}finally{
     scope=old;
     const o=stats[frame+':'+key]??(stats[frame+':'+key]=[0,0,0]);
     const dt=performance.now()-t;o[0]++;o[1]+=dt;o[2]=Math.max(o[2],dt);
    }
   };
   const glCreate=gl.createBuffer.bind(gl),glData=gl.bufferData.bind(gl);
   gl.createBuffer=(...args)=>{creates.set(scope,(creates.get(scope)||0)+1);return glCreate(...args)};
   gl.bufferData=(target,d,usage)=>{if(d?.byteLength){const o=bufferSizes.get(scope)||[0,0];o[0]+=d.byteLength;o[1]++;bufferSizes.set(scope,o);}return glData(target,d,usage)};
   poiWalkAvatar=wrap('avatar',poiWalkAvatar);
   poiTownResidentsDraw=wrap('residents',poiTownResidentsDraw);
   poiMiniUpdate=wrap('minimap',poiMiniUpdate);
   const t=performance.now();
   poiTownNpcNext=Infinity;poiThirdPerson=true;poiCameraYaw=-Math.PI*.5;poiCameraPitch=.55;
   const start=poiWalkViewX;
   poiFreePose={x:poiWalkX,z:poiWalkZ,level:0,walking:true,distance:0,angle:-Math.PI/2,changed:true};
   poiAnalogContact={id:991,dx:0,dy:-85,last:t,failures:new Map(),moved:true};
   const n=80;
   for(let i=0;i<n;i++){
    const now=t+(i+1)*32;
    poiWalkFrame(now);av.add(poiWalkMesh?.buf);
    const p=parameters();poiTownResidentsDraw(now,p.vp);
   }
   const walked=poiWalkViewX-start,poseSync=poiWalkMesh?.count>0;
   poiAnalogStop();poiFreeCenter();
   return {walked,vertexBuffers:av.size,poseSync,stats:Object.fromEntries(Object.entries(stats).map(([k,v])=>[k,v.map(n=>+n.toFixed(2))])),creates:Object.fromEntries(creates),buffers:Object.fromEntries(bufferSizes)};
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
 const q=await p.evaluate(()=>window.__editorTest.qaHeavy.run());
 console.log('HEAVY '+JSON.stringify(q));
 a.deepEqual(errors,[]);
 a.ok(Math.abs(q.walked)>2&&q.poseSync);
 if(process.env.CHECK_HEAVY==='1')a.equal(q.vertexBuffers,1);
}finally{if(b)await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
