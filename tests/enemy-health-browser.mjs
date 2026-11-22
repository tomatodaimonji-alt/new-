import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Fixture only: deterministic ordinary wild spawn and a read-only tap of the
// actual WebGL projection used by each live enemy bar, no health or layout edits.
const spawnAnchor='const p=poiWildPick(rng);';
const poseAnchor='const pose=poiMonsterPose(obj,state,now);';
const renderAt=html.indexOf('function poiRenderEnemyHealth('),poseAt=html.indexOf(poseAnchor,renderAt);
assert.equal(html.split(spawnAnchor).length,2);
assert.ok(poseAt>renderAt&&poseAt<html.indexOf('function poiMonsterAt(',renderAt));
const probe="if(state.wildSpawn){window.__enemyProjection={vp:Array.from(vp),pose:{...pose}};}";
const instrumented=(html.slice(0,poseAt+poseAnchor.length)+probe+html.slice(poseAt+poseAnchor.length))
 .replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':instrumented);
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

const selector='#poiEnemyHud progress.poiEnemyHealth[aria-label="スライムのHP"]';
async function styleProjection(page){
 const visual=await page.evaluate(sel=>{
  const p=window.__enemyProjection,bar=document.querySelector(sel),canvas=document.querySelector('#view');
  if(!p||!bar)return null;
  const {x,y,z}=p.pose,m=p.vp;
  const proj=h=>{
   const w=m[3]*x+m[7]*(y+h)+m[11]*z+m[15];
   return [(1+(m[0]*x+m[4]*(y+h)+m[8]*z+m[12])/w)*canvas.clientWidth/2,
    (1-(m[1]*x+m[5]*(y+h)+m[9]*z+m[13])/w)*canvas.clientHeight/2];
  };
  const r=bar.getBoundingClientRect(),c=canvas.getBoundingClientRect(),s=getComputedStyle(bar);
  return {bar:[r.x-c.x+r.width/2,r.bottom-c.y],priorHead:proj(.83),expected:proj(.94),
   width:r.width,height:r.height,radius:parseFloat(s.borderRadius),outline:s.borderTopWidth,
   surface:s.backgroundColor,tint:getComputedStyle(document.querySelector('#poiWalkPad')).backgroundColor,
   opacity:s.opacity,track:getComputedStyle(bar,'::-webkit-progress-bar').backgroundColor};
 },selector);
 assert.ok(visual,'bar is projected from an actual live generated monster');
 const [x,y]=visual.bar;
 assert.ok(Math.abs(x-visual.expected[0])<=1.1&&Math.abs(y-(visual.expected[1]-10))<=1.1,
  'exact registered pose high anchor + screen offset: '+JSON.stringify(visual));
 assert.ok(visual.priorHead[1]-y>=10,'bottom is above original head anchor by >=10 px');
 assert.ok(visual.priorHead[1]-8-y>=1.5,'raised above the former placement');
 assert.ok(visual.width>=29&&visual.height===8&&visual.radius>=4);
 assert.equal(visual.outline,'1px');
 assert.equal(visual.surface,visual.tint,'empty track uses translucent UI tint');
 assert.equal(visual.opacity,'1','whole status bar is not uniformly dimmed');
 return visual;
}
async function exercise(browser,width){
 const {ctx,page,errors}=await launch(browser,'base',{x:41,z:73},{width,facing:1});
 try{
  const bar=page.locator(selector);
  await bar.waitFor({state:'visible',timeout:15000});
  assert.equal(await bar.evaluate(e=>e.max),35);
  assert.equal(await bar.evaluate(e=>e.value),35);
  const pose=await styleProjection(page);
  if(out)await page.screenshot({path:out+'/v152-enemy-health-full-'+width+'.png'});
  await page.locator('#poiHotbar [data-hotbar-slot="0"]').tap();
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(sel=>document.querySelector(sel)?.value===7,selector);
  assert.equal((await state(page)).combat.actors.find(a=>a.wildSpawn).hp,7,'actual sword hit leaves 7/35 live HP');
  await styleProjection(page);
  if(out)await page.screenshot({path:out+'/v152-enemy-health-hit-'+width+'.png'});
  await page.waitForTimeout(410);
  await page.locator('#poiWalkAction').tap();
  await bar.waitFor({state:'detached'});
  assert.ok(!(await state(page)).combat.actors.some(a=>a.wildSpawn&&a.hp>0&&a.x===42&&a.z===73));
  assert.ok((await state(page)).economy.drops.some(a=>a.x===42&&a.z===73),'normal lethal path and coin loot still works');
  assert.deepEqual(errors,[]);await unchanged(page);
  console.log(JSON.stringify({width,projection:pose,health:[35,7,0]}));
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,390);
 console.log('PASS 390px Chromium: raised native monster HP bar on live WebGL projection, true combat/defeat and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
