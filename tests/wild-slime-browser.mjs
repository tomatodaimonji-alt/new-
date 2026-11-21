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
const range='#poiEnemyHud .poiEnemyHealth';
const open='#enterGameWorld';
const actor=async page=>(await state(page)).combat.actors.find(x=>x.wildSpawn&&x.hp>0);
async function launch(browser,id='base',start={x:19,z:46}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:0,facing:2}}));
 },{fixtures,resumeKey,id,start});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
const dirs={n:[0,-1],s:[0,1],e:[1,0],w:[-1,0]};
const arrow={n:'ArrowUp',s:'ArrowDown',e:'ArrowRight',w:'ArrowLeft'};
async function move(page,d,required=true){
 const {x,z}=(await state(page)).position,[dx,dz]=dirs[d];
 await page.keyboard.press(arrow[d]);
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
 await page.screenshot({path:out+'/v130-'+name+'.png'});
}
function assertNoSlime(info){
 assert.equal(info.combat.actors.filter(x=>x.wildSpawn&&x.hp>0).length,0);
}
async function safeZones(browser){
 for(const [id,start] of [['base',{x:19,z:46}],['lodging',null]]){
  const {ctx,page,errors}=await launch(browser,id,start);
  try{
   assert.equal(await page.evaluate(()=>document.hidden),false,'safe test must genuinely be foregrounded');
   await page.waitForTimeout(id==='base'?10000:600);
   assert.equal((await state(page)).wildSpawn.nextIn,0,'safe-zone timer remains disarmed');
   assertNoSlime(await state(page));
   assert.equal(await page.locator(range).count(),0,'safe area has no floating enemy bar');
   await unchanged(page);assert.deepEqual(errors,[]);
  }finally{await ctx.close();}
 }
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
async function encounter(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:67,z:38});
 try{
  const oldMap=await page.evaluate(()=>window.__editorTest.data());
  assertNoSlime(await state(page)); // The timer, not entering the map, summons the enemy.
  for(let i=0;i<6;i++)await move(page,'e');
  for(let i=0;i<4;i++)await move(page,'s');
  assert.equal((await state(page)).miniMap.location,'外');
  // Genuine wall-clock game timing. Keep renderer, pointer events and
  // requestAnimationFrame on the browser's native clock.
  const schedule=(await state(page)).wildSpawn;
  assert.ok(Number.isFinite(schedule.nextIn)&&schedule.nextIn>=0);
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.hp>0),null,{timeout:22000,polling:150})
   .catch(async err=>{throw new Error('No slime after 22s: '+JSON.stringify((await state(page)).wildSpawn),{cause:err});});
  const slime=await actor(page);assert.ok(slime,'time in the field rolls a genuine encounter');
  assert.equal(slime.type,'monsterSlime');assert.equal(slime.hp,35);
  assert.equal(oldMap.world.some(o=>o.type==='monsterSlime'&&o.x===slime.x&&o.z===slime.z),false,'not authored map content');
  await approachActor(page);
  const bar=page.locator(range).first();
  await bar.waitFor({state:'visible'});
  assert.equal(await bar.getAttribute('aria-label'),'スライムのHP');
  assert.equal(await bar.evaluate(e=>e.max),35);
  assert.equal(await bar.evaluate(e=>e.value),35);
  await capture(page,'wild-slime-hp-full');
  await faceAndSwing(page,'hand');
  await page.waitForFunction(css=>Array.from(document.querySelectorAll(css)).some(e=>e.value===15),range);
  await capture(page,'wild-slime-hp-after-hit');
  await page.waitForTimeout(350);
  await faceAndSwing(page,'sword');
  const after=(await state(page)).combat;
  assert.ok(!after.actors.some(a=>a.wildSpawn&&a.hp>0),'true hit killed the temporary slime');
  assert.equal(after.effects,1,'the real death starts one transient WebGL scatter burst');
  await page.waitForFunction(()=>!document.querySelector('#poiEnemyHud .poiEnemyHealth'));
  await page.waitForTimeout(1150);
  const resting=(await state(page)).combat;
  assert.equal(resting.effects,1,'slime fragments remain after the former 720ms cutoff');
  assert.ok(resting.debris.some(d=>d.type==='monsterSlime'&&d.phase==='settled'&&d.parts.length>=3),'actual slime fragments are resting, not stationary fake actors');
  await capture(page,'wild-slime-settled-fragments');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),oldMap,'spawn/combat never enters editor/save geometry');
  await unchanged(page);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assertNoSlime(await state(page));
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),oldMap,'reloading does not restore destroyed temporary actor as a tile');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await safeZones(browser);await encounter(browser);
 console.log('PASS timed weak slime outside only, current floating HP, real punch/sword defeat, transient state and protected original saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
