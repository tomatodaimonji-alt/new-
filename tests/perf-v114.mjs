import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const files=process.argv.slice(2);
assert(files.length>=1,'provide one or more HTML paths (baseline then candidates)');
const server=createServer((req,res)=>{
 const match=req.url.match(/^\/(\d+)(?:\?|$)/);
 if(!match||!files[Number(match[1])]){res.writeHead(404).end();return;}
 res.setHeader('Content-Type','text/html; charset=UTF-8');
 res.end(readFileSync(files[Number(match[1])]));
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const base='http://127.0.0.1:'+server.address().port;
const layers=['forest-world-editor-v1','world-workshop-pois-v1','world-workshop-adventure-v1'];
const savedMap={format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:0}],terrainHeights:[],models:[],prefabs:[]};
const fixtures={
 [layers[0]]:JSON.stringify(savedMap,null,2),
 [layers[1]]:JSON.stringify([{id:'poi-guild-primary-v87',name:'ギルド',map:savedMap}],null,2),
 [layers[2]]:JSON.stringify({version:1,x:23,z:24,monsters:[]},null,2)
};
function spyWebGl(fixtures){
 const stats={renders:[],draws:0,triangles:0,frame:null,live:0,peak:0,uploads:0,totalUploaded:0,largest:0};
 const state=new WeakMap();
 window.__perf=stats;
 for(const [k,v] of Object.entries(fixtures))if(localStorage.getItem(k)===null)localStorage.setItem(k,v);
 function install(proto){
  const glstate=g=>{let s=state.get(g);if(!s)state.set(g,s={bound:new Map(),size:new WeakMap()});return s;};
  const {bindBuffer,bufferData,deleteBuffer,drawArrays,drawElements,clear}=proto;
  if(!bindBuffer||bindBuffer.__measured)return;
  const bind=function(target,buf){
   const s=glstate(this);s.bound.set(target,buf);
   return bindBuffer.apply(this,arguments);
  };
  bind.__measured=true;
  proto.bindBuffer=bind;
  proto.bufferData=function(target,payload){
   const s=glstate(this),buf=s.bound.get(target),len=typeof payload==='number'?payload:payload?.byteLength??0;
   if(buf){stats.live+=len-(s.size.get(buf)||0);s.size.set(buf,len);}
   stats.peak=Math.max(stats.peak,stats.live);stats.uploads++;stats.totalUploaded+=len;
   stats.largest=Math.max(stats.largest,len);
   return bufferData.apply(this,arguments);
  };
  proto.deleteBuffer=function(buf){
   const s=glstate(this);
   if(buf){stats.live-=s.size.get(buf)||0;s.size.delete(buf);}
   return deleteBuffer.apply(this,arguments);
  };
  function account(gl,mode,count){
   stats.draws++;
   if(mode===gl.TRIANGLES)stats.triangles+=count/3;
   else if(mode===gl.TRIANGLE_STRIP||mode===gl.TRIANGLE_FAN)stats.triangles+=Math.max(0,count-2);
  }
  proto.drawArrays=function(mode,first,count){account(this,mode,count);return drawArrays.apply(this,arguments);};
  proto.drawElements=function(mode,count){account(this,mode,count);return drawElements.apply(this,arguments);};
  proto.clear=function(){
   if(stats.frame!==null){
    stats.renders.push({draws:stats.draws,triangles:stats.triangles,ms:performance.now()-stats.frame});
    if(stats.renders.length>360)stats.renders.shift();
   }
   stats.draws=0;stats.triangles=0;stats.frame=performance.now();
   return clear.apply(this,arguments);
  };
 }
 if(window.WebGLRenderingContext)install(WebGLRenderingContext.prototype);
 if(window.WebGL2RenderingContext)install(WebGL2RenderingContext.prototype);
}
const modeOf=arr=>[...arr.reduce((m,v)=>m.set(v,(m.get(v)||0)+1),new Map())].sort((a,b)=>b[1]-a[1])[0]?.[0];
async function snapshot(p){
 await p.waitForFunction(()=>window.__perf?.renders.length>=8,{},{timeout:20000});
 return await p.evaluate(()=>{
  const s=window.__perf,m=window.__editorTest.data(),c=document.getElementById('view'),f=window.__editorTest.facility?.();
  const rect=id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return [r.x,r.y,r.width,r.height].map(Math.round)};
  return {objects:m.world.length,terrainEntries:m.terrainHeights.length,dimensions:[m.width,m.height],
   canvas:[c.clientWidth,c.clientHeight,c.width,c.height],visibleRoofMeshes:f?.visibleRoofs?.length??null,
   palette:rect('palette'),dpad:rect('poiWalkPad'),letterbox:rect('viewWrap'),
   bytes:{live:s.live,peak:s.peak,largest:s.largest,total:s.totalUploaded},uploads:s.uploads,
   recent:s.renders.slice(-8),save:Object.fromEntries(['forest-world-editor-v1','world-workshop-pois-v1','world-workshop-adventure-v1'].map(k=>[k,localStorage.getItem(k)]))};
 });
}
function report(v){
 const {recent,save,...m}=v;
 assert.deepEqual(save,fixtures,'original saves must not change');
 return {...m,drawCallsPerFrame:modeOf(recent.map(o=>o.draws)),
  trianglesPerFrame:modeOf(recent.map(o=>o.triangles)),
  medianSoftwareFrameMs:Math.round(recent.map(o=>o.ms).sort((a,b)=>a-b)[4])};
}
const meshLimit=Number(process.env.PERF_MESH_LIMIT??1.45);
const objectDelta=Number(process.env.PERF_OBJECT_DELTA??170);
assert(meshLimit>=1&&meshLimit<=1.45&&Number.isFinite(objectDelta)&&objectDelta>=0);
let browser, prior=null;
function cap(n,baseline,max,description){
 assert.ok(n<=Math.ceil(baseline*max),`${description}: ${n}, baseline ${baseline}, maximum +${Math.round((max-1)*100)}%`);
}
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [i,file] of files.entries()){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2.75,isMobile:true,hasTouch:true});
  await context.addInitScript(spyWebGl,fixtures);
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/'+i+'?facility=base&test=1');
  await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='editor');
  const editor=report(await snapshot(page));
  await page.evaluate(()=>{window.__perf.renders.length=0;});
  await page.locator('#enterGameWorld').tap();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
  const play=report(await snapshot(page));
  assert.deepEqual(errors,[]);
  // Compare static WebGL work, not renderer timing, across exactly the same phone viewport.
  // Median captured here is advisory desktop SwiftShader time, not Android FPS.
  console.log(JSON.stringify({file,editor,play},null,2));
  for(const observation of [editor,play]){
   assert.ok(observation.trianglesPerFrame>=100&&observation.drawCallsPerFrame>=1,
    'WebGL metrics must come from a real rendered base frame');
   assert.ok(observation.canvas[0]<=390&&observation.canvas[1]<=844,'mobile canvas must fit viewport');
  }
  if(prior){
   for(const [phase,obs,old] of [['editor',editor,prior.editor],['play',play,prior.play]]){
    assert.deepEqual(obs.canvas,old.canvas,phase+' canvas does not grow its pixel budget');
    assert.ok(obs.drawCallsPerFrame<=old.drawCallsPerFrame+2,phase+' actual GL draw calls');
    cap(obs.trianglesPerFrame,old.trianglesPerFrame,meshLimit,phase+' submitted triangle budget');
    cap(obs.bytes.live,old.bytes.live,meshLimit,phase+' live VBO byte budget');
    cap(obs.bytes.largest,old.bytes.largest,meshLimit,phase+' largest upload byte budget');
   }
   assert.ok(play.objects-prior.play.objects<=objectDelta,'new landscape keeps authored tile/object records bounded');
  }else prior={editor,play};
  await context.close();
 }
} finally {
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
