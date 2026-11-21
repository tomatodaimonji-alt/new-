import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

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
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const width=96;
const OUT_TO_SHRINE=[[73,38],[73,42],[76,42],[76,44],[78,44],[78,45]];
const SHRINE_TO_MIDPOINT=[[78,44],[81,44]];
const MIDPOINT_TO_TOWER=[[81,39],[86,39],[86,38]];
const RETURN_POINTS=[[86,34],[86,28],[76,28],[76,26],[68,26],[68,30],[67,30],[67,33],[67,38]];
const dirs=[[1,0,'ArrowRight'],[-1,0,'ArrowLeft'],[0,1,'ArrowDown'],[0,-1,'ArrowUp']];
const pos=(x,z)=>({x,z,level:0});
let navigationCount=0;
async function launchAtApproach(browser){
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey})=>{
  Object.entries(fixtures).forEach(([k,v])=>localStorage.setItem(k,v));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:67,z:38,y:0,facing:0}}));
 },{fixtures,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,'base');
 assert.deepEqual((await state(page)).position,pos(67,38),'start on the old west approach');
 await unchanged(page);
 return {context,page,errors};
}
async function orbit(page,delta){
 const y=397,from=delta>0?290:105,to=from-delta;
 await page.mouse.move(from,y);
 await page.mouse.down();
 await page.mouse.move(to,y,{steps:6});
 await page.mouse.up();
}
async function capture(page,name,thirdPerson=true,viewTower=false){
 if(!out)return;
 if(thirdPerson)await page.locator('#poiThirdView').tap();
 if(viewTower){await orbit(page,150);await orbit(page,150);}
 try{
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:out+'/v120-'+name+'.png'});
 }finally{
  if(viewTower){await orbit(page,-150);await orbit(page,-150);}
  if(thirdPerson){await page.locator('#poiThirdView').tap();await page.locator('#poiThirdView').tap();}
 }
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
async function block(page,key,x,z){
 await page.keyboard.press(key);
 await page.waitForTimeout(182);
 assert.deepEqual((await state(page)).position,pos(x,z),'deep creek must remain impassable next to the stone bridge');
}
async function reloadLikeAndroid(context,last,errors){
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/?revision=1763776800000');
 await page.waitForFunction(()=>document.querySelector('#poiWalkToggle')?.getAttribute('aria-pressed')==='true');
 assert.match(await page.title(),/ゲーム世界/);
 assert.deepEqual((await resume(page)).position,last.position,'numeric app revision reload preserves far-east position');
 await unchanged(page);
 // Real movement on the uninstrumented Android-style URL proves that the live
 // player was restored here, rather than the game merely retaining stale bytes.
 await page.keyboard.press('ArrowUp');
 const loadedNext={x:last.position.x,z:last.position.z-1};
 await page.waitForFunction(({key,x,z})=>{
  const saved=JSON.parse(localStorage.getItem(key));
  return saved?.id==='base'&&saved.play&&saved.position.x===x&&saved.position.z===z;
 },{key:resumeKey,...loadedNext});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await state(page)).position,pos(loadedNext.x,loadedNext.z));
 return page;
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {context,page:initialPage,errors}=await launchAtApproach(browser);
 let page=initialPage;
 const recordNavigation=p=>{
  navigationCount=0;
  p.on('framenavigated',f=>{if(f===p.mainFrame())navigationCount++;});
  return p.url();
 };
 let url=recordNavigation(page);
 const {width:w,height,world,terrainHeights}=await page.evaluate(()=>window.__editorTest.data());
 assert.deepEqual([w,height],[width,56],'finite seamless region extends only east');
 assert.equal(await page.evaluate(w=>window.__editorTest.canStep(w,38),w),false,'east world border is still finite');
 const ground=(x,z)=>world.filter(o=>o.x===x&&o.z===z&&o.y===0);
 for(const [x,rot] of [[68,3],[69,1]])assert.ok(ground(x,38).some(o=>o.type==='bridgeStoneEnd'&&o.rot===rot),'old stone bridge end remains '+x);
 for(const [x,z] of [[70,39],[70,40],[69,40],[71,39],[71,40]]){
  assert.equal(terrainHeights.find(h=>h.x===x&&h.z===z)?.h??0,0,'flat wash landing and bank '+[x,z]);
  assert.ok(!ground(x,z).some(o=>o.type==='terrainStairs'),'old outdoor wash stairs removed '+[x,z]);
 }
 assert.ok(ground(78,46).some(o=>o.type==='ancientAltar'),'side trail ends in a real shrine, not an empty waypoint');
 // An architectural footprint, not a POI ID or an unverified route marker.
 const tower=world.filter(o=>o.y===0&&o.x>=84&&o.x<=88&&o.z>=34&&o.z<=38&&
  ['stonewall','crackedWall','ruinDoorBroken'].includes(o.type));
 assert.deepEqual([Math.min(...tower.map(o=>o.x)),Math.max(...tower.map(o=>o.x)),
  Math.min(...tower.map(o=>o.z)),Math.max(...tower.map(o=>o.z)),tower.length],
  [84,88,34,38,15],'roofless tower bounds form a ruined, accessible footprint');
 assert.ok(ground(86,38).some(o=>o.type==='ruinDoorBroken'),'tower marks its real passable southern doorway');
 assert.ok(world.some(o=>o.x===85&&o.z===38&&o.y===2&&o.type==='towerBattlement'),'watchtower has real battlements above its footprint');
 assert.ok(ground(65,33).some(o=>o.type==='benchWood'),'shortcut reconnects to the old glade bench, not a generic target');
 const main=new Set(),returnTrack=new Set();
 await follow(page,[[69,38]],main);
 await block(page,'ArrowDown',69,38);
 await follow(page,[[70,38]],main);
 await capture(page,'east-crossing-first-look');
 await follow(page,[[70,40],[69,40]]);
 await capture(page,'flat-wash-landing',false);
 await follow(page,[[71,40],[71,38]]);
 await follow(page,OUT_TO_SHRINE,main);
 await capture(page,'shrine-approach');
 await follow(page,SHRINE_TO_MIDPOINT,main);
 assert.equal(navigationCount,0,'east crossing and shrine spur never leave the current page');
 assert.equal(page.url(),url);
 await unchanged(page);
 const last=await resume(page);
 assert.deepEqual([last.id,last.play,last.position.x,last.position.z],['base',true,81,44],'walking updates the real shared resume key beyond old edge');
 await page.close();
 page=await reloadLikeAndroid(context,last,errors);
 url=recordNavigation(page);
 await follow(page,MIDPOINT_TO_TOWER.slice(0,2),main);
 await capture(page,'watchtower-default-camera');
 await follow(page,[[86,41]]);
 await capture(page,'watchtower-approach',true,true);
 await follow(page,[MIDPOINT_TO_TOWER.at(-1)],main);
 // Route around the tower and back follows the distinct northern ridge.
 await follow(page,RETURN_POINTS.slice(0,2),returnTrack);
 await capture(page,'watchtower-back-grove');
 await follow(page,RETURN_POINTS.slice(2),returnTrack);
 assert.deepEqual((await state(page)).position,pos(67,38),'northern shortcut closes the loop at the original west approach');
 assert.ok(returnTrack.has('67,33'),'shortcut reconnects to original glade');
 assert.ok([...returnTrack].filter(k=>!main.has(k)).length>=20,'separate demonstrably walked shortcut rather than return on main trail');
 assert.equal(navigationCount,0,'all walks stay on the same HTML page');
 assert.equal(page.url(),url);
 await unchanged(page);
 assert.deepEqual(errors,[]);
 console.log('PASS: real east trail/bridge, flat wash, shrine and watchtower, distinct return loop, far-east Android resume and protected original saves');
 await context.close();
}finally{
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}
