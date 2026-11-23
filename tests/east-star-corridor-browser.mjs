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
const realm=site.otherworld;
assert(realm.bounds.x2>=123,'v202 east wing expands the actual realm bounds');
const reward={x:121,z:84,y:-1};
const newActors=[
 {type:'monsterSkelArcher',x:109,z:88,y:-1},
 {type:'monsterSkelLongStaff',x:120,z:82,y:-1}
];
const key=(x,z)=>x+','+z;
const byCell=new Map();
for(const o of site.map.world)if(o.y===-1){
 const k=key(o.x,o.z);if(!byCell.has(k))byCell.set(k,[]);byCell.get(k).push(o);
}
const roomsFloor=/^(?:stone|road[A-Z]\w+)$/;
const solid=/^(?:stonewall(?!Door)|rock|brokenPillar|ironGate|rewardChest|ruinStonePost|rubble|bookshelf|table|poiWallSconce)/;
const dry=(x,z)=>{const c=byCell.get(key(x,z))??[];return c.some(o=>roomsFloor.test(o.type))&&!c.some(o=>solid.test(o.type))};
const oldApproach=[[100,90],[100,89],[100,88],[100,87],[100,86],[100,85],[100,84],[100,83]];
const branch=[[100,90],[100,86],[118,86],[118,85],[121,85],[121,84],[121,81],[107,81]];
function steps(points){
 const result=[];
 let [x,z]=points[0];
 for(const [tx,tz] of points.slice(1)){
  assert(x===tx||z===tz,'cardinal authored segments only');
  while(x!==tx||z!==tz){x+=Math.sign(tx-x);z+=Math.sign(tz-z);result.push([x,z]);}
 }
 return result;
}
for(const [x,z] of [...oldApproach,...steps(branch)])assert(dry(x,z),'dry walkable authored tile '+[x,z]);
for(const c of newActors)assert(byCell.get(key(c.x,c.z))?.some(o=>o.type===c.type),'real new actor '+c.type);
const eastCount=[...byCell.entries()].filter(([k])=>{
 const [x,z]=k.split(',').map(Number);
 return x>=102&&z>=81&&dry(x,z)&&(x>108||z>=85);
}).length;
assert(eastCount>=110,'real new walkable cells on expansion, got '+eastCount);
assert.deepEqual([realm.entrance.x,realm.entrance.z,realm.exit.x,realm.exit.z,realm.gate.x,realm.gate.z,realm.chest.x,realm.chest.z],[118,88,100,91,100,76,100,74]);
// Visit the traversable component with the gate excluded. New branches
// must not provide a way around the old locked vault.
const queue=[branch[0]],seen=new Set(queue.map(k=>key(...k)));
for(let i=0;i<queue.length;i++){
 const [x,z]=queue[i];
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const px=x+dx,pz=z+dz,k=key(px,pz);
  if(!seen.has(k)&&dry(px,pz)){seen.add(k);queue.push([px,pz]);}
 }
}
assert(seen.has(key(reward.x,reward.z))&&seen.has(key(107,81)));
assert(!seen.has(key(100,75)),'optional loop never opens locked old vault');
if(process.env.STAR_EXPANSION_LAYOUT_ONLY==='1'){
 console.log('PASS v202 authored wide loop, new actors, original route and unbypassed vault');
 process.exit(0);
}
// Use native one-week persistence for the quiet route: merely omitting
// construction on reset is insufficient because entering through the real
// portal calls poiDungeonArrive, which repopulates eligible absent actors.
const oldRoamers=[{type:'monsterGoblin',x:97,z:82,y:-1},{type:'monsterSkeleton',x:104,z:81,y:-1},{type:'monsterSkelKnight',x:106,z:78,y:-1}];
const recentlyDefeated={'otherworld.goblin':0,'otherworld.skeleton':0,
 'otherworld.archive-archer':0,'otherworld.cloister-mage':0,'otherworld.arena-knight':0};
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const editorKey='forest-world-editor-v1',personalEditor=JSON.stringify({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type:'stonewall',rot:1}],models:[],prefabs:[],terrainHeights:[],checks:[]});
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});

const state=page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const pos=(x,z,y=-1)=>({x,z,level:y});
const supplyFlag='otherworldEastSupplyFound';
async function launch(browser,start,facing,quiet=false){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 const kit={version:1,weapon:'equipWoodSword',potions:0,gold:12,claimedCaches:['glade'],
  ...(quiet?{dungeonPopulation:{version:1,dead:recentlyDefeated,questEntries:{}}}:{})};
 await page.evaluate(({start,facing,kit,kitKey,resumeKey,editorKey,personalEditor})=>{
  localStorage.setItem(kitKey,JSON.stringify(kit));
  localStorage.setItem(editorKey,personalEditor);
  localStorage.setItem('world-workshop-audio-v2','{"master":70,"bgm":40,"se":50,"enabled":true}');
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{start,facing,kit,kitKey,resumeKey,editorKey,personalEditor});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await state(page)).position,start);
 return {ctx,page,errors};
}
const current=async page=>(await state(page)).position;
const canStep=(page,x,z,sx,sz)=>page.evaluate(([x,z,sx,sz])=>window.__editorTest.canStep(x,z,sx,sz),[x,z,sx,sz]);
const canCount=i=>[...i.bag,...i.hotbar].reduce((n,c)=>n+(c?.type==='cannedFood'?c.count:0),0);
const keys={[key(1,0)]:'ArrowRight',[key(-1,0)]:'ArrowLeft',[key(0,1)]:'ArrowDown',[key(0,-1)]:'ArrowUp'};
async function step(page,x,z){
 const cur=await current(page),d=keys[key(x-cur.x,z-cur.z)];
 assert(d,'one real cardinal step');
 const reached=([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===-1};
 await page.keyboard.press(d);
 try{await page.waitForFunction(reached,[x,z],{timeout:1400})}
 catch(e){
  // Retry only from the same original cell when the target is currently
  // legal; never skip an authored traversal or an actual blocker.
  const p=await current(page);
  if(p.x!==cur.x||p.z!==cur.z||p.level!==cur.level||!(await canStep(page,x,z,cur.x,cur.z)))
   throw new Error('Native east corridor tile '+[x,z]+' blocked from '+JSON.stringify(p),{cause:e});
  await page.keyboard.press(d);
  await page.waitForFunction(reached,[x,z],{timeout:3500});
 }
 await page.waitForTimeout(210);
}
async function region(page){
 await page.waitForFunction(()=>window.__editorTest.facility().musicZone==='otherworld',null,{timeout:8500});
 const m=(await state(page)).miniMap;
 assert.equal(m.location,'星蝕の回廊');
 assert.equal(m.stars,'★★★★☆☆☆☆☆☆');
}
async function guardedVault(page){
 assert.equal(await canStep(page,100,76,100,77),false,'old dragon gate still blocks native walking');
 const k=JSON.parse(await stock(page));
 assert.equal(k.otherworldCleared,undefined);
 assert.equal(k.otherworldChest,undefined);
 assert.equal(k.quests,undefined);
}
async function portalBranch(browser){
 const {ctx,page,errors}=await launch(browser,pos(118,87,0),2,true);
 try{
  const world=await map(page),url=page.url(),initial=await stock(page);
  await page.locator('[data-poi-dir="s"]').tap();
  await page.waitForFunction(()=>{const p=window.__editorTest.facility().position;return p.x===100&&p.z===90&&p.level===-1});
  await region(page);await page.waitForTimeout(210);
  assert.equal(await stock(page),initial,'old portal requires no kit/quest changes');
  const arrived=(await state(page)).combat.actors;
  for(const wanted of [...newActors,...oldRoamers])assert(!arrived.some(a=>a.type===wanted.type&&a.level===-1&&a.hp>0&&a.visible),
   'native portal respects the recent defeat of '+wanted.type);
  assert(arrived.some(a=>a.type==='monsterDragon'&&a.level===-1&&a.hp===150),'quiet route retains the live guardian');
  const path=steps(branch),nextCount=canCount((await state(page)).inventory)+1;
  for(const [x,z] of path){
   await step(page,x,z);
   if(x===121&&z===84){
    await region(page);
    await page.waitForFunction(k=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.[k]===true,supplyFlag);
    assert.equal(canCount((await state(page)).inventory),nextCount,'actual step collects one durable optional can');
    if(out)await page.screenshot({path:out+'/v202-east-star-gallery.png'});
    const taken=await stock(page);
    await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
    assert.deepEqual(await current(page),pos(121,84),'native reload retains the east wing position');
    assert.equal(await stock(page),taken,'one-time cache remains durable on reload');
    await page.locator('#poiWalkAction').tap(); // a new gesture after reload wakes the native score
    await step(page,121,83);await step(page,121,84);
    assert.equal(canCount((await state(page)).inventory),nextCount,'revisiting cache after reload does not grant a second can');
    assert.equal(await stock(page),taken);
   }
  }
  assert.deepEqual(await current(page),pos(107,81),'avatar reaches the old arena from the optional east loop');
  await region(page);await guardedVault(page);
  assert.equal(page.url(),url);
  assert.deepEqual(await map(page),world);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),editorKey),personalEditor);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function originalActors(browser){
 const {ctx,page,errors}=await launch(browser,pos(121,84),2,false);
 try{
  const base=await state(page);
  for(const wanted of [...newActors,...oldRoamers])assert(base.combat.actors.some(a=>a.type===wanted.type&&a.level===-1&&a.visible&&a.hp>0),'production gameplay still has '+wanted.type);
  assert(base.combat.actors.some(a=>a.type==='monsterDragon'&&a.visible&&a.hp===150),'original guardian remains in same realm');
  await page.locator('#poiWalkAction').tap(); // trusted wake outside any adjacent socket/switch
  await region(page);await guardedVault(page);
  assert.equal(base.miniMap.location,'星蝕の回廊');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.STAR_EXPANSION_CASE!=='actors')await portalBranch(browser);
 if(process.env.STAR_EXPANSION_CASE!=='route')await originalActors(browser);
 console.log('PASS native portrait portal to expanded east loop, actual chest gate scope and distinct existing/new enemies');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
