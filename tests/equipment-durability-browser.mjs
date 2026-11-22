import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const old=process.argv[3]?readFileSync(process.argv[3],'utf8'):null;
const hook='function poiSound(kind,weapon=null,defeated=false){';
function observe(page){
 assert.equal(page.split(hook).length,2);
 return page.replace(hook,`window.__knifeAudio.warm=()=>poiAudioStart(true);
window.__knifeAudio.emit=(...args)=>poiSound(...args);
function poiSound(kind,weapon=null,defeated=false){
 const previous=window.__qaSoundRoute;
 window.__qaSoundRoute={kind,weapon,defeated};
 if(kind==='equipment-break')window.__knifeAudio.routed.push(window.__qaSoundRoute);
 try{return __qaNativeSound(kind,weapon,defeated)}finally{window.__qaSoundRoute=previous}
}
function __qaNativeSound(kind,weapon=null,defeated=false){`);
}
const candidate=observe(html),baseline=old?observe(old):null;
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/before')?baseline:candidate);
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
  const audio=window.__knifeAudio={routed:[],rendered:[],ctx:null,external:0};
  const p=AudioContext.prototype,make=p.createBufferSource,gain=p.createGain;
  p.createGain=function(...args){audio.ctx=this;return gain.apply(this,args)};
  const media=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(...args){audio.external++;return media.apply(this,args)};
  p.createBufferSource=function(){
   audio.ctx=this;
   const source=make.call(this),start=source.start;
   source.start=function(...args){
    const route=window.__qaSoundRoute;
    if(route?.kind==='equipment-break'&&this.buffer){
     const samples=this.buffer.getChannelData(0);
     let hash=1,peak=0,sum=0;
     for(let i=0;i<samples.length;i++){
      const n=samples[i];peak=Math.max(peak,Math.abs(n));sum+=n*n;
      hash=(Math.imul(31,hash)^Math.round(n*32768))>>>0;
     }
     audio.rendered.push({...route,ms:(args[0]-audio.ctx.currentTime)*1000,
      duration:this.buffer.duration,rate:this.buffer.sampleRate,peak,rms:Math.sqrt(sum/samples.length),hash});
    }
    return start.apply(this,args);
   };
   return source;
  };
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
const hot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
const bag=i=>'#poiBagGrid [data-bag-slot="'+i+'"]';
const chest=i=>'#poiChestGrid [data-chest-slot="'+i+'"]';
const gear=part=>'#poiGearColumn [data-gear-slot="'+part+'"]';
const action='#poiWalkAction',detail='#poiItemDetail';
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
const actor=async page=>(await state(page)).combat.actors.find(a=>a.type==='monsterSlime'&&a.level===-1);
const inv=async page=>(await state(page)).inventory;
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const torso={head:null,torso:'starterTunic',legs:null,feet:null};
const item=(type,durability)=>({type,count:1,durability});
const sword='equipWoodSword',knife='kitchenKnife';
const seed=(combat=false)=>{
 const slots=Array(27).fill(null);
 slots[0]=item(sword,64);
 slots[1]=combat?item(knife,8):{type:'healingHerb',count:1};
 slots[9]=item('starterCap',18);
 const kit={version:1,weapon:sword,potions:combat?0:1,gold:12,slots,
  worn:torso,wornDurability:{torso:combat?1:55}};
 if(!combat){
  const cells=Array(18).fill(null);cells[0]=item(knife,4);
  kit.kitchenChest={version:1,slots:cells};
 }
 return kit;
};
async function gauge(page,slot,value,band){
 const meter=page.locator(slot+' > .poiDurabilityMeter');
 await meter.waitFor({state:'visible'});
 assert.equal(await meter.getAttribute('data-durability-percent'),String(value));
 assert.equal(await meter.getAttribute('data-durability-band'),band);
 assert.match(await page.locator(slot).getAttribute('aria-label'),new RegExp(value+'\\s*%'));
 const physical=await meter.evaluate(el=>{
  const r=e=>{const b=e.getBoundingClientRect();return {top:b.top,bottom:b.bottom,x:b.x,right:b.right,w:b.width,h:b.height}};
  return {slot:r(el.parentElement),gauge:r(el),fill:getComputedStyle(el,'::after').backgroundColor,progress:el.style.getPropertyValue('--durability-progress')};
 });
 assert.equal(physical.progress,value+'%','painted fill follows actual condition');
 assert(physical.gauge.h>0&&physical.gauge.top>=physical.slot.top+physical.slot.h*.65&&
  physical.gauge.bottom<=physical.slot.bottom+1&&physical.gauge.x>=physical.slot.x-1&&physical.gauge.right<=physical.slot.right+1,
  'meter attaches to the bottom inside its original tile: '+JSON.stringify(physical));
 return physical;
}
async function display(browser){
 const initial=seed();
 const {ctx,page,errors}=await launch(browser,'base',{x:28,z:32},{level:-1,facing:3,kit:initial});
 try{
  const original=await getMap(page);
  await page.locator(action).tap();
  await page.locator('#poiChestPanel').waitFor({state:'visible'});
  const green=await gauge(page,hot(0),80,'good'),yellow=await gauge(page,bag(0),50,'warn'),red=await gauge(page,chest(0),20,'low');
  assert.equal(new Set([green.fill,yellow.fill,red.fill]).size,3,'three actual colors, not only different attribute names');
  const displayedPercent=Math.round(55/62*100);
  await gauge(page,gear('torso'),displayedPercent,'good');
  for(const slot of [hot(1),hot(8),chest(1),gear('feet'),'#poiBagWallet'])
   assert.equal(await page.locator(slot+' .poiDurabilityMeter').count(),0,'no gauge on empty or non-breakable '+slot);
  await page.locator(chest(0)).tap();
  await page.locator(detail+'[open]').waitFor({state:'visible'});
  assert.match(await page.locator(detail).innerText(),/耐久[^\n]*20\s*%/);
  assert.deepEqual(await read(page),initial,'viewing does not rewrite the kit');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function combat(browser){
 const initial=seed(true);
 const {ctx,page,errors}=await launch(browser,'base',{x:116,z:59},{level:-1,facing:3,kit:initial});
 try{
  const original=await getMap(page);
  await page.evaluate(()=>window.addEventListener('pointerdown',()=>window.__knifeAudio.warm(),{once:true,capture:true}));
  await page.locator('#view').tap({position:{x:160,y:170}});
  await page.waitForFunction(()=>window.__knifeAudio.ctx?.state==='running');
  // Let the real nearby slime land its fixed marked tile attack first, so
  // the equipped one-use tunic breaks from actual incoming damage.
  await page.waitForFunction(()=>{const s=window.__editorTest.facility();
   return s.combat.playerHP<100&&s.inventory.worn.torso===null});
  assert.equal((await read(page)).worn.torso,null);
  assert.equal((await actor(page)).hp,35);
  let breaks=await page.evaluate(()=>window.__knifeAudio.routed);
  assert.deepEqual(breaks,[{kind:'equipment-break',weapon:'starterTunic',defeated:false}],'exactly one committed tunic break cue');
  await page.locator(action).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.hotbar[0]?.durability===127);
  let s=await inv(page);
  assert.equal(s.hotbar[0].durability,127);
  assert.equal(s.hotbar[1].durability,16);
  assert((await actor(page)).hp<35&&(await actor(page)).hp>0);
  await page.waitForTimeout(410);
  await page.locator(hot(1)).tap();
  await page.locator(action).tap();
  await page.waitForFunction(()=>window.__editorTest.facility().inventory.hotbar[1]?.durability===15);
  assert.equal((await actor(page)).hp,0);
  s=await inv(page);
  assert.equal(s.hotbar[0].durability,127);assert.equal(s.hotbar[1].durability,15);
  breaks=await page.evaluate(()=>window.__knifeAudio.routed);
  assert.equal(breaks.length,1,'landed durability decrements without spurious break cues');
  const durable=await read(page);assert.equal(durable.weaponDurabilityVersion,2);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await read(page),durable,'partial and broken condition are durable over reload');
  assert.equal((await inv(page)).worn.torso,null);
  await page.locator('#poiBagToggle').tap();
  assert.equal(await page.locator(gear('torso')+' .poiDurabilityMeter').count(),0,'broken tunic is not restored');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await display(browser);await combat(browser);
 console.log('PASS durability meters and colors, live wooden and knife wear, real incoming armor break once, and persistent condition');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
