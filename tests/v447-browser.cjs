const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa447:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.length>5,
  begin:()=>{
   const all={},wrap=(id,fn)=>(...args)=>{
    const t=performance.now();try{return fn(...args)}finally{const ms=performance.now()-t,o=all[id]??(all[id]=[0,0,0]);o[0]++;o[1]+=ms;o[2]=Math.max(o[2],ms);}
   };
   poiWalkCanStep=wrap('collision',poiWalkCanStep);
   poiWalkEnterCell=wrap('enter cell',poiWalkEnterCell);
   poiTownResidentsDraw=wrap('residents draw',poiTownResidentsDraw);
   poiTownResidentsFrame=wrap('residents logic',poiTownResidentsFrame);
   poiWalkAvatar=wrap('avatar',poiWalkAvatar);
   poiMiniUpdate=wrap('map update',poiMiniUpdate);
   poiMiniMotionFrame=wrap('map motion',poiMiniMotionFrame);
   frontierDrawHouse=wrap('houses',frontierDrawHouse);
   poiWalkFrame=wrap('walk frame',poiWalkFrame);
   poiTownClockFrame=wrap('clock',poiTownClockFrame);
   window.profileStats=()=>Object.fromEntries(Object.entries(all).map(([k,v])=>{delete all[k];return [k,v.map(n=>+n.toFixed(2))]}));
   return world.length;
  },
  scene:()=>{
   const vp=parameters().vp,omissions=stockAtlasSceneOmissions(sceneMesh,vp);
   return {total:sceneMesh?.count??0,skipped:omissions?.reduce((n,[a,b])=>n+b-a,0)??0,groupCount:sceneMesh?.stockAtlasBounds?.length??0,layer:poiWalkLevel,indoor:poiWalkIndoor()};
  },
  step:(x,z,dx,dz,count)=>{
   if(!workshopResumeRestorePosition({x,z,y:0,facing:1,cave:false}))return {bad:[x,z]};
   profileStats();
   let n=0;
   const start=performance.now();
   for(let j=0;j<count;j++){
    const fx=poiWalkX+dx,fz=poiWalkZ+dz;
    if(!poiWalkCanStep(fx,fz,poiWalkX,poiWalkZ,undefined,true,true))break;
    poiWalkEnterCell(dx,dz,start+j*15,true);n++;
   }
   return {n,x:poiWalkX,z:poiWalkZ,profile:profileStats()};
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
 await p.waitForFunction(()=>window.__editorTest?.qa447?.ready(),null,{timeout:40000});
 console.log('objects',await p.evaluate(()=>window.__editorTest.qa447.begin()));
 let maxSkipped=0;
 for(const loc of [[94,30,1,0,14],[108,30,1,0,12],[115,30,0,-1,7],[102,29,0,-1,6]]){
  const result=await p.evaluate(async loc=>{
   const q=window.__editorTest.qa447.step(...loc);
   for(let i=0;i<14;i++)await new Promise(r=>requestAnimationFrame(r));
   return {...q,render:profileStats(),scene:window.__editorTest.qa447.scene()};
  },loc);
  console.log('PROFILE',JSON.stringify({loc,...result}));
  a.equal(result.n,loc[4]);a.equal(result.scene.layer,0);a.ok(result.scene.groupCount>5);maxSkipped=Math.max(maxSkipped,result.scene.skipped);
 }
 a.ok(maxSkipped>10000, 'real village frames omit wholly offscreen triangles');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
