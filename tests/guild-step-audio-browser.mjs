import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');

const hook='function poiSound(kind,weapon=null,defeated=false){';
function observe(page){
 assert.equal(page.split(hook).length,2);
 return page.replace(hook,`window.__footAudio.warm=()=>poiAudioStart(true);
function poiSound(kind,weapon=null,defeated=false){
 const previous=window.__qaSoundRoute;
 window.__qaSoundRoute={kind,weapon,defeated};
 if(kind==='door'||kind==='step')window.__footAudio.routed.push({...window.__qaSoundRoute,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,inside:poiWalkIndoor()});
 try{return __qaNativeSound(kind,weapon,defeated)}finally{window.__qaSoundRoute=previous}
}
function __qaNativeSound(kind,weapon=null,defeated=false){`);
}
const candidate=observe(html);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':candidate);
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,muted=false}={}){
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const graph=window.__footAudio={routed:[],sounds:[],ctx:null};
  const a=AudioContext.prototype,g=a.createGain,b=a.createBufferSource,o=a.createOscillator;
  a.createGain=function(...args){graph.ctx=this;return g.apply(this,args)};
  const edges=new WeakMap(),connect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...args){
   if(dest instanceof AudioNode)edges.set(this,dest);
   return connect.call(this,dest,...args);
  };
  const monitor=(make,type)=>function(...args){
   const node=make.apply(this,args),start=node.start,ctx=this;
   if(type==='oscillator'){
    const set=node.frequency.setValueAtTime;
    node.frequency.setValueAtTime=function(hz,t){node.__qaPitch=hz;return set.call(this,hz,t)};
   }
   node.start=function(when,...rest){
    const route=window.__qaSoundRoute;
    if(route&&(route.kind==='door'||route.kind==='step')){
     const destination=edges.get(this),tap=destination instanceof BiquadFilterNode;
     const sample=this.buffer?.getChannelData(0);
     const significant=!!sample&&sample.some(n=>Math.abs(n)>.015);
     let fingerprint=1;
     if(sample&&type==='buffer'&&!tap)for(let i=0;i<sample.length;i+=11)fingerprint=(Math.imul(fingerprint,31)^Math.round(sample[i]*30000))>>>0;
     graph.sounds.push({route:route.kind,type:tap?destination.type:type,hz:tap?destination.frequency.value:node.__qaPitch??null,
      delay:Math.round(((when??ctx.currentTime)-ctx.currentTime)*1000),duration:this.buffer?.duration??null,significant,fingerprint});
    }
    return start.call(this,when,...rest);
   };
   return node;
  };
  a.createBufferSource=monitor(b,'buffer');a.createOscillator=monitor(o,'oscillator');
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level,muted})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(muted)localStorage.setItem('world-workshop-audio-v2',JSON.stringify({master:81,bgm:62,se:0,enabled:true}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level,muted});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const audio=page=>page.evaluate(()=>({routed:window.__footAudio.routed,sounds:window.__footAudio.sounds}));
const clear=page=>page.evaluate(()=>{window.__footAudio.routed=[];window.__footAudio.sounds=[]});
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const stock={version:1,weapon:null,potions:3,gold:12};
async function step(page,dir,z,kind,indoors){
 await clear(page);
 await page.locator('[data-poi-dir="'+dir+'"]').tap();
 await page.waitForFunction(z=>window.__editorTest.facility().position.z===z,z);
 const a=await audio(page);
 assert.deepEqual(a.routed.map(r=>[r.z,r.kind,r.inside]),[[z,kind,indoors]],'only the expected sound for the actual destination: '+JSON.stringify(a));
 assert(a.sounds.some(r=>r.significant||r.type==='oscillator'),'real AudioNodes scheduled with nonempty sound: '+JSON.stringify(a));
 assert(a.sounds.every(r=>r.route===kind),'no extra step accompanies the doorway cue');
 await page.waitForTimeout(205);
 return a.sounds;
}
function signature(sounds){
 return sounds.map(a=>[a.type,a.hz==null?null:Math.round(a.hz/50)*50,a.duration,a.fingerprint]);
}
async function walk(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:56,z:40},{facing:0,kit:stock,clockStart:9*60});
 try{
  const map=await getMap(page);
  assert.ok(map.world.some(o=>o.x===56&&o.z===38&&o.y===0&&/Door$/.test(o.type)),'real authored Guild threshold');
  await page.evaluate(()=>document.addEventListener('pointerup',window.__footAudio.warm,{once:true,capture:true}));
  await page.locator('#view').tap({position:{x:160,y:170}});
  await page.waitForFunction(()=>window.__footAudio.ctx?.state==='running');
  const outdoor=await step(page,'n',39,'step',false);
  const door=await step(page,'n',38,'door',true);
  const indoor=await step(page,'n',37,'step',true);
  assert(outdoor.some(e=>e.type==='bandpass')&&outdoor.some(e=>e.type==='oscillator'),'existing outdoor brush and heel remain in use');
  assert.equal(indoor.length,1,'inner floor uses a single short cached PCM source');
  assert(indoor[0].type==='buffer'&&indoor[0].significant&&indoor[0].duration>.07&&indoor[0].duration<.125);
  assert.equal(door.length,1,'true threshold uses one dedicated cue');
  assert(door[0].type==='buffer'&&door[0].significant&&door[0].duration>.14&&door[0].duration<.25);
  assert.notDeepEqual(signature(outdoor),signature(indoor),'sheltered footfall scheduling differs from outdoor footfall');
  assert.notDeepEqual(signature(door),signature(indoor),'door has a distinct contact envelope');
  await step(page,'s',38,'door',true);
  await step(page,'s',39,'step',false);
  assert.deepEqual(await getMap(page),map);await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await walk(browser);
 console.log('PASS real mobile Guild door and indoor/outdoor walking WebAudio routes');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
