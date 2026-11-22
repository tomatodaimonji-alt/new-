import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// QA only: record actual cached marker vertices and the batches passed to draw().
const spawnAnchor='const p=poiWildPick(rng);';
assert.equal(html.split(spawnAnchor).length,2,'unique wild spawn anchor');
const begin='function poiLootMark(m,x,y,z){';
const drawBegin='function poiLootMarksDraw(vp){';
assert.equal(html.split(begin).length,2,'unique marker geometry');
assert.equal(html.split(drawBegin).length,2,'unique marker renderer');
const gpuDraw='if(poiLootMarksMesh)draw(poiLootMarksMesh,vp);';
assert.equal(html.split(gpuDraw).length,2,'actual marker GPU draw');
const observed=html
 .replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);')
 .replace(begin,`function poiLootMark(m,x,y,z){
    const before=m.p.length;
    try{return __qaLootMark(m,x,y,z)}finally{
     window.__lootMarkSamples.push({x,y,z,vertices:m.p.slice(before)});
    }
 }
 function __qaLootMark(m,x,y,z){`)
 .replace(drawBegin,`function poiLootMarksDraw(vp){
    window.__lootMarkSamples=[];
    window.__lootRendered=false;
    __qaLootMarksDraw(vp);
    if(window.__lootMarkSamples.length)window.__lootLastBuilt=window.__lootMarkSamples;
    else if(!window.__lootRendered)window.__lootLastBuilt=[];
 }
 function __qaLootMarksDraw(vp){`)
 .replace(gpuDraw,`if(poiLootMarksMesh){window.__lootRendered=true;draw(poiLootMarksMesh,vp);}`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observed);
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


const world=page=>page.evaluate(()=>window.__editorTest.data());
const bag=async(page)=>(await state(page)).inventory;
const loot=async(page)=>(await state(page)).economy;
const markerSnapshots=async(page)=>page.evaluate(()=>window.__lootLastBuilt||[]);
const isAt=(x,z)=>(m)=>Math.abs(m.x-(x+.5))<.02&&Math.abs(m.z-(z+.5))<.02;
function smallMarker(sample,x,z){
 assert.ok(sample,'an actual marker was built at '+[x,z]);
 const {vertices:p}=sample;
 assert.ok(p.length>=27&&p.length<=2200,'subtle and limited geometry within one batch');
 assert.ok(Math.max(...p.filter((_,i)=>i%3===0).map(v=>Math.abs(v-sample.x)))<.6,'only local X, not full-tile billboard');
 assert.ok(Math.max(...p.filter((_,i)=>i%3===2).map(v=>Math.abs(v-sample.z)))<.6,'only local Z');
}
async function closeup(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:88,z:55},{width:390,clockStart:720,facing:1,
  kit:{version:1,weapon:null,potions:2,drops:[{type:'healingHerb',x:88,z:55,y:0}]}});
 try{
  const real=await world(page);
  await page.waitForFunction(()=>window.__lootLastBuilt?.length>=2);
  const s=await markerSnapshots(page);
  smallMarker(s.find(isAt(89,55)),89,55);
  smallMarker(s.find(isAt(88,55)),88,55);
  assert.ok(s.length<=12,'local capped group, not broad scenery highlighting');
  if(out)await page.screenshot({path:out+'/v153-loot-cache-herb-390.png'});
  await move(page,'e',true,true);
  assert.equal((await loot(page)).gold,3,'authored marked coin stash actually collectible');
  await move(page,'w',true,true);
  assert.equal((await bag(page)).potions,3,'persisted player item actually collectible');
  await page.waitForFunction(()=>!window.__lootRendered&&window.__lootLastBuilt?.length===0);
  assert.deepEqual(await world(page),real,'readability cue never rewrites map geometry');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function enemyDrop(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:73},{width:320,facing:1});
 try{
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.x===42&&a.z===73&&a.hp===35),null,{timeout:15000});
  assert.ok(!(await markerSnapshots(page)).some(isAt(42,73)),'does not mark the living slime itself');
  const action=page.locator('#poiWalkAction');
  await page.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
  await action.tap();
  await page.waitForTimeout(410);
  await action.tap();
  await page.waitForFunction(()=>window.__lootLastBuilt?.some(m=>Math.abs(m.x-42.5)<.02&&Math.abs(m.z-73.5)<.02));
  assert.equal((await loot(page)).gold,0);
  assert.ok((await loot(page)).drops.some(d=>d.x===42&&d.z===73&&d.amount===3),'actual enemy drops one marked coin stack');
  smallMarker((await markerSnapshots(page)).find(isAt(42,73)),42,73);
  const panel=page.locator('#poiMessagePanel');
  await panel.getByText('スライムを倒した',{exact:true}).waitFor({state:'visible'});
  const heading=panel.getByText('アナウンス',{exact:true});
  assert.ok(await heading.isVisible(),'independent announcement heading visible');
  assert.equal(await panel.locator('.poiMessageLine').filter({hasText:'スライムを倒した'}).count(),1);
  const [h,line]=await Promise.all([heading.boundingBox(),panel.getByText('スライムを倒した',{exact:true}).boundingBox()]);
  assert.ok(h&&line&&h.y+h.height<=line.y+1,'heading is above and distinct from real defeat line');
  assert.doesNotMatch(await page.locator('#toast').innerText(),/スライムを倒した|モンスターを倒した/,'no duplicate defeat under the existing transient toast');
  if(out)await page.screenshot({path:out+'/v153-enemy-loot-mark-320.png'});
  for(let i=0;i<6;i++)await move(page,'s');
  await page.waitForFunction(()=>!window.__lootRendered&&window.__lootLastBuilt?.length===0);
  assert.ok((await loot(page)).drops.some(d=>d.x===42&&d.z===73),'out-of-range hides marker, not loot');
  for(let i=0;i<6;i++)await move(page,'n');
  await page.waitForFunction(()=>window.__lootRendered&&window.__lootLastBuilt?.some(d=>d.x===42.5&&d.z===73.5));
  await move(page,'e',true,true);
  assert.equal((await loot(page)).gold,3);
  assert.ok((await loot(page)).drops.every(d=>d.x!==42||d.z!==73),'collected loot is no longer an item to mark');
  await page.waitForFunction(()=>!window.__lootRendered&&window.__lootLastBuilt?.length===0);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await closeup(browser);
 await enemyDrop(browser);
 console.log('PASS mobile Chromium: bounded in-world pickup markers for real enemy coin drops, authored stash, and a persisted herb, protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
