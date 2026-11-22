import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const map={format:'forest-world-v1',version:1,width:30,height:30,size:30,
 world:[{x:2,y:0,z:2,type:'stonewall',rot:1},{x:15,y:0,z:12,type:'bed',rot:2}],
 models:[],prefabs:[],terrainHeights:[],checks:[]};
const guild={...map,world:[{x:7,y:0,z:6,type:'stonewall',rot:0}]};
const fixtures={
 'forest-world-editor-v1':JSON.stringify(map,null,2),
 'world-workshop-pois-v1':JSON.stringify([
  {id:'poi-guild-primary-v87',name:'ギルド',map:guild},
  {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map:guild}],null,2),
 'pine-guild-screenshot-before-v86':JSON.stringify(guild,null,2),
 'pine-adventurers-guild-poi-before-v102':JSON.stringify({keep:'fixture'}),
 'world-workshop-guild-duplicates-v105':JSON.stringify({version:1,records:[
  {id:'poi-old-archive',name:'冒険者ギルド',map:guild}]}),
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"hp":84,"monsters":[]}',
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const resumeKey='world-workshop-resume-v1';
const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const log=window.__npcGL={large:0,dynamic:0,draws:0,dynamicDraws:0,maxDynamic:0,dynamicBuffers:0};
  for(const type of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
   if(!type)continue;
   const p=type.prototype,bound=new WeakMap(),summaries=new WeakMap();
   for(const method of ['bindBuffer','bufferData','bufferSubData','drawArrays']){
    if(!Object.hasOwn(p,method))continue;
    const original=p[method];
    p[method]=function(...args){
     const result=original.apply(this,args);
     const [target,sourceOrOffset,usageOrSource]=args;
     if(method==='bindBuffer'&&target===this.ARRAY_BUFFER)bound.set(this,sourceOrOffset);
     if(method.startsWith('buffer')&&target===this.ARRAY_BUFFER){
      const buf=bound.get(this);
      const src=method==='bufferData'?sourceOrOffset:usageOrSource,bytes=typeof src==='number'?src:src?.byteLength||0;
      if(bytes>=3000000)log.large++;
      if(buf&&ArrayBuffer.isView(src)&&((method==='bufferData'&&usageOrSource===this.DYNAMIC_DRAW)||(method==='bufferSubData'&&summaries.has(buf)))){
       log.dynamic++;log.maxDynamic=Math.max(log.maxDynamic,bytes);
       if(!summaries.has(buf)){summaries.set(buf,true);log.dynamicBuffers++;}
      }
     }
     if(method==='drawArrays'){
      log.draws++;
      if(summaries.has(bound.get(this)))log.dynamicDraws++;
     }
     return result;
    };
   }
  } ;

 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}

async function trajectory(browser,id,start,clockStart,releaseTime=null){
 const {ctx,page,errors}=await launch(browser,'base',start,{clockStart});
 try{
  await page.waitForFunction(id=>window.__editorTest.townResidents().actors.some(a=>a.id===id&&a.visual),id);
  if(releaseTime!==null)await page.evaluate(t=>window.__editorTest.setTownTime(t),releaseTime);
  const {samples,pre,post}=await page.evaluate(({id,ms})=>new Promise(resolve=>{
   const samples=[],pre={...window.__npcGL},start=performance.now();
   function onFrame(t){
    const a=window.__editorTest.townResidents().actors.find(a=>a.id===id);
    if(a?.visual)samples.push({frame:t,activity:a.activity,cell:[a.x,a.z,a.y],draw:window.__npcGL.dynamicDraws,...a.visual});
    if(t-start<ms)requestAnimationFrame(onFrame);else resolve({samples,pre,post:{...window.__npcGL}});
   }
   requestAnimationFrame(onFrame);
  }),{id,ms:4500});
  const active=samples.filter(a=>a.moving&&a.t>.04&&a.t<.97&&Number.isFinite(a.x)&&Number.isFinite(a.z));
  assert.ok(active.length>=4,id+' has actual intermediate rendered walk samples: '+JSON.stringify(samples.slice(0,8)));
  const byTile=new Map();
  for(const a of active){const k=a.cell.join(',');if(!byTile.has(k))byTile.set(k,[]);byTile.get(k).push(a);}
  const candidate=[...byTile.values()].find(rows=>{
   const unique=new Set(rows.map(a=>[a.x.toFixed(3),a.z.toFixed(3)].join(',')));
   const progress=rows.map(a=>a.t);
   return unique.size>=3&&new Set(rows.map(a=>a.draw)).size>=3&&Math.max(...progress)-Math.min(...progress)>.22;
  });
  assert.ok(candidate,id+' interpolates through >=3 visible points during a single logical cell, not index snap');
  const step=candidate[0].cell;
  assert.ok(candidate.every(a=>a.cadence<=33),'visible nearby walk uses 30 Hz mesh sample cadence');
  assert.ok(candidate.every(a=>Math.abs(a.x-step[0])+Math.abs(a.z-step[1])<=1.01),'rendered NPC must remain within one traversed grid cell');
  assert.ok(candidate.every((a,i)=>i===0||a.t>=candidate[i-1].t),'rendered phase progresses forward while logical tile held');
  assert.ok(pre.large>0,'WebGL probe first observes real static mesh upload');
  assert.equal(post.dynamicBuffers,pre.dynamicBuffers,'walking reuses the actor VBO identity');
  assert.equal(post.large,pre.large,id+' walking must not rebuild or upload the static town mesh');
  assert.ok(post.dynamic>pre.dynamic&&post.dynamicDraws>pre.dynamicDraws,'real actor buffer upload and draw still occur');
  await unchanged(page);assert.deepEqual(errors,[]);
  console.log(id+' '+JSON.stringify({frameSamples:samples.length,oneStep:candidate.map(({x,z,t})=>({x,z,t})),dynamicUploads:post.dynamic-pre.dynamic,staticUploads:post.large-pre.large}));
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trajectory(browser,'westpeddler',{x:44,z:43},11*60+42,12*60);
 await trajectory(browser,'resadventurer',{x:58,z:40},8*60+30);
 console.log('PASS actual mobile Chromium renders sub-tile motion for pedestrian and adventurer without static mesh uploads; saves preserved');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
