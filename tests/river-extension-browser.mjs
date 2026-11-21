import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=process.argv[3]&&readFileSync(process.argv[3]);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?baseline:html);
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
const dirs=[[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']];
const pos=(x,z)=>({x,z,level:0});
async function launch(browser,start=[67,38],prefix='/',angle=0){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start:[x,z],angle})=>{
  Object.entries(fixtures).forEach(([k,v])=>localStorage.setItem(k,v));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:0},
   view:{yaw:angle,zoom:1.10,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:angle,orbitPitch:.38,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start,angle});
 await page.goto(origin+prefix+'?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,'base');
 assert.deepEqual((await state(page)).position,pos(...start),'resume places player on selected authored path');
 assert.ok(await page.locator('#view').evaluate(c=>{const gl=c.getContext('webgl');return gl&&!gl.isContextLost();}),'real WebGL terrain context');
 await unchanged(page);
 return {context,page,errors};
}
async function move(page,key,x,z){
 await page.keyboard.press(key);
 await page.waitForFunction(([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z;},[x,z],{timeout:3000})
  .catch(async error=>{throw new Error(key+' did not reach ('+x+','+z+') from track, player is '+JSON.stringify((await state(page)).position),{cause:error});});
 await page.waitForTimeout(177);
}
async function follow(page,points,track){
 let {x,z}= (await state(page)).position;
 for(const [toX,toZ] of points){
  assert.ok(x===toX||z===toZ,'track waypoints must be on same axis: '+[x,z,toX,toZ]);
  const dx=Math.sign(toX-x),dz=Math.sign(toZ-z);
  if(!dx&&!dz)continue;
  const key=dirs.find(d=>d[0]===dx&&d[1]===dz)[2];
  while(x!==toX||z!==toZ){x+=dx;z+=dz;await move(page,key,x,z);track?.add(x+','+z);}
 }
}
async function block(page,key,x,z,reason){
 await page.keyboard.press(key);
 await page.waitForTimeout(182);
 assert.deepEqual((await state(page)).position,pos(x,z),reason);
}
async function capture(page,name,thirdPerson=false){
 if(!out)return;
 if(thirdPerson)await page.locator('#poiThirdView').tap();
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await page.screenshot({path:out+'/'+name+'.png'});
 if(thirdPerson){await page.locator('#poiThirdView').tap();await page.locator('#poiThirdView').tap();}
}
function verifyNewWater(world){
 const water=new Set(world.filter(o=>o.type==='river'&&o.y===0).map(o=>o.x+','+o.z));
 assert.ok(water.has('69,39')&&water.has('80,53'),'deep crossing and south meadow are actual river tiles');
 const connected=new Set(),q=[[69,39]];
 while(q.length){
  const [x,z]=q.pop(),k=x+','+z;
  if(connected.has(k)||!water.has(k))continue;
  connected.add(k);
  for(const [dx,dz] of dirs)q.push([x+dx,z+dz]);
 }
 assert.ok(connected.has('80,53')&&[...connected].some(k=>k.startsWith('95,')),
  'single cardinal watercourse connects old bridge, new bend and east outlet');
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {context,page,errors}=await launch(browser);
 let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});
 const url=page.url();
 const {width,height,world,terrainHeights}=await page.evaluate(()=>window.__editorTest.data());
 assert.deepEqual([width,height],[96,56],'the source map is not widened for this river extension');
 const tile=(x,z,type,y=0)=>world.find(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type);
 for(const [x,z,type,y=0] of [[69,40,'roadCutStoneFull'],[78,46,'ancientAltar'],[86,38,'ruinDoorBroken'],[85,38,'towerBattlement',2],
  [84,41,'rubble'],[75,41,'bushFern'],[80,42,'tallGrass'],[80,48,'bushFlower'],[75,38,'rockGranite'],[76,37,'treePine'],[75,48,'watersideRock']])
  assert.ok(tile(x,z,type,y),'actual authored '+type+' present at '+[x,z,y]);
 for(const [x,rot] of [[68,3],[69,1]])assert.equal(tile(x,38,'bridgeStoneEnd')?.rot,rot,'old crossings retain orientation');
 for(const [x,z] of [[69,40],[70,40],[71,40]])assert.equal(terrainHeights.find(h=>h.x===x&&h.z===z)?.h??0,0,'old wash approach remains flat '+[x,z]);
 verifyNewWater(world);
 await follow(page,[[69,38]]);
 await block(page,'ArrowDown',69,38,'old deep water still blocks movement');
 await follow(page,[[70,38],[70,40],[69,40],[71,40],[71,38],[74,38]]);
 await block(page,'ArrowRight',74,38,'a large granite boulder cannot be traversed');
 await follow(page,[[74,37],[75,37]]);
 await block(page,'ArrowRight',75,37,'trunk stays solid even after scenery walkability changes');
 await follow(page,[[74,37],[74,38],[73,38],[73,42],[75,42],[75,41],[75,42],[76,42],[76,44],[80,44],[80,42],[80,44],[81,44]]);
 await follow(page,[[81,48],[80,48],[81,48],[81,44]]); // Through a real flowering bush, not only its nearby ground patch.
 await follow(page,[[83,44],[83,48],[84,48],[84,49]]);
 await block(page,'ArrowDown',84,49,'deep water in the newly extended southern channel blocks');
 await follow(page,[[86,49],[86,50],[87,50],[87,51],[88,51]]);
 await capture(page,'v122-meadow-bend-bank');
 await follow(page,[[87,51],[87,50],[86,50],[86,49],[90,49],[90,42],[87,42],[87,39],[86,39]]);
 await capture(page,'v122-meadow-reconnect-watchtower');
 await follow(page,[[84,39],[84,41]]);
 assert.deepEqual((await state(page)).position,pos(84,41),'real player can stand on old small surface rubble');
 assert.equal(page.url(),url);assert.equal(navigations,0,'whole riverside loop is seamless');
 await unchanged(page);assert.deepEqual(errors,[]);
 await context.close();
 if(out&&baseline){
  for(const [prefix,label] of [['/baseline','v121'],['/','v122']]){
   const pair=await launch(browser,[86,49],prefix,.20);
   await capture(pair.page,label+'-meadow-bend-paired');
   await unchanged(pair.page);
   await pair.context.close();
  }
 }
 console.log('PASS mobile: old bridge/wash, continuous south bend, real shore loop, small decor walkable, solids blocked, original saves intact');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
