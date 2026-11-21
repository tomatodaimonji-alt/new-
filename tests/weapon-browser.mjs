import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=process.argv[3]&&readFileSync(process.argv[3]);
const trigger='  spawn={x:19,z:21};';
assert.equal(html.toString().split(trigger).length,2,'temporary QA monster anchor');
const inject=bytes=>bytes.toString().replace(trigger,"  put(20,21,'monsterDragon');\n"+trigger);
const combat=inject(html),oldCombat=baseline&&inject(baseline);
const lethal=combat.replace("put(20,21,'monsterDragon')","put(20,21,'monsterSlime')");
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?baseline:req.url.startsWith('/old-combat')?oldCombat:req.url.startsWith('/lethal')?lethal:req.url.startsWith('/combat')?combat:html);
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
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const mini='#poiMiniHud',party='#poiPartyHud',pad='#poiWalkPad',hpValue='#poiPlayerHpValue';
const bar='#poiHotbar',key='world-workshop-hotbar-v1',ai='#pineAIPlanCapture';
const controls=[pad,'[data-poi-dir=n]','[data-poi-dir=s]','[data-poi-dir=e]','[data-poi-dir=w]','#poiWalkAction'];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const confirmText=async (page,css,want)=>assert.equal((await page.locator(css).textContent()).trim(),want,css);
const snapshot=async (page,name)=>{if(out){await settle(page);await page.screenshot({path:out+'/v125-'+name+'.png'});}};
async function initialize(browser,width,height,prefix='/',opts={}){
 const mobile=width<800,ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 await ctx.addInitScript(observe);
 const page=await ctx.newPage(),errors=[],requests=[];
 page.on('request',req=>requests.push({url:req.url(),type:req.resourceType()}));
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 const {id='base',mode='facility',x,z,y=0,legacy}=opts;
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,mode,x,z,y,legacy})=>{
  Object.entries(fixtures).forEach(([k,v])=>localStorage.setItem(k,v));
  if(legacy)localStorage.setItem('world-workshop-adventure-v1',JSON.stringify(legacy));
  if(Number.isInteger(x))localStorage.setItem(resumeKey,JSON.stringify({version:1,route:mode,id,play:true,position:{x,z,y,facing:1}}));
 },{fixtures,resumeKey,id,mode,x,z,y,legacy});
 const query=Number.isInteger(x)?'?resume=1&test=1':'?facility='+id+'&test=1';
 await page.goto(origin+prefix+query);
 if(mode==='facility')await page.waitForFunction(id=>window.__editorTest?.facility?.().id===id,id);
 else await page.locator('#poiWalkPad.active').waitFor({state:'visible'});
 await settle(page);
 const documentRoots=[origin+'/seed',origin+prefix+query];
 for(const req of requests)assert.ok(req.type==='document'&&documentRoots.includes(req.url),'self-contained boot must not fetch assets: '+req.url);
 requests.length=0;
 await ctx.setOffline(true);
 await page.waitForFunction(()=>navigator.onLine===false);
 return {page,ctx,errors,mobile,offline:()=>assert.deepEqual(requests,[],'no network fetch required for input, sounds, or icon')};
}
async function press(page,css,mobile){
 const loc=page.locator(css);
 if(mobile)await loc.tap();else await loc.click();
}
async function noHud(page){
 for(const css of [mini,party,bar])assert.equal(await page.locator(css).isVisible(),false,css+' must not show');
}
async function box(page,css){
 const rect=await page.locator(css).boundingBox();assert.ok(rect,css+' visible with measurable dimensions');return rect;
}
const intersects=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
const contained=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.width<=b.x+b.width+1&&a.y+a.height<=b.y+b.height+1;
async function buttons(page){
 const elements=page.locator('#poiGameTools button:visible, #quickTools button:visible, #poiSoundPanel:visible');
 const rects=[];
 for(const el of await elements.all()){
  const r=await el.boundingBox();if(r)rects.push([await el.getAttribute('id'),r]);
 }
 return rects;
}
const slot=(page,i)=>page.locator(bar+' button[data-hotbar-slot="'+i+'"]');
const store=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
function observe(){
 const contexts=[],starts=[],nodes=new WeakMap(),buffers=new WeakMap(),digests=[];
 let serial=0;
 const native=window.AudioContext;
 function param(p){
  const ops=[];
  for(const method of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime']){
   const original=p[method].bind(p);
   p[method]=function(...args){ops.push([method,...args]);return original(...args);};
  }
  return ops;
 }
 function inspectPcm(buffer){
  if(!buffer)return null;
  if(buffers.has(buffer))return buffers.get(buffer);
  const signal=buffer.getChannelData(0),rate=buffer.sampleRate;
  const bytes=new Uint8Array(signal.length*2),dv=new DataView(bytes.buffer);
  let exact16=true;
  for(let i=0;i<signal.length;i++){
   const signed16=signal[i]*32768;
   exact16&&=Number.isInteger(signed16)&&signed16>=-32768&&signed16<=32767;
   dv.setInt16(i*2,Math.round(signed16),true);
  }
  const rms=(from,to)=>{
   let n=0,sum=0;
   for(let i=Math.floor(from*rate);i<Math.min(signal.length,Math.ceil(to*rate));i++){sum+=signal[i]*signal[i];n++;}
   return Math.sqrt(sum/Math.max(1,n));
  };
  let peak=0,allFinite=true;
  for(const sample of signal){peak=Math.max(peak,Math.abs(sample));allFinite&&=Number.isFinite(sample);}
  const result={id:++serial,channels:buffer.numberOfChannels,frames:signal.length,rate,duration:buffer.duration,
   peak,allFinite,exact16,head:rms(.004,.025),body:rms(.03,.065),sustain:rms(.10,.24),tail:rms(buffer.duration*.78,buffer.duration),last:signal.at(-1)};
  buffers.set(buffer,result);
  digests.push(crypto.subtle.digest('SHA-256',bytes).then(hash=>{
   result.sha256=Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
  }));
  return result;
 }
 function wrap(node,kind,ctx){
  const info={kind,next:null,gain:node.gain&&param(node.gain),frequency:node.frequency&&param(node.frequency)};
  nodes.set(node,info);
  const connect=node.connect.bind(node);
  node.connect=function(dest,...args){info.next=dest;return connect(dest,...args);};
  if(node.start){
   const start=node.start.bind(node);
   node.start=function(...args){
    const shape=(n,depth)=>{const i=nodes.get(n);return i&&depth>0?{
     kind:i.kind,type:n.type??null,hz:n.frequency?.value??null,q:n.Q?.value??null,volume:n.gain?.value??null,
     gain:i.gain?.slice(),frequency:i.frequency?.slice(),next:shape(i.next,depth-1)
    }:null;};
    const clock=ctx.currentTime,graph=shape(node,6);
    const pcm=kind==='source'&&!node.loop&&graph.next?.kind==='gain'?inspectPcm(node.buffer):null;
    starts.push({kind,loop:node.loop??false,when:args[0]??null,shape:graph,pcm,clock});
    return start(...args);
   };
  }
  return node;
 }
 class Spy extends native{
  constructor(...a){super(...a);contexts.push(this);}
  createOscillator(){return wrap(super.createOscillator(),'osc',this);}
  createBufferSource(){return wrap(super.createBufferSource(),'source',this);}
  createBiquadFilter(){return wrap(super.createBiquadFilter(),'filter',this);}
  createGain(){return wrap(super.createGain(),'gain',this);}
 }
 window.AudioContext=Spy;
 window.__comfort={contexts,starts,digests};
}
const events=page=>page.evaluate(async()=>{await Promise.all(window.__comfort.digests);return window.__comfort.starts;});
const lastTarget=n=>n.gain.filter(v=>v[0]==='setTargetAtTime').at(-1)?.[1];
const exact=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,label+': expected '+b+', got '+a);
const peak=n=>n.gain.find(v=>v[0]==='linearRampToValueAtTime')?.[1];
const decay=n=>n.gain.find(v=>v[0]==='exponentialRampToValueAtTime')?.[2]-n.gain.find(v=>v[0]==='setValueAtTime')?.[2];
const onset=n=>n.gain.find(v=>v[0]==='linearRampToValueAtTime')?.[2]-n.gain.find(v=>v[0]==='setValueAtTime')?.[2];
function sfx(records){
 return records.flatMap(r=>{
  const {shape}=r;
  if(r.pcm){
   const g=shape.next;exact(lastTarget(g.next),.90*.88,'PCM uses existing SE bus');
   const pcmKind=r.pcm.duration<.4?'wood-pcm':'wet-pcm';
   return [{hz:pcmKind,peak:g.volume,pcm:r.pcm,when:r.when,clock:r.clock}];
  }
  if(r.kind==='source'&&!r.loop&&shape.next?.kind==='filter'){
   const g=shape.next.next;exact(lastTarget(g.next),.90*.88,'SE bus');return [{hz:shape.next.frequency?.[0]?.[1]??shape.next.hz,low:shape.next.frequency?.[1]?.[1],peak:peak(g),onset:onset(g),decay:decay(g),when:r.when}];
  }
  if(r.kind==='osc'&&shape.frequency.length===2){
   const g=shape.next;exact(lastTarget(g.next),.90*.88,'SE bus');return [{hz:shape.frequency[0][1],low:shape.frequency[1][1],peak:peak(g),onset:onset(g),decay:decay(g),when:r.when}];
  }
  return [];
 });
}

const swordIcon='#poiHotbar [data-hotbar-slot="1"] canvas[data-item-model="equipWoodSword"]';
const attack='#poiWalkAction';
// PCM-data SHA-256 from the owner-approved WAVs (RIFF headers excluded).
const approved={
 wood:{frames:5568,duration:.232,peak:28999,sha:'5c17aa94957de450ca20b65a609c43f53518241161bcad0132c41d4d4bf6dbae'},
 wet:{frames:13680,duration:.570,peak:29326,sha:'1a49f600444177ccd10f7eaa6c209e58cebc71e7df99dd7aaaf9b4c4279fd002'}
};
function approvedPcm(pcm,key){
 assert.deepEqual([pcm.channels,pcm.rate,pcm.frames],[1,24000,approved[key].frames],'approved mono 24k frame count '+key);
 assert.ok(pcm.allFinite&&pcm.exact16,'decoded integers converted exactly to native PCM '+key);
 assert.equal(pcm.sha256,approved[key].sha,'every decoded sample matches the selected WAV '+key);
 exact(pcm.duration,approved[key].duration,'exact clip length '+key);
 exact(pcm.peak,approved[key].peak/32768,'native decoded peak '+key);
}
const woodSwing=[940,1630,126],woodHit=['wood-pcm'],handSwing=[790,1120,145],handHit=[1500,230],wetDeath=['wet-pcm'];
async function activate(page){
 await press(page,'#enterGameWorld',true);
 await page.waitForFunction(()=>window.__editorTest.facility().active&&window.__comfort.contexts.some(c=>c.state==='running'));
}
async function iconModel(page){
 const loc=page.locator(swordIcon);
 await loc.waitFor({state:'visible'});
 const model=await loc.evaluate(c=>{
  const canvas=document.createElement('canvas');canvas.width=c.width;canvas.height=c.height;
  const ctx=canvas.getContext('2d');ctx.drawImage(c,0,0);
  const pixels=ctx.getImageData(0,0,c.width,c.height).data,colors=new Set();
  let opaque=0;
  for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>90){opaque++;colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);}
  return {width:c.width,height:c.height,opaque,colors:colors.size,uri:canvas.toDataURL()};
 });
 assert.deepEqual([model.width,model.height],[96,96],'model icon backing buffer');
 assert.ok(model.opaque>180&&model.opaque<model.width*model.height*.8&&model.colors>=3,'wood model is nonblank, shaded, and transparent around the blade');
 return model;
}
const onSurface=(inside,outside)=>inside.x>=outside.x-1&&inside.y>=outside.y-1&&inside.x+inside.width<=outside.x+outside.width+1&&inside.y+inside.height<=outside.y+outside.height+1;
async function verifyIcon(browser){
 const {page,ctx,errors,offline}=await initialize(browser,320,740);
 try{
  await activate(page);
  const model=await iconModel(page),old=(await slot(page,1).boundingBox());
  assert.ok(old&&onSurface(await box(page,swordIcon),old),'the model is fully contained in the 320px slot');
  const original=await page.locator(swordIcon).elementHandle();
  await slot(page,1).tap();
  assert.equal(await slot(page,1).getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator(swordIcon).evaluate((el,first)=>el===first,original),true,'same cached model canvas when selecting sword');
  assert.deepEqual(await slot(page,1).boundingBox(),old,'selected rim does not move or resize slot');
  assert.equal((await iconModel(page)).uri,model.uri,'selection does not modify rendered geometry or crop');
  await snapshot(page,'320-selected-model');
  await slot(page,2).tap(); // full HP: leave all slots as-is
  await page.keyboard.press('1');
  assert.equal(await slot(page,1).getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator(swordIcon).evaluate((el,first)=>el===first,original),true,'same canvas after deselect and potion click');
  assert.deepEqual(await slot(page,1).boundingBox(),old);
  assert.equal((await iconModel(page)).uri,model.uri);
  await press(page,'#poiWalkToggle',true);
  await activate(page);
  assert.equal(await page.locator(swordIcon).evaluate((el,first)=>el===first,original),true,'cached icon reused on subsequent Play');
  await snapshot(page,'320-unselected-model');
  await unchanged(page);offline();assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
function withoutHurt(records){
 // A disposable dragon can independently attack the player; drop its own
 // hurt layers without dropping any expected player swing or impact layer.
 return records.filter(r=>r.hz!==420&&!(r.hz===180&&r.low===52));
}
async function soundCapture(page,weapon,expectHit,prev=false,expectDeath=false){
 if(weapon)await page.keyboard.press('2');else await page.keyboard.press('1');
 const start=(await events(page)).length;
 await page.locator(attack).tap();
 const impactOnly=!prev&&weapon&&expectHit;
 const swing=impactOnly?[]:(weapon?woodSwing:handSwing);
 const hit=weapon?woodHit:handHit;
 const want=expectHit?[...swing,...hit,...(expectDeath?wetDeath:[])]:swing;
 const segment=withoutHurt(sfx((await events(page)).slice(start)));
 assert.deepEqual(segment.map(o=>o.hz),want,'real WebAudio sources for '+(weapon?'wood':'hand')+' '+(expectHit?'hit':'miss'));
 if(impactOnly){
  const contact=segment[0],delay=contact.when-contact.clock;
  // Exact 108ms is pinned by unit tests. The native audio clock may advance
  // while decoding a new buffer; guard against early/no-delay scheduling.
  assert.ok(delay>=.060&&delay<=.120,'wood contact remains scheduled near 108 ms, got '+delay);
  approvedPcm(contact.pcm,'wood');
  exact(contact.peak,.72,'wood impact gain');
 }
 if(expectDeath){
  const wet=segment.at(-1);
  assert.ok(Math.abs(wet.when-segment[swing.length].when-.018)<.010,'distinct wet texture follows the contact, never a pre-swing');
  exact(wet.peak,.65,'wet texture gain through established SE levels');
  approvedPcm(wet.pcm,'wet');
  if(weapon)assert.notEqual(wet.pcm.id,segment[0].pcm.id,'wet defeat buffer differs from cached dry wood material');
 }
 return segment.map(({when,...rest})=>({...rest,delay:Math.round((when-segment[0].when)*1e5)/1e5}));
}
async function soundCase(browser,prefix,expectHit,prev=false){
 const launch=expectHit?{x:19,z:21}:{};
 const {page,ctx,errors,offline}=await initialize(browser,390,844,prefix,launch);
 try{
  if(expectHit){
   // A real action kicks the established Web Audio gesture path. A disposable
   // dragon survives this warmup and both actual attacks observed below.
   await page.locator(attack).tap();
   await page.waitForFunction(()=>window.__comfort.contexts.some(c=>c.state==='running'));
   await page.waitForTimeout(400);
  }else await activate(page);
  const bare=await soundCapture(page,false,expectHit,prev);
  await page.waitForTimeout(400);
  if(!prev){
   const hp=async()=> (await state(page)).combat.actors.find(a=>a.type==='monsterDragon')?.hp;
   const before=expectHit?await hp():null;
   const first=await soundCapture(page,true,expectHit);
   if(expectHit){
    assert.equal(await hp(),before-28,'one sword hit applies one unchanged damage event');
    await page.waitForTimeout(400);
    const second=await soundCapture(page,true,true);
    assert.equal(await hp(),before-56,'second sword hit is one further real damage event');
    assert.equal(first[0].pcm.id,second[0].pcm.id,'repeat wood strikes reuse the very same native AudioBuffer');
   }
  }
  await unchanged(page);offline();assert.deepEqual(errors,[]);
  return bare;
 }finally{await ctx.close();}
}
async function lethalCase(browser,weapon){
 const {page,ctx,errors,offline}=await initialize(browser,390,844,'/lethal',{x:19,z:21});
 try{
  assert.deepEqual((await state(page)).combat.actors.filter(a=>a.type==='monsterSlime').map(a=>[a.x,a.z,a.hp]),[[20,21,35]]);
  // First punch allows real sound activation and puts the disposable slime
  // below both finisher damages. No manual health writes or callback calls.
  await page.locator(attack).tap();
  await page.waitForFunction(()=>window.__comfort.contexts.some(c=>c.state==='running'));
  assert.equal((await state(page)).combat.actors.find(a=>a.type==='monsterSlime')?.hp,15);
  await page.waitForTimeout(400);
  await soundCapture(page,weapon,true,false,true);
  assert.ok(!(await state(page)).combat.actors.some(a=>a.type==='monsterSlime'&&a.hp>0),'wet sound accompanies an actual zero-HP death');
  await page.waitForTimeout(400);
  await soundCapture(page,weapon,false); // No repeating or miss-triggered wet burst after death.
  await unchanged(page);offline();assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await verifyIcon(browser);
 const bareMiss=await soundCase(browser,'/',false);
 const bareHit=await soundCase(browser,'/combat',true);
 await lethalCase(browser,false);
 await lethalCase(browser,true);
 if(baseline){
  for(const [now,old] of [[bareMiss,await soundCase(browser,'/baseline',false,true)],[bareHit,await soundCase(browser,'/old-combat',true,true)]]){
   const round=x=>Math.round(x*1e5)/1e5;
   const clean=a=>a.map(({onset,decay,delay,...row},i)=>({...row,
    onset:round(onset),decay:round(decay),delay:round(delay-(i>=3?a[3].delay:0))}));
   assert.deepEqual(clean(now),clean(old),'original bare audio envelope and timing remains exact');
  }
 }
 console.log('PASS offline Chromium: approved exact WAV PCM, wood hit without pre-swing / lethal-only wet sounds, original hand/audio routing, cached icon, saves untouched');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
