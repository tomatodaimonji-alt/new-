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
const leaf=site.mine;
assert(leaf&&site.otherworld&&site.chapel);
assert.match(html,/visible:poiDungeonVisualVisible\(/,'v200 must expose scoped real rendered actor eligibility');
assert.match(html,/const POI_LOOT_MARK_RADIUS=12\b/,'v200 item beacons must reach twelve tiles');
if(process.env.DUNGEON_LOOT_LAYOUT_ONLY==='1'){
 console.log('PASS v200 scoped dungeon actors and long-range loot beacon contract');
 process.exit(0);
}
const readAnchor='  playerWeapon:()=>',markAnchor='function poiLootMark(m,x,y,z,item){';
const rebuildAnchor='  const near=new Map();';
const randomPick=' const p=poiWildPick(rng);';
for(const anchor of [readAnchor,markAnchor,rebuildAnchor,randomPick])assert.equal(html.split(anchor).length,2,anchor);
const observedHtml=html.replace(readAnchor,`  lootMarkProbe:()=>({points:window.__lootPoints||[],vertices:poiLootMarksMesh?.count||0}),
${readAnchor}`).replace(markAnchor,markAnchor+`
 (window.__lootPoints||=[]).push({x,y,z,item});`).replace(rebuildAnchor,`  window.__lootPoints=[];
${rebuildAnchor}`).replace(randomPick,' const p=null;');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observedHtml);
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
const blade={id:'north-watchpost-warrior',type:'equipBoneSword',x:124,z:43,y:0,durability:37};
const wrongFloor={id:'monsterSkelWarrior',type:'equipBoneSword',x:124,z:42,y:-1,durability:31};
const distant={id:'monsterSkelArcher',type:'equipWoodBow',x:124,z:50,y:0,durability:32};
async function launch(browser,start,armedDrops=[]){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 const kit={version:1,weapon:'equipWoodSword',potions:0,gold:12,claimedCaches:['glade'],...(armedDrops.length?{armedDrops}:{})};
 await page.evaluate(({start,kit,kitKey,resumeKey,editorKey,personalEditor})=>{
  localStorage.setItem(kitKey,JSON.stringify(kit));
  localStorage.setItem(editorKey,personalEditor);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{...start,facing:2},townLayout:5,
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:start.y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{start,kit,kitKey,resumeKey,editorKey,personalEditor});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await state(page)).position,{x:start.x,z:start.z,level:start.y});
 return {ctx,page,errors};
}
async function scope(browser,start,realm){
 const {ctx,page,errors}=await launch(browser,start);
 try{
  const game=await state(page);
  const living=game.combat.actors.filter(a=>a.level===-1&&a.hp>0);
  const rendered=living.filter(a=>a.visible===true);
  const dragon=living.find(a=>a.type==='monsterDragon');
  const chapel=living.find(a=>a.type==='monsterSkeleton'&&a.x===79&&a.z===78);
  assert(dragon&&chapel,'actual authored dungeon actors remain registered and alive');
  assert.equal(dragon.visible,realm,'living dragon appears only in Otherworld, not behind mine walls');
  assert.equal(chapel.visible,false,'chapel skeleton does not float in either neighboring underground region');
  if(realm)assert(!rendered.some(a=>a.type==='monsterMineGuard'||a.type==='monsterSlime'));
  else{
   assert(rendered.some(a=>a.type==='monsterMineGuard'),'mine golem stays render-eligible');
   assert(rendered.filter(a=>a.type==='monsterSlime').length>=2,'native mine slimes stay render-eligible');
  }
  if(out)await page.screenshot({path:out+'/v200-'+(realm?'otherworld':'mine')+'-scoped.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
const markAt=(m,x,z)=>m.points.some(p=>p.item&&p.x===x+.5&&p.z===z+.5);
async function beacons(browser){
 const {ctx,page,errors}=await launch(browser,{x:124,z:34,y:0},[blade,wrongFloor,distant]);
 try{
  const initial=await stock(page),world=await map(page),url=page.url();
  const beacons=()=>page.evaluate(()=>window.__editorTest.lootMarkProbe());
  await page.waitForFunction(()=>window.__editorTest.lootMarkProbe().vertices>0);
  const markers=await beacons();
  assert(markAt(markers,124,43),'real cached 3D mesh contains the visible saved blade beacon nine tiles away');
  assert(!markAt(markers,124,42),'different-floor drop stays unmarked');
  assert(!markAt(markers,124,50),'drop beyond the 12-tile marker cutoff stays unmarked');
  assert.equal(await stock(page),initial,'showing a marker never grants the item');
  if(out)await page.screenshot({path:out+'/v200-loot-distance-nine.png'});
  for(let z=35;z<=43;z++){
   await page.keyboard.press('ArrowDown');
   await page.waitForFunction(z=>window.__editorTest.facility().position.z===z,z);
   await page.waitForTimeout(210);
  }
  await page.waitForFunction(id=>!JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')).armedDrops.some(d=>d.id===id),blade.id);
  await page.waitForFunction(()=>!window.__editorTest.lootMarkProbe().points.some(p=>p.item&&p.x===124.5&&p.z===43.5));
  const after=await beacons();
  assert(!markAt(after,124,43),'beacon disappears when the actual saved item is picked up');
  assert(!markAt(after,124,42),'different-floor beacon still cannot leak in after movement');
  assert(markAt(after,124,50),'next saved item becomes marked inside range');
  assert((await state(page)).inventory.bag.concat((await state(page)).inventory.hotbar).some(c=>c?.type===blade.type&&c.durability===blade.durability));
  assert.equal(page.url(),url);assert.deepEqual(await map(page),world);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),editorKey),personalEditor);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.DUNGEON_LOOT_CASE!=='beacons'){
  await scope(browser,{x:116,z:60,y:-1},false);
  await scope(browser,{x:100,z:90,y:-1},true);
 }
 if(process.env.DUNGEON_LOOT_CASE!=='scope')await beacons(browser);
 console.log('PASS native portrait dungeon actor scoping and 3D loot beacon distance/floor/pickup');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
