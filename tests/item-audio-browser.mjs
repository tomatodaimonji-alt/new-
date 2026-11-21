import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Deterministic encounter placement only in the served disposable QA fixture.
const anchor='const p=poiWildPick(rng);';
assert.equal(html.split(anchor).length,2,'expected one fixture anchor');
const combatHTML=html.replace(anchor,'const p=poiWalkX===41&&poiWalkZ===73?{x:42,z:73}:poiWildPick(rng);');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/coin')?combatHTML:html);
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
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const p=AudioContext.prototype,graph=window.__itemAudio={events:[],ctx:null};
  const edges=new WeakMap();
  const nativeConnect=AudioNode.prototype.connect;
  AudioNode.prototype.connect=function(dest,...args){
   const result=nativeConnect.call(this,dest,...args);
   if(dest instanceof AudioNode)edges.set(this,dest);
   return result;
  };
  for(const name of ['createOscillator','createBufferSource']){
   const make=p[name];
   p[name]=function(){
    graph.ctx=this;
    const n=make.call(this),start=n.start;
    let pitch=null;
    if(name==='createOscillator'){
     const freq=n.frequency,set=freq.setValueAtTime;
     freq.setValueAtTime=function(hz,t){pitch=hz;return set.call(this,hz,t);};
    }
    n.start=function(...args){
     const r=start.apply(this,args),next=edges.get(this);
     if(next instanceof BiquadFilterNode&&next.type==='bandpass'&&!n.loop)
      graph.events.push({hz:next.frequency.value,t:args[0],kind:'bandpass'});
     else if(name==='createOscillator')
      graph.events.push({hz:pitch??n.frequency.value,t:args[0],kind:n.type});
     return r;
    };
    return n;
   };
  }
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
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true,touch=false){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 if(touch)await page.locator('[data-poi-dir="'+d+'"]').tap();else await page.keyboard.press(arrow[d]);
 try{
  await page.waitForFunction(([x,z])=>{
   const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;
  },[x+dx,z+dz],{timeout:required?2700:500});
 }catch(err){
  if(required)throw new Error(`Walk ${arrow[d]} from (${x},${z}) did not reach (${x+dx},${z+dz}). Actual: ${JSON.stringify((await state(page)).position)}`,{cause:err});
  return;
 }
 await page.waitForTimeout(186);
}
const retained={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const bag=async page=>(await state(page)).inventory;
const box=(page,i)=>page.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
async function swipe(ctx,page,slot){
 const r=await box(page,slot).boundingBox();
 assert.ok(r&&r.width>=30&&r.height>=30,'real accessible hotbar touch target at 320px');
 const x=Math.round(r.x+r.width/2),y=Math.round(r.y+r.height/2);
 const c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=5;i++)
   await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+2*i,y:y-i*19,id:1}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach();}
}

const signatures={woodDrop:[730,1030],herbDrop:[1680,650],woodPickup:[1830,810],herbPickup:[1830,1260],coinDrop:[2730,1690],coinPickup:[1310,1990,2510]};
const clear=page=>page.evaluate(()=>window.__itemAudio.events.length=0);
const events=page=>page.evaluate(()=>window.__itemAudio.events);
function has(hz,list){return list.some(e=>Math.abs(e.hz-hz)<.001);}
async function cue(page,name){
 const notes=await events(page);
 for(const hz of signatures[name])assert.ok(has(hz,notes),name+' missing '+hz+' in '+JSON.stringify(notes));
 return notes;
}
async function silence(page){
 const notes=await events(page);
 const frequencies=[...new Set(Object.values(signatures).flat())];
 assert.ok(frequencies.every(hz=>!has(hz,notes)),'failed/duplicate action cannot play item foley: '+JSON.stringify(notes));
}
const activate=async page=>{
 // A real mobile movement gesture initializes/resumes the browser audio context.
 await move(page,'w',true,true);
 await move(page,'e',true,true);
 await page.waitForFunction(()=>window.__itemAudio.ctx?.state==='running');
};
const can=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
async function inventory(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{kit:retained,facing:1});
 try{
  await activate(page);
  const original=await getMap(page);
  await clear(page);await swipe(ctx,page,0);
  assert.ok((await bag(page)).drops.some(i=>i.type==='equipWoodSword'&&i.x===42&&i.z===43));
  const wood=await cue(page,'woodDrop');
  assert.ok(!has(1680,wood),'wood does not replay herb rustle');
  await clear(page);await swipe(ctx,page,1);
  assert.equal((await bag(page)).potions,3,'cannot place different items in the same tile');
  await silence(page);
  await clear(page);await move(page,'e',true,true);
  assert.equal((await bag(page)).sword,true);await cue(page,'woodPickup');
  await clear(page);await swipe(ctx,page,1);
  assert.equal((await bag(page)).potions,2);await cue(page,'herbDrop');
  await clear(page);await move(page,'e',true,true);
  assert.equal((await bag(page)).potions,3);await cue(page,'herbPickup');
  await clear(page);await move(page,'w');await move(page,'e');await silence(page);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function coins(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:73},{fixture:'coin',kit:retained,facing:1});
 try{
  await activate(page);
  assert.equal(await can(page,42,73),true,'natural drop tile must be dry and walkable');
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.x===42&&a.z===73&&a.hp===35),null,{timeout:16000});
  const wallet=async()=>(await state(page)).economy;
  const action=page.locator('#poiWalkAction');
  await box(page,0).tap();
  await clear(page);await action.tap();
  assert.equal((await wallet()).drops.length,0,'no coin after nonlethal hit');await silence(page);
  await page.waitForTimeout(410);
  await clear(page);await action.tap();
  assert.equal((await wallet()).gold,12,'defeat never auto-collects a coin');
  assert.ok((await wallet()).drops.some(d=>d.x===42&&d.z===73&&d.amount===3));
  const loot=await cue(page,'coinDrop');
  assert.ok(!has(1990,loot),'landing cue is not the pickup cue');
  await clear(page);await move(page,'e',true,true);
  assert.equal((await wallet()).gold,15);
  const pickup=await cue(page,'coinPickup');
  assert.ok(!has(2730,pickup),'picking up a coin does not replay the loot impact');
  await clear(page);await move(page,'w');await move(page,'e');await silence(page);
  assert.equal((await wallet()).gold,15);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
try{
 await inventory(browser);
 await coins(browser);
 console.log('PASS actual 320px touch swipes and wild slime combat: separate WebAudio cues for successful wood/herb/coin drops and pickups, quiet failures/re-entry, preserved saves');
}finally{await browser.close();await new Promise(r=>server.close(r));}
