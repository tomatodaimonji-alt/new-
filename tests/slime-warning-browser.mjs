import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Fix only the first wild spawn coordinate for repeatable real player combat.
const spawnAnchor='const p=poiWildPick(rng);';
assert.equal(html.split(spawnAnchor).length,2);
const drawAnchor='function poiDrawEnemyThreatTiles(now,vp){';
assert.equal(html.split(drawAnchor).length,2,'live WebGL marker function');
const observed=html.replace(drawAnchor,`function poiDrawEnemyThreatTiles(now,vp){
 const previous=window.__qaThreatDraw;
 const tiles=poiEnemyThreatTiles(now).map(o=>({...o}));
 let wrongFloor=0;
 if(tiles.length){
  const floor=poiWalkLevel;
  try{poiWalkLevel=floor+1;wrongFloor=poiEnemyThreatTiles(now).length;}finally{poiWalkLevel=floor}
 }
 window.__qaThreatDraw={now,tiles,wrongFloor,tint:[...POI_ENEMY_THREAT_TINT],draws:[]};
 window.__qaThreatRecording=true;
 try{__qaDrawEnemyThreatTiles(now,vp);}
 finally{
  window.__qaThreatRecording=false;
  const current=window.__qaThreatDraw;
  if(current.draws.length){(window.__qaThreatHistory??=[]).push(current);if(window.__qaThreatHistory.length>150)window.__qaThreatHistory.shift();}
  if(previous&&!current.draws.length)window.__qaThreatDraw={...current,previousDraws:previous.draws};
 }
}
function __qaDrawEnemyThreatTiles(now,vp){`);
const fixture=observed.replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/player')?fixture:observed);
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
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:680},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const current=new WeakMap();
  for(const Base of [window.WebGLRenderingContext,window.WebGL2RenderingContext]){
   if(!Base)continue;
   const gl=Base.prototype;
   for(const name of ['blendColor','drawArrays']){
    if(!Object.hasOwn(gl,name))continue;
    const native=gl[name];
    gl[name]=function(...args){
     const audit=window.__qaThreatDraw;
     if(name==='blendColor')current.set(this,args);
     else if(window.__qaThreatRecording&&audit){
      audit.draws.push({alpha:current.get(this)?.[3],depth:this.isEnabled(this.DEPTH_TEST),blends:this.isEnabled(this.BLEND),count:args[2]});
     }
     return native.apply(this,args);
    };
   }
  }
 });
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


const originTile=[41,73,0],dodgeTile=[41,74,0];
const kit={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readKit=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
const readMap=page=>page.evaluate(()=>window.__editorTest.data());
const marks=page=>page.evaluate(()=>window.__editorTest.facility().combat.threats??[]);
const seen=async page=>await page.waitForFunction(()=>{
 const f=window.__editorTest.facility(),w=f.combat.threats;
 return w?.length===1&&w[0].x===41&&w[0].z===73&&f.combat.playerHP===100&&w[0];
},null,{timeout:16000,polling:'raf'});
const stamp=w=>[w.x,w.z,w.y??w.level];
async function inputSouth(page){
 // Bypass locator actionability delays: coordinates are taken from the
 // actual D-pad before the warning while ambient renderer is idle.
 await page.touchscreen.tap(...globalTouch.get(page));
}
const globalTouch=new WeakMap();
async function exercise(browser,dodge){
 const start={x:41,z:73};
 const {ctx,page,errors}=await launch(browser,'base',start,{fixture:'player',width:390,facing:1,kit});
 try{
  const authored=await readMap(page);
  const hit=page.locator('[data-poi-dir="s"]');
  const b=await hit.boundingBox();
  assert.ok(b,'actual touch D-pad exists');
  globalTouch.set(page,[b.x+b.width/2,b.y+b.height/2]);
  assert.deepEqual(await marks(page),[],'no marker on a non-attacking tile');
  const first=await seen(page);
  const hot=await first.jsonValue();
  assert.deepEqual(stamp(hot),originTile,'warning singles out original player tile and active floor');
  assert.equal(hot.hit-hot.start,420,'visible, fixed-tile warning is scheduled 420ms before slime contact');
  if(dodge){
   await inputSouth(page);
   await page.waitForFunction(()=>window.__editorTest.facility().position.z===74);
   const p=(await state(page)).position;
   assert.deepEqual([p.x,p.z,p.level],dodgeTile,'sidestep is actual mobile D-pad input');
   const committed=(await marks(page))[0];
   assert.ok(committed,'marker remains committed after sidestep before impact');
   assert.deepEqual(stamp(committed),originTile,'red tile does not follow player');
  }
  await page.waitForFunction(()=>window.__editorTest.facility().combat.threats?.length===0);
  const rendered=await page.evaluate(()=>window.__qaThreatHistory||[]);
  assert.ok(rendered.some(f=>f.tiles.some(t=>t.x===41&&t.z===73&&t.y===0)&&
    f.draws.some(d=>d.depth&&d.blends&&d.count>=6&&d.alpha>=.07&&d.alpha<=.40)),
   'actual depth-tested translucent WebGL draw at original tile: '+JSON.stringify(rendered.slice(-4)));
  assert.ok(rendered.every(f=>f.wrongFloor===0),'active warning is invisible when sampled on another floor');
  assert.ok(rendered.every(f=>f.tint[0]===1&&f.tint[1]>.45&&f.tint[1]<.70&&f.tint[2]>.40&&f.tint[2]<.65),'muted warm-red, not a fully saturated red flash');
  assert.ok(rendered.every(f=>f.tiles.every(t=>t.x===41&&t.z===73&&t.y===0)),'GPU warning coordinates never follow the dodge');
  await page.waitForFunction(()=>!window.__qaThreatDraw?.draws.length);
  const result=await state(page);
  assert.equal(result.combat.playerHP,dodge?100:94,dodge?'warning allows sidestep, no early/chasing damage':'standing on the warned tile incurs one unmodified attack');
  await page.waitForTimeout(260);
  assert.equal((await state(page)).combat.playerHP,dodge?100:94,'no duplicate damage during recovery');
  assert.deepEqual(await readMap(page),authored);
  assert.deepEqual(await readKit(page),kit);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,false);await exercise(browser,true);
 console.log('PASS 390px Chromium: live slime warning only during committed attack, actual touch dodge stays off original tile, stand still takes exact hit once');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
