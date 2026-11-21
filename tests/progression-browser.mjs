import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
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
const actor=async page=>(await state(page)).combat.actors.find(x=>x.wildSpawn&&x.hp>0);
const kitKey='world-workshop-hotbar-v1';
async function launch(browser,id='base',start={x:19,z:46},kit=null){
 const ctx=await browser.newContext({viewport:{width:320,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,kitKey,kit})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(kit)localStorage.setItem(kitKey,JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:2,...start}}));
 },{fixtures,resumeKey,id,start,kitKey,kit});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true,touch=false){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 if(touch)await page.locator('[data-poi-dir='+d+']').tap();else await page.keyboard.press(arrow[d]);
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
async function faceAndSwing(page,style){
 if(style==='sword')await page.keyboard.press('2');else await page.keyboard.press('1');
 const angle=await page.evaluate(()=>{
  const {position,combat}=window.__editorTest.facility(), mob=combat.actors.find(a=>a.wildSpawn&&a.hp>0);
  if(!mob)return null;
  const dx=mob.x-position.x,dz=mob.z-position.z;
  return Math.abs(dx)+Math.abs(dz)===1&&(dx>0?'e':dx<0?'w':dz>0?'s':'n');
 });
 assert.ok(angle,'slime moves into actual melee range');
 const old=(await state(page)).position;
 // Attempting to step into the occupied tile is blocked, but the shared
 // D-pad input correctly faces the player toward the adjacent enemy.
 await page.keyboard.press(arrow[angle]);
 assert.deepEqual((await state(page)).position,old);
 await page.locator('#poiWalkAction').tap();
}
async function capture(page,name){
 if(!out)return;
 await page.screenshot({path:out+'/v136-'+name+'.png'});
}
async function approachActor(page){
 for(let i=0;i<25;i++){
  const next=await page.evaluate(()=>{
   const api=window.__editorTest,{position:p,combat}=api.facility(),mob=combat.actors.find(a=>a.wildSpawn&&a.hp>0);
   if(!mob)return null;
   const steps=[[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']];
   const seen=new Set([p.x+','+p.z]),q=[{x:p.x,z:p.z,d:null}];
   for(let j=0;j<q.length;j++){
    const {x,z,d}=q[j];
    if(Math.abs(x-mob.x)+Math.abs(z-mob.z)===1)return {d};
    for(const [dx,dz,key] of steps){
     const xx=x+dx,zz=z+dz,k=xx+','+zz;
     if(xx<60||xx>95||zz<18||zz>55||seen.has(k)||!api.canStep(xx,zz,x,z))continue;
     seen.add(k);q.push({x:xx,z:zz,d:d??key});
    }
   }
   return null;
  });
  if(next?.d===null)return;
  if(next?.d)await move(page,next.d,false);else await page.waitForTimeout(450);
 }
 assert.fail('real player could not approach the spawned enemy');
}
const shop='#poiShopDialog',buy='#poiShopBuyPotion',close='#poiShopClose';
const balance='#poiGoldValue';
const economy=async page=>(await state(page)).economy;
const persisted=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),kitKey);
const coord=(x,z)=>({x,z,level:0});
const at=(o,x,z)=>o.x===x&&o.z===z;
function direction(from,to){
 const result=Object.entries(dirs).find(([, [x,z]])=>at(to,from.x+x,from.z+z))?.[0];
 assert.ok(result,'target must be an actual cardinal-adjacent tile');return result;
}
async function roundTrip(page){
 await page.reload();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
}
async function relocateResumeFixture(page,x,z){
 // Travel here is not being tested; set only the disposable Android resume
 // coordinate between scenarios, never write wallet, inventory, map or POIs.
 await page.evaluate(({k,x,z})=>{
  const s=JSON.parse(localStorage.getItem(k));
  s.position={x,z,y:0,facing:0};
  localStorage.setItem(k,JSON.stringify(s));
 },{k:resumeKey,x,z});
 await roundTrip(page);
 assert.deepEqual((await state(page)).position,coord(x,z));
}
async function openShop(page){
 await move(page,'n',true,true);
 assert.deepEqual((await state(page)).position,coord(47,13));
 await page.keyboard.press('ArrowRight'); // Counter stays solid but turns player.
 assert.deepEqual((await state(page)).position,coord(47,13));
 const action=page.locator('#poiWalkAction');
 assert.match(await action.innerText(),/買う/);
 await action.tap();
 const dialog=page.locator(shop);
 await dialog.waitFor({state:'visible'});
 const r=await dialog.boundingBox();
 assert.ok(r&&r.x>=-1&&r.y>=-1&&r.x+r.width<=321&&r.y+r.height<=741,'toolshop is usable on a 320px touch viewport');
 await page.keyboard.press('ArrowDown');
 assert.deepEqual((await state(page)).position,coord(47,13),'shop pane consumes movement input while open');
 return dialog;
}
async function deniedPurchase(page,description){
 const before=await persisted(page);
 const button=page.locator(buy);
 if(await button.isEnabled())await button.tap();
 else assert.equal(await button.isDisabled(),true);
 assert.deepEqual(await persisted(page),before,description);
}
async function progression(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:67,z:34});
 try{
  const originalWorld=await page.evaluate(()=>window.__editorTest.data());
  const initial=(await state(page)).combat.actionAt;
  const beginning=await economy(page);
  assert.equal(beginning.gold,0);
  assert.equal(beginning.potions,3);
  assert.ok(beginning.caches.some(c=>c.id==='glade'&&at(c,67,33)&&c.amount===3),'collectible cache exists, without combat');
  await move(page,'n',true,true);
  assert.equal((await economy(page)).gold,3);
  assert.equal((await state(page)).combat.actionAt,initial,'no combat action needed to acquire outdoor cache');
  assert.ok(!(await economy(page)).caches.some(c=>c.id==='glade'));
  const chosen=await persisted(page);
  assert.equal(chosen.gold,3);
  assert.ok(chosen.claimedCaches.includes('glade'));
  await capture(page,'gold-from-stash');
  await roundTrip(page);
  assert.equal((await economy(page)).gold,3);
  await move(page,'s');
  await move(page,'n');
  assert.equal((await economy(page)).gold,3,'revisiting claimed cache after resume grants nothing');
  for(let i=0;i<5;i++)await move(page,'s');
  for(let i=0;i<6;i++)await move(page,'e');
  for(let i=0;i<4;i++)await move(page,'s');
  // Natural native gameplay timing, as in the established wild encounter test.
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.hp>0),null,{timeout:22000,polling:150});
  await approachActor(page);
  const slime=await actor(page);assert.ok(slime&&slime.hp===35);
  await faceAndSwing(page,'hand');
  await page.waitForTimeout(370);
  await faceAndSwing(page,'sword');
  const loot=await economy(page);
  assert.equal(loot.gold,3,'defeat does not auto-credit the player');
  const coin=loot.drops.find(c=>at(c,slime.x,slime.z));
  assert.ok(coin&&coin.amount===3,'real wild slime produces three step-over coins');
  const toCoin=direction((await state(page)).position,coin);
  await move(page,toCoin,true,true);
  assert.deepEqual((await state(page)).position,coord(coin.x,coin.z),'coin does not act as a collision object');
  assert.equal((await economy(page)).gold,6,'walking onto coin gives the exact reward once');
  assert.ok(!(await economy(page)).drops.some(c=>at(c,coin.x,coin.z)));
  const back=({n:'s',s:'n',w:'e',e:'w'})[toCoin];
  await move(page,back); await move(page,toCoin);
  assert.equal((await economy(page)).gold,6,'re-entering former coin tile does not duplicate');
  await roundTrip(page);
  assert.equal((await economy(page)).gold,6,'coin wallet survives actual restart');
  assert.equal((await economy(page)).drops.length,0,'transient coins do not resurrect on restart');
  await relocateResumeFixture(page,47,14);
  assert.ok(originalWorld.world.some(o=>at(o,48,13)&&o.type==='counterLuxury'&&o.rot===1),'real toolshop counter, not fixture UI');
  await openShop(page);
  await capture(page,'toolshop-320');
  const goldText=await page.locator(balance).textContent();
  assert.match(goldText,/6/);
  await page.locator(buy).tap();
  assert.deepEqual([(await economy(page)).gold,(await economy(page)).potions],[0,4],'real 6-coin purchase grants one and debits once');
  await deniedPurchase(page,'insufficient funds do not mutate inventory or wallet');
  await page.locator(close).tap();
  assert.equal(await page.locator(shop).isVisible(),false);
  await roundTrip(page);
  const purchased=await economy(page);
  assert.deepEqual([purchased.gold,purchased.potions,purchased.caches.some(c=>c.id==='glade')],[0,4,false]);
  const raw=await persisted(page);
  assert.equal(raw.potions,4);
  assert.ok(raw.claimedCaches.includes('glade'));
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),originalWorld,'all loot/checkout state lives outside editor geometry');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function capacity(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:47,z:14},{version:1,weapon:null,potions:9,gold:12,claimedCaches:['glade']});
 try{
  await openShop(page);
  await deniedPurchase(page,'full 9-potion stack rejects a purchase even with enough coins');
  const e=await economy(page);assert.deepEqual([e.gold,e.potions],[12,9]);
  await page.keyboard.press('Escape');
  assert.equal(await page.locator(shop).isVisible(),false);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await progression(browser);await capacity(browser);
 console.log('PASS 320px Chromium: touch stash/coin, natural slime, real checkout, insufficient/capacity guards, persisted balance/stock, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
