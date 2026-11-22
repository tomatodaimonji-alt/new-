import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Read the real loot branch, overriding only its single random sample
// in the /tower fixture; never alter saved results or placement rules.
const sampleAnchor='const sample=roll();';
assert.equal(html.split(sampleAnchor).length,2,'unique authored tower random sample');
const towerFixture=html.replace(sampleAnchor,`window.__qaTowerRollCalls=(window.__qaTowerRollCalls||0)+1;
 const seed=sessionStorage.getItem('qa-town-tower-rng');
 const sample=seed!==null?Number(seed):roll();`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/tower')?towerFixture:html);
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
 'world-workshop-audio-v2':'{"master":81,"bgm":62,"se":88,"enabled":true}',
 'qa-unknown-original-user-key':'{"keep":"exact bytes"}'
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


const kitKey='world-workshop-hotbar-v1',clockKey='world-workshop-town-clock-v1',backupKey='world-workshop-game-reset-backup-v1';
const take=page=>page.evaluate(()=>window.__editorTest.data());
const resetDialog=page=>page.locator('#poiResetGameDialog');
const acceptReset=page=>page.locator('#poiResetGameConfirm');
const cancelReset=page=>page.locator('#poiResetGameCancel');
const kit={version:1,weapon:'equipWoodSword',potions:1,gold:91,claimedCaches:['glade'],
 drops:[{type:'healingHerb',x:42,z:43,y:0}]};
const progress=page=>page.evaluate(([kitKey,clockKey,resumeKey])=>[kitKey,clockKey,resumeKey]
 .map(k=>localStorage.getItem(k)),[kitKey,clockKey,resumeKey]);
async function inspectReset(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:45,z:43},{kit,clockStart:19*60,width:320});
 try{
  const original=await take(page);
  const before=await progress(page);
  assert.equal((await state(page)).economy.gold,91);
  assert.equal((await page.locator('#enterGameWorld').innerText()).trim(),'初期化');
  await page.locator('#enterGameWorld').tap();
  await resetDialog(page).waitFor({state:'visible'});
  assert.match(await resetDialog(page).innerText(),/初期化/);
  assert.equal((await progress(page))[0],before[0],'opening confirmation is non-destructive');
  await cancelReset(page).tap();
  await resetDialog(page).waitFor({state:'hidden'});
  assert.equal((await progress(page))[0],before[0],'cancel retains exact equipment, gold, stash and drops bytes');
  assert.equal((await state(page)).economy.gold,91);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),backupKey),null,'cancel creates no reset backup');
  await page.locator('#enterGameWorld').tap();
  await acceptReset(page).tap();
  await page.waitForFunction(()=>{
   const f=window.__editorTest?.facility?.();
   return f?.active&&f.economy.gold===0&&f.position.x===f.spawn.x&&f.position.z===f.spawn.z;
  });
  const backup=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),backupKey);
  assert.equal(backup.version,1);assert.equal(backup.phase,'complete');
  assert.deepEqual(Object.keys(backup.before).sort(),[kitKey,clockKey,resumeKey].sort(),'backup scopes exactly to this playthrough');
  assert.equal(backup.before[kitKey],before[0],'verified recovery backup contains exact old inventory bytes');
  const f=await state(page);
  assert.deepEqual([f.inventory.sword,f.inventory.weapon,f.inventory.potions,f.inventory.drops],
   [true,null,3,[]],'new playthrough default inventory with cleared ground loot');
  assert.equal(f.combat.playerHP,100);
  assert.equal(f.miniMap.location,'拠点');
  assert.ok(f.economy.caches.some(c=>c.id==='glade'),'reset clears prior stash claims');
  assert.ok((await page.evaluate(()=>window.__editorTest.townClock())).minute<9*60,'game clock starts at morning');
  assert.deepEqual(await take(page),original,'authored world remains identical');
  await unchanged(page);
  await page.goto(origin+'/?facility-return=1&test=1');
  await page.locator('#enterGameWorld').waitFor({state:'visible'});
  assert.equal((await page.locator('#enterGameWorld').innerText()).trim(),'ゲーム世界へ','ordinary Editor retains original entry label, never a reset trigger');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}

const chanceKey='qa-town-tower-rng';
const pass={x:108,z:60};
const sampleRoll=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key))?.towerFind??null,kitKey);
const sampleCount=page=>page.evaluate(()=>window.__qaTowerRollCalls??0);
async function roll(page,value){
 await page.evaluate(([key,value])=>sessionStorage.setItem(key,String(value)),[chanceKey,value]);
}
async function reload(page){
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
}
async function repeatTowerFromReset(page){
 await page.evaluate(({key,pos})=>{
  const raw=JSON.parse(localStorage.getItem(key)||'null');
  localStorage.setItem(key,JSON.stringify({...raw,version:1,route:'facility',id:'base',play:true,townLayout:5,
   position:{...pos,y:0,facing:0}}));
 },{key:resumeKey,pos:pass});
 await page.goto(origin+'/tower?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
}
async function tower(browser,success){
 const {ctx,page,errors}=await launch(browser,'base',pass,{width:390,facing:0,fixture:'tower'});
 try{
  const map=await take(page);
  assert.ok(map.world.some(o=>o.x===108&&o.z===60&&o.y===0&&o.type==='ruinDoorBroken'),'authored outdoor ruined tower');
  await roll(page,success ? .20 : .86);
  assert.equal(await sampleRoll(page),null);
  await move(page,'n',true,true);
  await page.waitForFunction(k=>Boolean(JSON.parse(localStorage.getItem(k))?.towerFind),kitKey);
  assert.equal(await sampleCount(page),1,'first real entry rolls exactly once');
  const first=await sampleRoll(page);
  assert.equal(first.kind,success?'herb':'empty');
  await roll(page,success ? .9 : .1);
  await reload(page);
  assert.deepEqual(await sampleRoll(page),first,'recorded outcome unchanged despite different RNG after reload');
  assert.equal(await sampleCount(page),0,'boot does not reroll treasure');
  await move(page,'n');
  await move(page,'w',true,true);
  if(success){
   assert.equal((await state(page)).inventory.potions,4,'one real stray herb is added');
   assert.deepEqual(await sampleRoll(page),{kind:'claimed'});
  }else{
   assert.equal((await state(page)).inventory.potions,3,'empty result never materializes an item');
   assert.deepEqual(await sampleRoll(page),first);
  }
  await move(page,'e');
  await move(page,'w');
  assert.equal((await state(page)).inventory.potions,success?4:3,'same tile never duplicates pickup');
  assert.equal(await sampleCount(page),0);
  await reload(page);
  assert.equal((await state(page)).inventory.potions,success?4:3);
  assert.deepEqual(await take(page),map);
  if(!success){
   await page.locator('#enterGameWorld').tap();
   await acceptReset(page).tap();
   await page.waitForFunction(()=>window.__editorTest?.facility?.().active&&window.__editorTest.facility().economy.gold===0&&
    window.__editorTest.facility().position.x===window.__editorTest.facility().spawn.x);
   assert.equal(await sampleRoll(page),null,'explicit fresh playthrough clears the prior empty outcome');
   await repeatTowerFromReset(page);
   await roll(page,.20);
   await move(page,'n',true,true);
   await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.towerFind?.kind==='herb',kitKey);
   assert.equal(await sampleCount(page),1,'real tower entry can roll again only after confirmed game reset');
  }
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await inspectReset(browser);
 await tower(browser,true);await tower(browser,false);
 console.log('PASS live mobile 320/390 Chromium: game-only reset after explicit confirm, persistent tower pickup/no-find, reset permits one new roll, protected editor saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
