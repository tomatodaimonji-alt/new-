import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=JSON.parse(JSON.stringify(vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')")));
const marsh=site.northTrail?.marsh;
assert(marsh?.pond,'v198 dry road and optional pond are missing');
const {path,pond}=marsh;
const monster='monsterPondSkater',at=(x,z)=>({x,z,level:0}),xy=p=>[p.x,p.z];
assert.equal(path.length,30);
assert.deepEqual(xy(path[0]),[117,9]);
assert.deepEqual(xy(path.at(-1)),[121,28]);
assert.deepEqual(pond.guard,{x:117,z:28,y:0,type:monster});
const wet=new Set(pond.water.map(p=>xy(p).join(',')));
assert(wet.has('117,28')&&wet.size>=18);
const floor=/^(earth|stone|road\w+|grassTrampled|grassPebbles)$/;
for(const [i,c] of path.entries()){
 const {x,z}=c,tiles=site.map.world.filter(t=>t.x===x&&t.z===z&&t.y===0);
 assert(tiles.length&&tiles.every(t=>floor.test(t.type)),`dry unobstructed road (${x},${z})`);
 assert(!wet.has(xy(c).join(',')));
 if(i)assert.equal(Math.abs(x-path[i-1].x)+Math.abs(z-path[i-1].z),1);
}
for(const p of [[118,27],[118,28],[118,29]])assert(pond.bank.some(c=>xy(c).join(',')===p.join(',')));
if(process.env.WETLAND_LAYOUT_ONLY==='1'){
 console.log('PASS v198 authored route (29 contiguous dry steps), deep-water guard and dry dodge cells');
 process.exit(0);
}

const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
// Scope the browser fixture to the authored encounters. Keep the normal
// clock and combat scheduler, but suppress unrelated random wild placements.
const wildPick=' const p=poiWildPick(rng);';
assert.equal(html.split(wildPick).length,2,'one wild placement anchor in the app');
const fixtureHtml=html.replace(wildPick,' const p=null;');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':fixtureHtml);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const fixtures={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}',
 'forest-world-editor-v1':JSON.stringify({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]}),
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}'
};
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const canStep=(page,x,z,sx,sz)=>page.evaluate(p=>window.__editorTest.canStep(...p),[x,z,sx,sz]);
const position=async page=>(await state(page)).position;
const monsterAt=s=>s.combat.actors.find(o=>o.type===monster&&o.level===0);
async function launch(browser,start,facing=1){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start,facing})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:0,facing},townLayout:5,
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start,facing});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual(await position(page),at(start.x,start.z));
 return {ctx,page,errors};
}
const directions={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
async function singleStep(page,x,z,touch=false){
 const from=await position(page);
 const dx=x-from.x,dz=z-from.z;
 assert.equal(Math.abs(dx)+Math.abs(dz),1,'test only uses physical cardinal steps');
 const key=Object.keys(directions).find(k=>directions[k][0]===dx&&directions[k][1]===dz);
 if(touch){
  const d={ArrowUp:'n',ArrowDown:'s',ArrowLeft:'w',ArrowRight:'e'}[key];
  await page.locator('[data-poi-dir="'+d+'"]').tap();
 }else await page.keyboard.press(key);
 await page.waitForFunction(([x,z])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===0;
 },[x,z],{timeout:5000});
}
const calm=page=>page.waitForTimeout(210); // wait past the 175ms ordinary move
async function expectHud(page,name,stars){
 await page.waitForFunction(([n,s])=>{const m=window.__editorTest.facility().miniMap;return m.location===n&&m.stars===s;},[name,stars]);
 assert.equal(await page.locator('#poiLocationName').innerText(),name);
}
async function exactProtection(page,original){
 assert.deepEqual(await map(page),original,'authored exploration never edits map data');
 for(const [key,value] of Object.entries(fixtures))if(key!==kitKey)
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),key),value);
}
async function road(browser){
 const {ctx,page,errors}=await launch(browser,at(117,9));
 try{
  const original=await map(page),raw=await stock(page),url=page.url();
  for(let i=1;i<path.length;i++) {
   const {x,z}=path[i];
   await singleStep(page,x,z);await calm(page);
   assert.equal((await state(page)).combat.threats.filter(t=>t.type===monster).length,0,'pond guard must not threaten the road at '+[x,z]);
  }
  await expectHud(page,'柳の道','★☆☆☆☆');
  assert.equal((await state(page)).combat.playerHP,100);
  assert.equal(page.url(),url);
  assert.equal(await stock(page),raw);
  assert.equal((await state(page)).walk.stepMs,175);
  await exactProtection(page,original);assert.deepEqual(errors,[]);
  if(out)await page.screenshot({path:out+'/v198-willow-road.png'});
 }finally{await ctx.close()}
}

async function bank(browser){
 const {ctx,page,errors}=await launch(browser,at(118,28),3);
 try{
  const original=await map(page),raw=await stock(page),url=page.url(),before=await state(page);
  assert(before.combat.playerHP>0);
  assert(monsterAt(before)?.hp>0,'ordinary game startup must spawn actual pond skater');
  assert.equal(await canStep(page,117,28,118,28),false,'player cannot enter the skater water');
  assert.equal(await canStep(page,117,29,118,29),false,'adjacent empty pond tile remains blocked independent of enemy occupancy');
  await page.keyboard.press('ArrowLeft');
  assert.deepEqual(await position(page),at(118,28),'real directional input cannot step into the pond');
  await page.keyboard.press('Enter');
  // Poll native gameplay state without screenshots, full-world sampling, or emulated timers during the warning.
  const cueHandle=await page.waitForFunction(()=>{
   const game=window.__editorTest.facility(),now=performance.now();
   const cue=game.combat.threats.find(t=>t.type==='monsterPondSkater'&&t.x===118&&t.z===28&&t.y===0);
   return cue&&cue.hit-now>270?{...cue,hp:game.combat.playerHP}:false;
  },null,{polling:20,timeout:8000});
  const cue=await cueHandle.jsonValue();
  assert.equal(cue.hit-cue.start,640);
  assert(cue.hp>0,'live player at beginning of the committed attack');
  await singleStep(page,118,27);
  await page.waitForFunction(hit=>performance.now()>hit+180,cue.hit);
  const after=await state(page);
  assert.equal(after.combat.playerHP,cue.hp,'actual dodge leaves committed tile without taking damage from the observed warning');
  assert(monsterAt(after)?.hp<monsterAt(before).hp,'native facing and action make one weapon hit across the wet edge');
  assert.equal(after.walk.stepMs,175);
  await expectHud(page,'外','★☆☆☆☆');
  if(out)await page.screenshot({path:out+'/v198-dry-dodge-bank.png'});
  // Exit via the physically traversable north branch.
  for(const [x,z] of [[119,27],[119,26],[120,26],[121,26]]){
   await calm(page);await singleStep(page,x,z);
  }
  await expectHud(page,'柳の道','★☆☆☆☆');
  assert.equal(page.url(),url);
  assert.equal(JSON.parse(await stock(page)).quests,JSON.parse(raw).quests);
  await exactProtection(page,original);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}

let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.WETLAND_CASE!=='bank')await road(browser);
 if(process.env.WETLAND_CASE!=='road')await bank(browser);
 console.log('PASS native portrait willow road, blocked pond water, bank fight, and timed dodge');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
