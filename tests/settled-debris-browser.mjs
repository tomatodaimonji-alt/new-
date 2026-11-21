import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const trigger='  spawn={x:19,z:21};';
assert.equal(html.toString().split(trigger).length,2,'temporary QA creature fixture anchor');
const testWorld=html.toString().replace(trigger,"  put(20,21,'monsterGoblin');put(18,21,'monsterGoblin');\n"+trigger);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':testWorld);
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
const center='#poiWalkAction';
const arrows={east:'ArrowRight',west:'ArrowLeft'};
async function setup(browser){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey})=>{
  Object.entries(fixtures).forEach(([k,v])=>localStorage.setItem(k,v));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:19,z:21,y:0,facing:1}}));
 },{fixtures,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 return {ctx,page,errors};
}
function fingerprint(p){
 return p.parts.map(({x,z,y})=>[x-p.x,z-p.z,y].map(v=>Number(v.toFixed(4)))).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
}
async function defeat(page,x,direction,sequence){
 await page.keyboard.press(arrows[direction]);
 assert.deepEqual((await state(page)).position,{x:19,z:21,level:0},'live goblin blocks the facing step');
 const hp=()=>page.evaluate(x=>window.__editorTest.facility().combat.actors.find(o=>o.type==='monsterGoblin'&&o.x===x&&o.z===21)?.hp,x);
 assert.equal(await hp(),55);
 await page.locator(center).tap();
 assert.equal(await hp(),27,'wood sword injures but does not kill a 55HP goblin on first hit');
 await page.waitForTimeout(370);
 await page.locator(center).tap();
 assert.equal(await hp(),0,'second real hit kills the goblin');
 const post=(await state(page)).combat;
 assert.equal(post.effects,sequence,'exactly one debris group per actual defeat');
 assert.ok(post.debris.some(d=>d.type==='monsterGoblin'),'actual goblin geometry scatters');
 await page.waitForTimeout(365);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {ctx,page,errors}=await setup(browser);
 try{
  const map=await page.evaluate(()=>window.__editorTest.data());
  assert.deepEqual((await state(page)).combat.actors.filter(a=>a.type==='monsterGoblin').map(a=>[a.x,a.z,a.hp]),[[20,21,55],[18,21,55]]);
  await page.keyboard.press('2');
  await defeat(page,20,'east',1);
  await defeat(page,18,'west',2);
  await page.waitForFunction(()=>{const d=window.__editorTest.facility().combat.debris;return d.length===2&&d.every(x=>x.phase==='settled');});
  const settled=(await state(page)).combat.debris;
  for(const d of settled){
   assert.ok(d.type==='monsterGoblin'&&d.parts.length>=3,'body broke into multiple model fragments');
   assert.ok(d.parts.every(p=>[p.x,p.z,p.y].every(Number.isFinite)),'settled trajectories have finite real landings');
   assert.ok(d.parts.some(p=>Math.hypot(p.x-d.x,p.z-d.z)>.35),'pieces actually travel from the corpse footprint');
  }
  const patterns=settled.map(fingerprint);
  assert.notDeepEqual(patterns[0],patterns[1],'same monster model produces different relative landing patterns on consecutive defeats');
  // A small delay and render ensure the settled pieces are still real and
  // stable, rather than continuously hopping or recomputing random positions.
  await page.waitForTimeout(300);
  assert.deepEqual((await state(page)).combat.debris.map(fingerprint),patterns,'debris stays frozen on the ground');
  if(out)await page.screenshot({path:out+'/v130-two-varied-settled-goblin-defeats.png'});
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>window.__editorTest.facility().position.x===20);
  assert.equal((await state(page)).combat.effects,2,'debris remains visible but does not impede walking through the old enemy tile');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),map,'temporary monsters and fragments never alter authored map');
  await unchanged(page);
  await page.waitForFunction(()=>window.__editorTest.facility().combat.effects===0,null,{timeout:15500});
  assert.deepEqual((await state(page)).combat.debris,[],'settled fragments eventually clear');
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest.facility().active);
  assert.equal((await state(page)).combat.effects,0,'old debris never restores from the saved play session');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
 console.log('PASS real Chromium: two varied goblin breaks, stable grounded debris, clear movement, bounded cleanup, and protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
