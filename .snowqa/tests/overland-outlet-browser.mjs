import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const game=readFileSync(process.argv[2]??'dynamic/world-editor.html','utf8');
const key='  overlandStream:()=>poiOverlandInspect(),';assert.equal(game.split(key).length,2);
let h=game.replace(key,key+`
  overlandOutletQA:{savedApproach:()=>workshopResumeRestorePosition({x:124,z:82,y:0,facing:0}),
   signedRoad:()=>{
    for(const o of world.filter(o=>o.type==='shopBagSign'&&o.y===0&&o.x===103&&o.z===113)){
     for(const [dx,dz] of [[0,3],[3,0],[0,-3],[-3,0],[0,5],[5,0],[-5,0],[0,-5]]){
      const x=o.x+dx,z=o.z+dz;
      if(validPos(x,z)&&facilityFloorOwner(x,z,0)===null&&poiWalkCanStep(x,z)&&workshopResumeRestorePosition({x,z,y:0,facing:0}))
       return {x,z,sign:{x:o.x,z:o.z,id:o.type}};
     }
    }
    return null;
   },
   mode:v=>{cameraTopDown=v;dirty=true;cursorDirty=true},
   read:()=>({x:poiWalkX,z:poiWalkZ,until:poiWalkNextReady,now:performance.now(),top:cameraTopDown,
    scene:poiOverlandInspect(),signIds:signOverlays.map(o=>o.id),level:poiWalkLevel,vertices:sceneMesh?.count||0,position:{x:poiWalkViewX,z:poiWalkViewZ},legacy:facilityScenes.size})},`);
for(const [a,b] of [
 [' const p=poiWildPick(rng);',' const p=null;'],
 ['function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;']
]){assert.equal(h.split(a).length,2);h=h.replace(a,b)}
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new vm.Script(body);
if(process.env.OUTLET_PARSE_ONLY){console.log('exact scripts parse');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(q.url==='/seed'?'<!doctype html><title>Outlet</title>':h)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const base='http://127.0.0.1:'+server.address().port;
let b,page,checkpoint='boot';
const read=()=>page.evaluate(()=>window.__editorTest?.overlandOutletQA.read());
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 page=await (await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65})).newPage();
 page.setDefaultTimeout(14000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/seed');await page.evaluate(()=>{
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,townLayout:5,townMapHeight:128,
   position:{x:83,z:107,y:0,facing:3},view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(base+'/?resume=1&test=1'+(process.env.USE_STREAM_DEFAULT?'':'&overland-stream=1'));
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.legacy>0&&!q.scene.drawing});
 await page.evaluate(()=>{
  window.__outletFrames=[];
  function f(now){
   const q=window.__editorTest.overlandOutletQA.read();
   window.__outletFrames.push({now,x:q.x,z:q.z,draw:q.scene.drawing,visible:q.scene.effective,old:q.legacy,bytes:q.scene.bytes,vertices:q.vertices});
   if(window.__outletFrames.length<4500)requestAnimationFrame(f);
  }
  requestAnimationFrame(f);
 });
 let x=83,z=107;
 const path=async(corners)=>{
 for(const [tx,tz] of corners){
  while(x!==tx||z!==tz){
   const dx=Math.sign(tx-x),dz=Math.sign(tz-z);x+=dx;z+=dz;
   checkpoint='actual outlet move '+x+','+z;
   await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.now>=q.until});
   await page.keyboard.press(dx?dx>0?'ArrowRight':'ArrowLeft':dz>0?'ArrowDown':'ArrowUp');
   await page.waitForFunction(({x,z})=>{const q=window.__editorTest.overlandOutletQA.read();return q.x===x&&q.z===z},{x,z});
  }
 }
 };
 await path([[65,107],[65,112],[54,112],[54,119],[49,119],[49,124]]);
 const start=await read();assert(start.scene.drawing&&!start.legacy,'pre-existing base enters warm chunk rendering on approach');
 const inFrames=await page.evaluate(()=>window.__outletFrames);
 assert(inFrames.some(q=>!q.draw&&q.old>0)&&inFrames.some(q=>q.draw&&q.old===0),'real loop exercises both atlas and chunk render paths');
 assert(inFrames.every(q=>q.vertices>0&&q.bytes<=4*1024*1024),'approach never swaps to a blank or over-budget scene');
 const enter=inFrames.findIndex(q=>q.draw);
 const frameGap=enter>0?inFrames[enter].now-inFrames[enter-1].now:null;
 console.log('Actual pre-existing base approach frame switch',JSON.stringify({frameGap,length:inFrames.length}));
 await page.evaluate(()=>{window.__outletFrames.length=0});
 await path([[49,119],[54,119],[54,112],[65,112],[65,107],[83,107]]);
 const end=await read();assert.deepEqual([end.x,end.z],[83,107]);
 const frames=await page.evaluate(()=>window.__outletFrames);
 assert(frames.filter(q=>q.x>=72&&q.z===107).length>=5,'real travel goes beyond the prior forced crop');
 assert(frames.every(q=>q.draw&&q.visible>=1&&q.old===0&&q.bytes<=4*1024*1024),'outdoor route does not silently rebuild the old atlas');
 const gaps=frames.slice(1).map((q,i)=>q.now-frames[i].now).sort((a,b)=>a-b);
 console.log('Actual South Forest outbound draw metrics',JSON.stringify({frames:frames.length,max:gaps.at(-1),p99:gaps[Math.floor(gaps.length*.99)],bytes:Math.max(...frames.map(q=>q.bytes)),end}));
 checkpoint='explicit overhead view remains original';
 await page.evaluate(()=>window.__editorTest.overlandOutletQA.mode(true));
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.top&&!q.scene.drawing&&q.legacy>0});
 await page.evaluate(()=>window.__editorTest.overlandOutletQA.mode(false));
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return !q.top&&q.scene.drawing&&q.legacy===0});
 if(process.env.USE_STREAM_SIGN_PROOF){
  checkpoint='authored south-market sign keeps real texture buffer in streamed perspective';
  const nearby=await page.evaluate(()=>window.__editorTest.overlandOutletQA.signedRoad());
  assert(nearby?.sign?.id==='shopBagSign','select an actual stock outdoor south-market sign approach');
  await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.scene.drawing&&!q.legacy&&q.signIds.includes('shopBagSign')});
  console.log('Actual authored market sign drawn after streamed travel',JSON.stringify({nearby,signIds:(await read()).signIds}));
 }
 checkpoint='actual stock chapel path uses legacy cellar renderer';
 assert.equal(await page.evaluate(()=>window.__editorTest.overlandOutletQA.savedApproach()),true,'use existing save restoration to reach distant chapel approach for this probe');
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.x===124&&q.z===82&&q.level===0&&q.scene.drawing});
 await page.keyboard.press('ArrowUp');
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.level===-1&&q.legacy>0&&!q.scene.drawing&&q.vertices>0});
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.now>=q.until});
 await page.keyboard.press('ArrowDown');
 await page.waitForFunction(()=>{const q=window.__editorTest.overlandOutletQA.read();return q.x===124&&q.z===82&&q.level===0&&q.scene.drawing&&!q.legacy});
 assert.deepEqual(errors,[]);
 console.log('PASS user-visible outlet leaves the prior crop, and explicit overhead renderer remains intact');
}catch(e){console.error(checkpoint,JSON.stringify(await read().catch(()=>null)));throw e}
finally{await b?.close();await new Promise(r=>server.close(r))}
