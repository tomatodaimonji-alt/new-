import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

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
const resume=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
async function worldUI(page,playing){
 await page.locator('#facilitySessionActions').waitFor({state:'attached'});
 assert.equal((await page.locator('#facilitySessionName').textContent()).trim(),'ゲーム世界');
 assert.match(await page.title(),/ゲーム世界/);
 await page.waitForFunction(p=>document.getElementById('poiWalkToggle')?.getAttribute('aria-pressed')===String(p),playing);
}
async function ordinary(page){
 await page.waitForFunction(()=>!!window.__editorTest?.state?.().glLink);
 assert.equal(await state(page),null);
 const flat=await page.evaluate(()=>window.__editorTest.state().world);
 assert.deepEqual(flat,map.world,'ordinary editor still displays the actual saved arrangement');
 await unchanged(page);
}
async function poilist(page){
 if(!await page.locator('#poiSampleCategories').isVisible())await page.locator('#showPalette').tap();
 if(!await page.locator('[data-facility-id="base"]').isVisible())
  await page.locator('#poiSampleCategories .categoryRow').tap();
}

let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const errors=[];
 function attach(page){page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);return page;}
 let page=attach(await ctx.newPage());
 await page.goto(origin+'/seed');
 await page.evaluate(f=>{for(const [k,v] of Object.entries(f))localStorage.setItem(k,v)},fixtures);
 await page.goto(origin+'/?test=1');
 await ordinary(page);
 const launch=page.locator('#enterGameWorld');
 assert.equal((await launch.innerText()).trim(),'ゲーム世界へ');
 await launch.tap();
 await page.waitForURL(u=>u.searchParams.get('facility')==='base'&&u.searchParams.get('facility-play')==='1');
 await worldUI(page,true);
 const initial=await state(page);
 assert.equal(initial?.id,'base','world retains base route identity');
 assert.equal(initial.mode,'play');
 assert.deepEqual(initial.position,{x:initial.spawn.x,z:initial.spawn.z,level:0});
 const move=await page.evaluate(()=>{
  const {position:{x,z}}=window.__editorTest.facility();
  for(const [dx,dz,k] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[1,0,'ArrowRight'],[-1,0,'ArrowLeft']])
   if(window.__editorTest.canStep(x+dx,z+dz))return {x:x+dx,z:z+dz,k};
 });
 assert.ok(move,'auto-launch places a controllable player');
 await page.keyboard.press(move.k);
 await page.waitForFunction(({x,z})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;},move);
 const moved=await state(page);
 assert.deepEqual(moved.position,{x:move.x,z:move.z,level:0});
 await unchanged(page);
 const last=await resume(page);
 assert.equal(last.route,'facility');
 assert.equal(last.id,'base');
 assert.equal(last.play,true);
 assert.deepEqual([last.position.x,last.position.z],[move.x,move.z]);

 // Exercise the exact no-test Android load URLs after a new document.
 for(const query of ['', '?revision=1763776800000']){
  await page.close();page=attach(await ctx.newPage());
  await page.goto(origin+'/'+query);
  await worldUI(page,true);
  const returned=await resume(page);
  assert.equal(returned.id,'base');
  assert.deepEqual(returned.position,last.position);
  await unchanged(page);
 }
 await page.goto(origin+'/?resume=1&test=1');
 await worldUI(page,true);
 assert.deepEqual((await state(page)).position,moved.position);

 // Leave the facility explicitly. The facility's local play toggle is not a
 // navigation operation; the facility exit button safely leaves its editor.
 await page.locator('#poiWalkToggle').tap();
 await worldUI(page,false);
 if(!await page.locator('#facilityExit').isVisible())await page.locator('#showPalette').tap();
 await page.locator('#facilityExit').tap();
 await page.waitForURL(u=>u.searchParams.get('facility-return')==='1'&&!u.searchParams.has('facility')&&!u.searchParams.has('facility-play'));
 await ordinary(page);
 assert.equal((await resume(page)).route,'editor');

 // A fresh bottom-button launch can also be left by browser Back, including
 // when loading the return URL afresh rather than preserving the old document.
 await page.locator('#enterGameWorld').tap();
 await page.waitForURL(u=>u.searchParams.get('facility-play')==='1');
 await worldUI(page,true);
 await page.goBack();
 await page.waitForURL(u=>u.searchParams.get('facility-return')==='1'&&!u.searchParams.has('facility-play')&&!u.searchParams.has('facility'));
 await ordinary(page);

 // The gallery entry with the same public label deliberately opens editing.
 await poilist(page);
 const worldEntry=page.locator('[data-facility-id="base"]');
 assert.equal(await worldEntry.evaluate(el=>el.children[1].firstChild.textContent.trim()),'ゲーム世界');
 assert.equal((await page.locator('#legacyAdventureEntry').innerText()).trim(),'旧・冒険マップ');
 await worldEntry.tap();
 await page.waitForURL(u=>u.searchParams.get('facility')==='base'&&!u.searchParams.has('facility-play'));
 await worldUI(page,false);
 assert.equal((await state(page)).editorLevel,0);
 assert.equal((await page.locator('#enterGameWorld').innerText()).trim(),'ゲーム世界へ');
 await unchanged(page);

 // Other facility buttons keep their own map and play locally.
 await poilist(page);
 await page.locator('[data-facility-id="kitchen"]').tap();
 await page.waitForURL(u=>u.searchParams.get('facility')==='kitchen'&&!u.searchParams.has('facility-play'));
 assert.equal((await state(page)).mode,'editor');
 assert.equal((await page.locator('#enterGameWorld').innerText()).trim(),'この施設をプレイ');
 const localURL=page.url();
 await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal(page.url(),localURL);
 assert.equal((await state(page)).id,'kitchen');
 await unchanged(page);
 assert.deepEqual(errors,[]);
 console.log('PASS: Game World mobile shortcut auto-play, real movement, bare/revision relaunch, safe editor return, gallery edit and independent facility play, exact saves');
 await ctx.close();
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
