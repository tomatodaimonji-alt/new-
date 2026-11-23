import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Gate the long browser trial on the actual authored continuation, and
// allow a deterministic red check against the exact previous HTML.
const from=html.indexOf('const FACILITY_SITES=Object.freeze('),to=html.indexOf('function workshopResumeDecode(',from);
assert(from>=0&&to>from);
const authored=vm.runInNewContext(html.slice(from,to)+";buildFacilitySite('base')");
assert.equal(authored.northTrail?.watchPost?.guard?.type,'monsterSkelWarrior',
 'v197 watchpost and legal independent continuation are absent from the older build');
if(process.env.NORTH_WATCH_LAYOUT_ONLY==='1'){
 console.log('PASS inlined world actually contains the watchpost guard');
 process.exit(0);
}
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
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
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const action='#poiWalkAction',morning=9*60,worldKit='world-workshop-hotbar-v1';
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const kit={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const pos=(x,z)=>({x,z,level:0});
const roads=[[90,2],[90,3],[98,3],[98,5],[104,5],[104,7],[112,7],[112,9],[117,9]];
const coords=async page=>(await state(page)).position;
const canCount=s=>[...s.inventory.hotbar,...s.inventory.bag].reduce((n,c)=>n+(c?.type==='cannedFood'?c.count:0),0);
const foe=s=>s.combat.actors.find(a=>a.type==='monsterSkelWarrior'&&a.level===0&&a.x>=99&&a.x<=103&&a.z>=11&&a.z<=14);
const arrow={n:'ArrowUp',s:'ArrowDown',w:'ArrowLeft',e:'ArrowRight'};
const delta=[['e',1,0],['w',-1,0],['s',0,1],['n',0,-1]];
async function one(page,dir,x,z){
 const p=await coords(page);
 assert.equal(Math.abs(x-p.x)+Math.abs(z-p.z),1,'native trial crosses only one cell per key press');
 await page.keyboard.press(arrow[dir]);
 await page.waitForFunction(({x,z})=>{
  const p=window.__editorTest.facility().position;
  return p.x===x&&p.z===z&&p.level===0;
 },{x,z},{timeout:4500});
 await page.waitForTimeout(215); // wait past a single ordinary step
}
async function line(page,x,z){
 let p=await coords(page);
 while(p.x!==x||p.z!==z){
  assert(p.x===x||p.z===z,'expected cardinal path between authored waypoints');
  const dx=Math.sign(x-p.x),dz=Math.sign(z-p.z),d=delta.find(d=>d[1]===dx&&d[2]===dz)[0];
  await one(page,d,p.x+dx,p.z+dz);
  p=await coords(page);
 }
}
async function path(page,x,z){
 const route=await page.evaluate(({x,z,delta})=>{
  const api=window.__editorTest,p=api.facility().position,point=(x,z)=>x+','+z;
  const q=[{x:p.x,z:p.z,steps:[]}],visited=new Set([point(p.x,p.z)]);
  for(let i=0;i<q.length;i++){
   const r=q[i];if(r.x===x&&r.z===z)return r.steps;
   for(const [d,dx,dz] of delta){
    const px=r.x+dx,pz=r.z+dz,k=point(px,pz);
    if(px<98||px>104||pz<9||pz>15||visited.has(k)||!api.canStep(px,pz,r.x,r.z))continue;
    visited.add(k);q.push({x:px,z:pz,steps:[...r.steps,[d,px,pz]]});
   }
  }
  return null;
 },{x,z,delta});
 assert(route,'legal walk around watchpost obstacles exists to '+[x,z]);
 for(const [d,tx,tz] of route)await one(page,d,tx,tz);
}
async function waitMap(page,label,stars){
 await page.waitForFunction(label=>window.__editorTest.facility().miniMap?.location===label,label);
 assert.equal((await state(page)).miniMap.stars,stars);
 const title=await page.locator('#poiLocationName').evaluate(el=>({text:el.textContent,view:el.clientWidth,desired:el.scrollWidth}));
 assert.equal(title.text,label);
 assert(title.view>=title.desired,'portrait location title is readable');
}
async function mainRoad(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:85,z:2},{width:390,clockStart:morning,kit,facing:1});
 try{
  const original=await getMap(page),url=page.url(),old=await readStock(page);
  assert.deepEqual(await coords(page),pos(85,2));
  assert.equal(old.quests,undefined);
  for(const [x,z] of roads)await line(page,x,z);
  await waitMap(page,'水辺の道','★☆☆☆☆☆☆☆☆☆');
  const s=await state(page);
  assert.notEqual(s.miniMap.location,'森の見張り場','main branch does not cross optional guard sector');
  assert.equal(s.combat.playerHP,100);
  assert.equal(s.combat.threats.length,0);
  assert.deepEqual(await readStock(page),old,'passing outside the watchpost never triggers its loot or a quest');
  assert.equal(page.url(),url);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
  if(out)await page.screenshot({path:out+'/v197-east-through-road.png'});
 }finally{await ctx.close()}
}
async function defeat(page){
 await page.waitForFunction(()=>{
  const s=window.__editorTest.facility(),p=s.position;
  return s.combat.actors.some(a=>a.type==='monsterSkelWarrior'&&a.level===0&&a.hp>0&&Math.abs(a.x-p.x)+Math.abs(a.z-p.z)===1);
 });
 const a=foe(await state(page)),p=await coords(page);
 const facing=delta.find(d=>d[1]===a.x-p.x&&d[2]===a.z-p.z)[0];
 // Real directional input updates facing against a physically occupied tile, without moving through it.
 await page.keyboard.press(arrow[facing]);
 assert.deepEqual(await coords(page),p);
 let hp=a.hp;
 for(let i=0;i<8&&hp>0;i++){
  await page.locator(action).tap();
  await page.waitForFunction(prev=>{
   const a=window.__editorTest.facility().combat.actors.find(a=>a.type==='monsterSkelWarrior'&&a.level===0);
   return !a||a.hp<prev;
  },hp,{timeout:5500});
  hp=foe(await state(page))?.hp??0;
  if(hp)await page.waitForTimeout(380);
 }
 assert.equal(hp,0,'guard cleared by actual aimed combat');
}
async function watchpost(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:100,z:5},{width:390,clockStart:morning,kit,facing:2});
 try{
  const original=await getMap(page),old=await readStock(page),start=await coords(page);
  assert.deepEqual(start,pos(100,5));
  assert(original.world.some(o=>o.x===100&&o.z===6&&o.y===0&&o.type==='ruinStonePost'));
  assert.equal(await page.locator(action).getAttribute('aria-label'),'道しるべを読む');
  await page.locator(action).tap();
  await page.locator('#poiMessageLog').filter({hasText:/東へ.*水辺の道.*南へ.*森の見張り場/}).waitFor({state:'visible'});
  assert.deepEqual(await readStock(page),old,'reading the fork waymarker is optional and read-only');
  await line(page,101,5);await line(page,101,10);
  await waitMap(page,'外','★☆☆☆☆☆☆☆☆☆');
  if(await openAt(page,101,11))await line(page,101,11);
  await defeat(page);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.northWatchPostGuardLoot===true);
  const guard=(await readStock(page)).armedDrops.find(d=>d.id==='north-watchpost-warrior');
  assert(guard?.type==='equipBoneSword'&&guard.y===0&&guard.durability>0,'real warrior dropped one bone blade');
  const n=canCount(await state(page));
  await path(page,100,14);
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.northWatchPostSupplies===true);
  assert.equal(canCount(await state(page)),n+1,'physical exploration picks up one canned item');
  const final=await readStock(page);
  assert(final.northWatchPostGuardLoot&&!final.quests);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await coords(page),pos(100,14));
  assert.deepEqual(await readStock(page),final,'reward states and sampled drop persist over reload');
  await path(page,100,13);await path(page,100,14);
  assert.equal(canCount(await state(page)),n+1,'canned supply cannot replenish on revisit after reload');
  assert.equal(foe(await state(page)),undefined,"the cleared watch guard does not respawn on reload");
  assert.equal((await readStock(page)).northWatchPostGuardLoot,true);
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
  if(out)await page.screenshot({path:out+'/v197-watchpost-optional-spur.png'});
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await mainRoad(browser);await watchpost(browser);
 console.log('PASS native portrait main road, optional marker/watchpost and real combat, durable no-repeat food pickup');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
