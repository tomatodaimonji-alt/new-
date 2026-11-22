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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0}={}){
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const original=AudioContext.prototype.createOscillator;
  const bus=window.__herbAudio={notes:[],ctx:null};
  AudioContext.prototype.createOscillator=function(){
   bus.ctx=this;
   const osc=original.call(this),start=osc.start.bind(osc),frequency=osc.frequency;
   let scheduled=null;
   const set=frequency.setValueAtTime.bind(frequency);
   frequency.setValueAtTime=(v,t)=>{scheduled=v;return set(v,t);};
   osc.start=function(...args){bus.notes.push(scheduled??frequency.value);return start(...args);};
   return osc;
  };
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
const kitKey='world-workshop-hotbar-v1';
const retained={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const bag=async page=>{const {sword,potions,weapon,drops}=(await state(page)).inventory;return {sword,potions,weapon,drops};};
const storage=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),kitKey);
const box=(page,i)=>page.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
const resume=async page=>{
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
};
async function swipe(ctx,page,slot){
 const r=await box(page,slot).boundingBox();
 assert.ok(r&&r.width>=30&&r.height>=30,'real accessible hotbar touch target at 320px');
 const x=Math.round(r.x+r.width/2),y=Math.round(r.y+r.height/2);
 const c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});
  for(let i=1;i<=5;i++)
   await c.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+2*i,y:y-i*35,id:1}]});
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach();}
}
const at=(x,z,level=0)=>({x,z,level});
async function icon(page,i,type){
 const control=box(page,i);
 const image=control.locator('canvas[data-item-model="'+type+'"]');
 await image.waitFor({state:'visible'});
 const shape=await image.evaluate(c=>{
  const ctx=c.getContext('2d'),data=ctx.getImageData(0,0,c.width,c.height).data,inks=new Set();
  let filled=0;
  for(let i=0;i<data.length;i+=4)if(data[i+3]>100){filled++;inks.add(data.subarray(i,i+3).join(','));}
  return {width:c.width,height:c.height,filled,shades:inks.size};
 });
 assert.ok(shape.width>=32&&shape.width===shape.height&&shape.filled>30&&shape.filled<shape.width*shape.height*.9&&shape.shades>2,'actual transparent rasterized 3D item model');
}
async function assertDrop(page,type,x,z){
 await page.waitForFunction(({type,x,z})=>window.__editorTest.facility().inventory.drops.some(d=>d.type===type&&d.x===x&&d.z===z&&d.y===0),{type,x,z});
 const a=await bag(page);
 assert.equal(a.drops.filter(d=>d.type===type).length,1,'exactly one drop, not a stack split into several items');
 const persisted=await storage(page);
 assert.ok(persisted.drops.some(d=>d.type===type&&d.x===x&&d.z===z&&d.y===0),'actual ride-through save contains ground location');
 assert.deepEqual([persisted.gold,persisted.claimedCaches],[12,['glade']],'wallet/cache entitlement not touched');
 return a;
}
async function playInventory(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{kit:retained,facing:1});
 try{
  const map=await getMap(page);
  const start=(await state(page)).position;
  assert.deepEqual(start,at(41,43));
  assert.equal(await page.locator('#poiHotbar [data-hotbar-slot]').count(),8);
  assert.equal(await page.locator('#poiHotbar').getByLabel('素手',{exact:true}).count(),0,'no dedicated fist icon');
  assert.match(await box(page,0).getAttribute('aria-label'),/木の剣/);
  assert.match(await box(page,1).getAttribute('aria-label'),/薬草/);
  await icon(page,0,'equipWoodSword');
  await icon(page,1,'poiHealingHerb');
  if(out)await page.screenshot({path:out+'/v146-real-herb-icon.png'});
  assert.deepEqual(await bag(page),{sword:true,potions:3,weapon:null,drops:[]},'old save upgrades without losing starting tool or stack');
  await box(page,0).tap();
  assert.equal((await bag(page)).weapon,'equipWoodSword');
  await box(page,2).tap();
  assert.equal((await bag(page)).weapon,null,'blank slot actually switches to bare hands');
  await page.keyboard.press('1');
  assert.equal((await bag(page)).weapon,'equipWoodSword');
  await swipe(ctx,page,0);
  const sword=await assertDrop(page,'equipWoodSword',42,43);
  assert.equal(sword.sword,false);assert.equal(sword.weapon,null);
  assert.deepEqual((await state(page)).position,start,'swiping does not move player or consume controls');
  await resume(page);
  assert.equal((await bag(page)).sword,false);
  await assertDrop(page,'equipWoodSword',42,43);
  await move(page,'e',true,true);
  assert.deepEqual((await state(page)).position,at(42,43));
  assert.equal((await bag(page)).sword,true,'walk-over reclaims sword, including after restart');
  assert.equal((await bag(page)).drops.length,0);
  await box(page,1).tap();
  assert.equal((await bag(page)).potions,3,'tap at full HP does not consume herb');
  await page.evaluate(()=>window.__editorTest.testWound(40));
  await swipe(ctx,page,1);
  const herb=await assertDrop(page,'healingHerb',43,43);
  assert.equal(await page.locator('#poiPlayerHp').evaluate(e=>e.value),60,'a drag places the wounded player’s herb without also consuming it as a heal');
  assert.equal(herb.potions,2,'one swipe drops exactly one of stacked herbs');
  await resume(page);
  assert.equal((await bag(page)).potions,2);
  await assertDrop(page,'healingHerb',43,43);
  await move(page,'e',true,true);
  assert.equal((await bag(page)).potions,3);
  assert.equal((await bag(page)).drops.length,0,'ground herb disappears when actually collected');
  await move(page,'w');await move(page,'e');
  assert.equal((await bag(page)).potions,3,'reentering a claimed tile cannot duplicate herb');
  await resume(page);
  assert.equal((await bag(page)).potions,3);
  assert.equal((await bag(page)).sword,true);
  assert.equal((await bag(page)).drops.length,0);
  const persisted=await storage(page);
  assert.deepEqual([persisted.gold,persisted.claimedCaches],[12,['glade']]);
  assert.deepEqual(await getMap(page),map,'temporary ground item never becomes a saved editor/POI tile');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function blockedDrop(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:69,z:35},{kit:retained,facing:1});
 try{
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(70,35)),false,'actual store counter in front');
  const raw=await storage(page);
  await swipe(ctx,page,1);
  await page.waitForTimeout(260);
  assert.deepEqual(await storage(page),raw,'refuse drop into occupied, unreachable counter without changing inventory');
  assert.deepEqual((await state(page)).position,at(69,35));
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function healing(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:43},{kit:retained});
 try{
  const hp=()=>page.locator('#poiPlayerHp').evaluate(e=>e.value);
  const healSound=async n=>page.evaluate(n=>{
   const notes=window.__herbAudio.notes.slice(n),want=[523.25,659.25,783.99];
   return want.every(v=>notes.some(k=>Math.abs(v-k)<.03));
  },n);
  const count=()=>page.evaluate(()=>window.__herbAudio.notes.length);
  const tincture=box(page,1);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__herbAudio.ctx?.state==='running');
  const herb=async(wound,healed,outcome,left)=>{
   await page.evaluate(d=>window.__editorTest.testWound(d),wound);
   const old=await count();
   await tincture.tap();
   assert.equal(await hp(),outcome);
   assert.equal((await bag(page)).potions,left);
   const label=page.locator('#poiDamageLayer .playerHeal').filter({hasText:'+'+healed}).last();
   await label.waitFor({state:'visible'});
   assert.equal(await label.textContent(),'+'+healed,'heal overhead text reports actual amount');
   const color=await label.evaluate(el=>getComputedStyle(el).color.match(/\d+/g).slice(0,3).map(Number));
   assert.ok(color[1]>color[0]&&color[1]>color[2],'recovery label is green');
   assert.equal(await healSound(old),true,'three real recovery tones play from successful herb use');
  };
  await herb(50,30,80,2);
  if(out)await page.screenshot({path:out+'/v146-herb-heal-number.png'});
  await herb(5,25,100,1);
  const old=await count();
  const raw=await storage(page);
  await tincture.tap();
  assert.equal(await hp(),100);
  assert.deepEqual(await storage(page),raw,'full HP herb tap never consumes or writes stock');
  assert.equal(await healSound(old),false,'full HP herb tap never plays healing chord');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await playInventory(browser);await blockedDrop(browser);await healing(browser);
 console.log('PASS actual Chromium touch: realistic herb icon, blank unarmed, sword/herb drag, adjacent ground/pickup, refresh/persistence, exact protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
