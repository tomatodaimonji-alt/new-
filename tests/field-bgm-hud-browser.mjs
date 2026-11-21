import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

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
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390,height=844,probe=false}={}){
 const ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 if(probe)await ctx.addInitScript(audioSpy);
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
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const at=(x,z,level=0)=>({x,z,level});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function picture(page,label){
 if(!out)return;
 await settle(page);
 await page.screenshot({path:out+'/v147-'+label+'.png'});
}
async function noMapMutation(page,map){
 assert.deepEqual(await getMap(page),map,'NPCs, rooms and clock do not write authenticated game layout or tiles');
 await unchanged(page);
}
const action='#poiWalkAction';
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
function byId(info,id){return info.actors.find(o=>o.id===id);}
const worldKit='world-workshop-hotbar-v1';
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const numbers={town:130.8128,field:146.8324};
function audioSpy(){
 const proto=AudioContext.prototype;
 const original={gain:proto.createGain,osc:proto.createOscillator,source:proto.createBufferSource,filter:proto.createBiquadFilter};
 const graph=window.__fieldAudio={gains:[],refs:[],notes:[],loops:[],ctx:null};
 const kinds=new WeakMap(),links=new WeakMap(),ids=new WeakMap();
 function node(n,kind){
  kinds.set(n,kind);const connect=n.connect.bind(n);
  n.connect=function(dest,...args){links.set(n,dest);return connect(dest,...args)};
  return n;
 }
 proto.createGain=function(){
  graph.ctx=this;
  const n=node(original.gain.call(this),'gain'),entry={id:graph.gains.length,ops:[]};
  graph.gains.push(entry);graph.refs.push(n);ids.set(n,entry.id);
  for(const k of ['setTargetAtTime','setValueAtTime','linearRampToValueAtTime','cancelScheduledValues']){
   const old=n.gain[k].bind(n.gain);n.gain[k]=function(...args){entry.ops.push([k,...args]);return old(...args);};
  }
  return n;
 };
 proto.createBiquadFilter=function(){return node(original.filter.call(this),'filter');};
 proto.createOscillator=function(){
  const n=node(original.osc.call(this),'osc'),start=n.start.bind(n);
  n.start=function(...args){
   let p=links.get(n),filter=null,score=null,parents=[];
   for(let i=0;p&&i<10;i++,p=links.get(p)){
    if(kinds.get(p)==='gain')parents.push(ids.get(p));
    if(kinds.get(p)==='filter'){filter=p.frequency.value;score=ids.get(links.get(p));}
   }
   graph.notes.push({hz:n.frequency.value,filter,score,parents,when:args[0]??null});
   return start(...args);
  };
  return n;
 };
 proto.createBufferSource=function(){
  const n=node(original.source.call(this),'source'),start=n.start.bind(n);
  n.start=function(...args){if(n.loop)graph.loops.push({when:args[0]??null});return start(...args);};
  return n;
 };
}
const sound=page=>page.evaluate(()=>{
 const a=window.__fieldAudio;return {state:a.ctx?.state??null,gains:a.gains.map((g,i)=>({...g,value:a.refs[i].gain.value})),notes:a.notes,loops:a.loops};
});
const target=(g,id)=>g.gains[id].ops.filter(e=>e[0]==='setTargetAtTime').at(-1);
const closest=(notes,hz,filter)=>notes.find(n=>Math.abs(n.hz-hz)<.04&&Math.abs(n.filter-filter)<.01);
async function waitNote(page,hz,filter){
 await page.waitForFunction(({hz,filter})=>window.__fieldAudio.notes.some(n=>Math.abs(n.hz-hz)<.04&&Math.abs(n.filter-filter)<.01),{hz,filter});
 return closest((await sound(page)).notes,hz,filter);
}
async function fieldMusic(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:68},{clockStart:12*60,facing:2,probe:true});
 try{
  assert.equal((await state(page)).miniMap.location,'拠点');
  await page.locator(action).tap(); // real Android-style activation
  await page.waitForFunction(()=>window.__fieldAudio.ctx?.state==='running');
  const town=await waitNote(page,numbers.town,1800);
  const before=await sound(page);
  assert.ok(Number.isInteger(town.score),'actual town piano connects into local score gain');
  await move(page,'s',true,true);
  await move(page,'s');
  assert.equal((await state(page)).miniMap.location,'外');
  const field=await waitNote(page,numbers.field,2300);
  assert.ok(Number.isInteger(field.score)&&field.score!==town.score,'outside uses a distinct live score gain');
  const mixed=await sound(page),a=target(mixed,town.score),b=target(mixed,field.score);
  assert.deepEqual([a[1],b[1],a[3],b[3]],[0,1,.46,.46],'both live score gains crossfade in opposite directions');
  assert.ok(Math.abs(a[2]-b[2])<.01,'fade begins together, no audible gap');
  const primary=town.parents[town.parents.indexOf(town.score)+1];
  assert.equal(field.parents[field.parents.indexOf(field.score)+1],primary,'same existing music slider governs both scores');
  assert.ok(Math.abs(target(mixed,primary)[1]-.38*.62)<1e-6);
  assert.deepEqual(mixed.loops,before.loops,'outdoor BGM does not restore obsolete continuous wind');
  assert.equal(mixed.loops.length,0,'this grassland is dry and start no sample loop');

  await move(page,'n');await move(page,'n',true,true);
  assert.equal((await state(page)).miniMap.location,'拠点');
  await page.waitForFunction(({town,field})=>{
   const a=window.__fieldAudio.gains;
   const read=id=>a[id].ops.filter(o=>o[0]==='setTargetAtTime').at(-1)?.[1];
   return read(town)===1&&read(field)===0;
  },{town:town.score,field:field.score});
  const returned=await sound(page);
  assert.deepEqual([target(returned,town.score)[1],target(returned,field.score)[1]],[1,0],'return naturally fades to original town score');
  for(const fade of [town.score,field.score]){
   const changes=returned.gains[fade].ops.slice(before.gains[fade]?.ops.length??0);
   assert.ok(!changes.some(v=>v[0]==='setValueAtTime'),'return changes gain targets without resetting live ramp');
  }

  await move(page,'s');await move(page,'s');
  assert.equal((await state(page)).miniMap.location,'外');
  await page.evaluate(()=>window.__workshopAudioForeground(false));
  await page.waitForFunction(()=>window.__fieldAudio.ctx?.state==='suspended');
  const paused=(await sound(page)).notes.length;
  await page.waitForTimeout(420);
  assert.equal((await sound(page)).notes.length,paused,'app background does not schedule either score');
  await page.evaluate(()=>window.__workshopAudioForeground(true));
  await page.waitForFunction(n=>window.__fieldAudio.ctx?.state==='running'&&window.__fieldAudio.notes.length>n,paused);
  const restored=await sound(page);
  const live=restored.notes.slice(paused).find(n=>n.filter===2300);
  assert.ok(live&&Number.isInteger(live.score)&&Math.abs(restored.gains[live.score].value-1)<.001,'resume outside starts destination score at correct gain');

  await page.locator('#poiSoundSettingsToggle').tap();
  const range=page.locator('#poiVolumeBgm');await range.focus();await page.keyboard.press('Home');
  assert.equal(await range.inputValue(),'0','true mixer control can still mute');
  const muted=await sound(page);
  const outsideMain=live.parents[live.parents.indexOf(live.score)+1];
  assert.equal(target(muted,outsideMain)[1],0,'actual shared gain muted, no new setting key');
  assert.equal(muted.loops.length,0);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function minimap(browser,width,height){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{width,height});
 try{
  const mini=page.locator('#poiMiniHud'),wrap=page.locator('#viewWrap');
  await mini.waitFor({state:'visible'});
  const [m,w]=await Promise.all([mini.boundingBox(),wrap.boundingBox()]);
  assert.ok(m&&w&&Math.abs(m.x-w.x-5)<1.5&&Math.abs(m.y-w.y-5)<1.5,'shared minimap moves to safe upper-left inset');
  const surface=css=>page.locator(css).evaluate(el=>getComputedStyle(el).backgroundColor);
  const pad=await surface('#poiWalkPad');
  assert.equal(pad,'rgba(22, 46, 39, 0.54)');
  for(const css of ['#poiMiniMap','#poiLocationPanel'])assert.equal(await surface(css),pad,css+' uses same visible D-pad surface');
  const transparency=await page.locator('#poiMiniMap').evaluate(c=>{
   const colors=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let clear=0,half=0,full=0;
   for(let i=3;i<colors.length;i+=4){const a=colors[i];if(a===0)clear++;else if(a<210)half++;else if(a===255)full++;}
   return {clear,half,full};
  });
  assert.ok(transparency.clear>300&&transparency.half>500&&transparency.full>=3,'real minimap raster retains transparency as well as legible opaque marker');
  const overlap=async()=>page.evaluate(()=>{
   const r=document.querySelector('#poiMiniHud').getBoundingClientRect();
   return [...document.querySelectorAll('#quickTools button,#poiGameTools button,#poiSoundPanel')].filter(e=>e.offsetWidth>0&&e.offsetHeight>0).filter(e=>{
    const q=e.getBoundingClientRect();return r.x<q.right-1&&r.right>q.x+1&&r.y<q.bottom-1&&r.bottom>q.y+1;
   }).map(e=>e.id);
  });
  assert.deepEqual(await overlap(),[],'top-left HUD does not cover right play buttons');
  await page.locator('#poiSoundSettingsToggle').tap();
  assert.deepEqual(await overlap(),[],'new position still leaves sound drawer usable');
  await picture(page,'corner-minimap-'+width);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function unchangedInnScore(browser){
 const {ctx,page,errors}=await launch(browser,'lodging',null,{probe:true});
 try{
  const note=await waitNote(page,73.415,1800),g=await sound(page);
  assert.ok(Math.abs(target(g,note.score)[1]-.38*.62)<1e-6,'standalone lodging retains the previous piano and original direct music bus');
  assert.equal(g.notes.some(n=>n.filter===2300),false,'field theme never leaks into standalone POI');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await minimap(browser,320,740);await minimap(browser,390,844);
 await fieldMusic(browser);
 await unchangedInnScore(browser);
 console.log('PASS Chromium: real translucent corner minimap, live two-score gate fade, known no wind, mute/resume and protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
