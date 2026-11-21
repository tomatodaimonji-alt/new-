import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=process.argv[3]&&readFileSync(process.argv[3]);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Fixtures</title>':req.url.startsWith('/baseline')?baseline:html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const fixtures={
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}',
 'world-workshop-adventure-v1':'{"version":1,"x":23,"z":24,"monsters":[]}'
};
function observe(){
 const contexts=[],starts=[],nodes=new WeakMap();
 const native=window.AudioContext;
 function param(p){
  const ops=[];
  for(const method of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime']){
   const original=p[method].bind(p);
   p[method]=function(...args){ops.push([method,...args]);return original(...args);};
  }
  return ops;
 }
 function wrap(node,kind){
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
    starts.push({kind,loop:node.loop??false,when:args[0]??null,shape:shape(node,6)});
    return start(...args);
   };
  }
  return node;
 }
 class Spy extends native{
  constructor(...a){super(...a);contexts.push(this);}
  createOscillator(){return wrap(super.createOscillator(),'osc');}
  createBufferSource(){return wrap(super.createBufferSource(),'source');}
  createBiquadFilter(){return wrap(super.createBiquadFilter(),'filter');}
  createGain(){return wrap(super.createGain(),'gain');}
 }
 window.AudioContext=Spy;
 window.__comfort={contexts,starts};
}
const events=page=>page.evaluate(()=>window.__comfort.starts);
const lastTarget=n=>n.gain.filter(v=>v[0]==='setTargetAtTime').at(-1)?.[1];
const exact=(a,b,label)=>assert.ok(Math.abs(a-b)<1e-5,label+': expected '+b+', got '+a);
const peak=n=>n.gain.find(v=>v[0]==='linearRampToValueAtTime')?.[1];
const onset=n=>n.gain.find(v=>v[0]==='linearRampToValueAtTime')?.[2]-n.gain.find(v=>v[0]==='setValueAtTime')?.[2];
function sfx(records){
 return records.flatMap(r=>{
  const {shape}=r;
  if(r.kind==='source'&&!r.loop&&shape.next?.kind==='filter'){
   const g=shape.next.next;exact(lastTarget(g.next),.90*.88,'SE bus');return [{hz:shape.next.hz,peak:peak(g),onset:onset(g)}];
  }
  if(r.kind==='osc'&&shape.frequency.length===2){
   const g=shape.next;exact(lastTarget(g.next),.90*.88,'SE bus');return [{hz:shape.frequency[0][1],low:shape.frequency[1][1],peak:peak(g),onset:onset(g)}];
  }
  return [];
 });
}
function soundscape(records,note,compact){
 const loops=records.filter(r=>r.loop);
 assert.equal(loops.length,2,'far from the creek there is one wind/rustle pair');
 const [wind,rustle]=loops.map(l=>l.shape.next);
 exact(wind.hz,550,'wind low-pass');exact(rustle.hz,1450,'tree rustle band-pass');
 exact(wind.next.volume,compact?.14:.17,'ambient wind volume');
 exact(rustle.next.volume,compact?.039:.05,'ambient rustle volume');
 const mod=records.find(r=>r.kind==='osc'&&r.shape.hz<1);
 exact(mod.shape.next.volume,compact?.044:.055,'wind level modulation');
 exact(lastTarget(wind.next.next),.39*.62,'ambience slider bus');
 exact(lastTarget(wind.next.next.next),.81,'master slider bus');
 const piano=records.find(r=>r.kind==='osc'&&r.shape.hz>20);
 assert.ok(Math.abs(piano.shape.hz-note)<.15,'first piano pitch unchanged');
 exact(piano.shape.next.next.next.hz,1800,'felt-piano low-pass unchanged');
 exact(lastTarget(piano.shape.next.next.next.next),.38*.62,'BGM slider bus');
 return {hz:piano.shape.hz,peak:peak(piano.shape.next),onset:onset(piano.shape.next)};
}
async function fixture(browser,prefix,id,compact){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 await ctx.addInitScript(observe);
 try{
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
  await page.goto(origin+'/seed');
  await page.evaluate(data=>Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v)),fixtures);
  await page.goto(origin+prefix+'?facility='+id+'&test=1');
  await page.waitForFunction(wanted=>window.__editorTest?.facility?.().id===wanted,id);
  assert.deepEqual(await events(page),[],'editor alone is silent');
  await page.locator('#enterGameWorld').tap();
  await page.waitForFunction(()=>window.__comfort.contexts.some(c=>c.state==='running')&&window.__comfort.starts.some(e=>e.kind==='osc'&&e.shape.hz>20));
  const piano=soundscape(await events(page),id==='base'?130.8128:73.415,compact);
  const step=await page.evaluate(()=>{
   const {position:{x,z}}=window.__editorTest.facility();
   for(const [dx,dz,key] of [[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,-1,'ArrowUp'],[0,1,'ArrowDown']])
    if(window.__editorTest.canStep(x+dx,z+dz))return {key,x:x+dx,z:z+dz};
  });
  assert.ok(step,'spawn permits walking');
  let from=(await events(page)).length;
  await page.keyboard.press(step.key);
  await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;},step);
  const walk=sfx((await events(page)).slice(from));
  assert.equal(walk.length,2,'real footstep retains crunch and sole weight');
  assert.ok(walk[0].hz>=(compact?460:650)-1e-4&&walk[0].hz<=(compact?640:970)+1e-4);
  exact(walk[0].peak,compact?.29:.4,'footstep crunch peak');
  exact(walk[0].onset,compact?.022:.008,'footstep crunch onset');
  exact(walk[1].onset,compact?.016:.008,'footstep body onset');
  exact(walk[1].peak,compact?.145:.21,'footstep body peak');
  exact(walk[1].low,compact?52:62,'footstep body end Hz');
  from=(await events(page)).length;
  await page.locator('#poiWalkAction').tap();
  const attack=sfx((await events(page)).slice(from));
  assert.deepEqual(attack.map(a=>a.hz),compact?[790,1120,145]:[1250,2100,180],'real attack preserves three layers with route-specific upper register');
  for(const [i,v] of (compact?[.41,.18,.20]:[.58,.32,.26]).entries())exact(attack[i].peak,v,'attack layer '+i);
  for(const [i,v] of (compact?[.028,.026,.019]:[.008,.008,.008]).entries())exact(attack[i].onset,v,'attack onset '+i);
  exact(attack[2].low,compact?60:70,'attack body end Hz');
  await page.evaluate(()=>window.__workshopAudioForeground(false));
  await page.waitForFunction(()=>window.__comfort.contexts.every(c=>c.state==='suspended'));
  from=(await events(page)).length;
  await page.waitForTimeout(240);
  await page.locator('#poiWalkAction').tap();
  assert.equal((await events(page)).length,from,'triggers while backgrounded do not schedule audio');
  await page.evaluate(()=>window.__workshopAudioForeground(true));
  await page.waitForFunction(n=>window.__comfort.contexts.some(c=>c.state==='running')&&window.__comfort.starts.slice(n).filter(r=>r.loop).length===2,from);
  const raw=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
  assert.deepEqual(raw,fixtures,'lifecycle/audio leave saved settings and legacy adventure byte-identical');
  assert.deepEqual(errors,[]);
  return {piano,walk,attack};
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const base=await fixture(browser,'/','base',true);
 const lodging=await fixture(browser,'/','lodging',false);
 if(baseline){
  const previous=await fixture(browser,'/baseline','base',false);
  for(const key of ['hz','peak','onset'])exact(base.piano[key],previous.piano[key],'base piano unchanged '+key);
  const other=await fixture(browser,'/baseline','lodging',false);
  for(const key of ['hz','peak','onset'])exact(lodging.piano[key],other.piano[key],'other piano unchanged '+key);
 }
 console.log('PASS real mobile Web Audio: base soundscape/footsteps/attack, original other routes, piano/mixer, background and resume');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
