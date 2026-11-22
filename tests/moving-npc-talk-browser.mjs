import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// In the isolated test origin, feed a legitimate cardinal movement step to
// a real resident at a real map corner. Do not replace any targeting logic.
const routine='function poiTownNpcRoutine(a,clock,now,budget){';
assert.equal(html.split(routine).length,2);
const observed=html.replace(routine,`function poiTownNpcRoutine(a,clock,now,budget){
 const variant=location.pathname.slice(1);
 if(!['active','stationary','distant','blocked'].includes(variant))return __qaNpcRoutine(a,clock,now,budget);
 if(a.role.id!=='westpeddler'){a.recessed=true;return}
 for(const other of poiTownNpcActors)if(other!==a)other.recessed=true;
 const x=variant==='distant'?58:variant==='blocked'?56:57,z=variant==='blocked'?38:39;
 window.__qaNpcRuns=(window.__qaNpcRuns||0)+1;
 Object.assign(a,{x,z,y:0,fromX:x,fromZ:z+1,fromY:0,moveAt:variant==='stationary'?now-1000:now,
   activity:'walk',recessed:false,target:null,hitAt:null,death:null,gestureAt:null});
}
function __qaNpcRoutine(a,clock,now,budget){`);
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
const action='#poiWalkAction',menu='#poiNpcMenu';
const talk=/話す|会話/;
const prompt=page=>page.locator(action).getAttribute('aria-label');
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
const kit={version:1,weapon:null,potions:3,gold:12};
const running=(page)=>page.evaluate(()=>window.__qaNpcRuns);
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
async function fixture(browser,variant){
 const position=variant==='blocked'?{x:55,z:39}:{x:56,z:40};
 const {ctx,page,errors}=await launch(browser,'base',position,{width:390,clockStart:9*60,facing:0,kit,fixture:variant});
 try{
  const map=await getMap(page);
  await page.waitForFunction(()=>window.__qaNpcRuns>=1);
  const a=(await residents(page)).actors.find(a=>a.id==='westpeddler');
  const expectedX=variant==='distant'?58:variant==='blocked'?56:57,expectedZ=variant==='blocked'?38:39;
  assert.deepEqual([a.x,a.z,a.y],[expectedX,expectedZ,0],'real resident’s logical destination matches fixture');
  const cardinal=await page.evaluate(p=>{
   const app=window.__editorTest;return [app.canStep(p.x,p.z-1,p.x,p.z),app.canStep(p.x+1,p.z,p.x,p.z)];
  },position);
  assert.deepEqual(cardinal,variant==='blocked'?[false,true]:[true,true],'actual map confirms both approaches or the solid corner');
  const start=(await state(page)).position;
  if(variant==='active'){
   await page.waitForFunction(()=>/話す|会話/.test(document.querySelector('#poiWalkAction').getAttribute('aria-label')||''));
   await page.locator(action).tap();
   await page.locator(menu).waitFor({state:'visible'});
   assert.equal((await residents(page)).dialogue.id,'westpeddler','real action speaks to the moving diagonal actor');
   const held=await running(page);
   await page.waitForTimeout(870);
   assert.equal((await residents(page)).dialogue.id,'westpeddler','dialogue stays with the same actor after motion settles');
   assert.equal(await running(page),held,'actual resident routine is held only while conversation is open');
   assert.deepEqual((await state(page)).position,start);
   await page.locator(menu+' > button[data-npc-action="talk"]').tap();
   assert.equal((await residents(page)).dialogue.id,'westpeddler');
   if(out)await page.screenshot({path:out+'/v188-dialogue-moving-npc.png'});
   await page.keyboard.press('Escape');
   await page.locator(menu).waitFor({state:'hidden'});
   await page.waitForFunction(n=>window.__qaNpcRuns>n,held);
  }else{
   assert.doesNotMatch(await prompt(page)||'',talk,'no relaxed prompt for '+variant);
   await page.locator(action).tap();
   await page.waitForTimeout(150);
   assert.equal(await page.locator(menu).isVisible(),false,'native touch does not open dialogue for '+variant);
   assert.equal((await residents(page)).dialogue,null);
  }
  assert.deepEqual(await getMap(page),map);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const mode of ['active','stationary','distant','blocked'])await fixture(browser,mode);
 console.log('PASS mobile walking-diagonal talk, stable conversation freeze/resume, stationary/distant/corner fallbacks rejected');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
