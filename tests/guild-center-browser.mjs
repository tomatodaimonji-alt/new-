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
const pos=(page)=>page.evaluate(()=>window.__editorTest.facility().position);
const directions=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const guildSign='guildFacadeSign';
async function setup(browser,id,start,{legacy=false}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,legacy})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{y:0,facing:0,...start},...(legacy?{}:{townLayout:3}),
   view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:Math.PI,orbitPitch:.35,orbitDistance:10}}));
 },{fixtures,resumeKey,id,start,legacy});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator('#enterGameWorld').tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}
async function route(page,goal,nextFloor,limits,mobileLast=false){
 const start=await pos(page),[gx,gz]=goal;
 const path=await page.evaluate(({goal:[gx,gz],start,limits:[x0,x1,z0,z1]})=>{
  const api=window.__editorTest;
  const stairs=new Set(api.data().world.filter(o=>o.y===start.level&&/^guildStair(?:Up|Down)$/.test(o.type)).map(o=>o.x+','+o.z));
  const dirs=[[-1,0,'ArrowLeft','w'],[1,0,'ArrowRight','e'],[0,-1,'ArrowUp','n'],[0,1,'ArrowDown','s']];
  const key=(x,z)=>x+','+z,first=key(start.x,start.z),last=key(gx,gz);
  const q=[[start.x,start.z]],seen=new Map([[first,null]]);
  for(let i=0;i<q.length&&!seen.has(last);i++){
   const [x,z]=q[i];
   for(const [dx,dz,arrow,tap] of dirs){
    const a=x+dx,b=z+dz,k=key(a,b);
    if(a<x0||a>x1||b<z0||b>z1||seen.has(k)||(stairs.has(k)&&k!==last)||!api.canStep(a,b,x,z))continue;
    seen.set(k,{from:key(x,z),x:a,z:b,arrow,tap});q.push([a,b]);
   }
  }
  if(!seen.has(last))return null;
  const steps=[];for(let k=last;k!==first;k=seen.get(k).from)steps.push(seen.get(k));return steps.reverse();
 },{start,goal,limits});
 assert.ok(path,'no actual collision-valid route from '+JSON.stringify(start)+' to '+goal);
 for(const [i,{arrow,tap,x,z}] of path.entries()){
  const isLast=i===path.length-1;
  if(mobileLast&&isLast)await page.locator('[data-poi-dir="'+tap+'"]').tap();else await page.keyboard.press(arrow);
  const level=isLast?nextFloor:start.level;
  await page.waitForFunction(({x,z,level})=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;},{x,z,level},{timeout:3000})
   .catch(async e=>{throw new Error('Missed step '+[x,z,level]+' from '+JSON.stringify(await pos(page)),{cause:e});});
  await page.waitForTimeout(185);
 }
}
const paint=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function capture(page,label){
 if(!out)return;
 await paint(page);
 await page.screenshot({path:out+'/v137-'+label+'.png'});
}
async function signVisibility(page,visible){
 await page.waitForFunction(({id,visible})=>window.__editorTest.facility().signIds.includes(id)===visible,{id:guildSign,visible});
}
async function town(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:19,z:21});
 try{
  const original=await getMap(page),start=await state(page);
  const owner=start.buildings.findIndex(row=>row.id==='townGuild'),guild=start.buildings[owner];
  assert.ok(guild,'base has one real authored city-center guild');
  assert.deepEqual([guild.x1,guild.x2,guild.z1,guild.z2],[27,42,2,16]);
  assert.deepEqual(guild.entrance,{x:34,z:16});
  const workshop=start.buildings.find(row=>row.id==='workshop');
  assert.deepEqual([workshop.x1,workshop.x2,workshop.z1,workshop.z2],[55,64,6,16]);
  assert.deepEqual([original.width,original.height],[96,56]);
  for(const [x,z,type,y] of [[34,16,'stonewallDoor',0],[28,14,'guildStairUp',0],[28,14,'guildStairDown',1],[39,13,'guildStairUp',1],[39,13,'guildStairDown',2]])
   assert.ok(original.world.some(o=>o.x===x&&o.z===z&&o.y===y&&o.type===type),'authored '+type+' at '+[x,z,y]);
  const url=page.url(),bounds=[13,46,1,26],inside=[27,42,2,16];
  assert.equal(start.hiddenRoof,null);
  await route(page,[34,20],0,bounds);
  await signVisibility(page,true);
  assert.ok((await state(page)).visibleRoofs.includes(owner),'guild roof and face sign are intact from civic plaza');
  await capture(page,'town-plaza-and-guild');
  if(out){
   await page.locator('#poiThirdView').tap();
   await capture(page,'guild-exterior-mobile');
   await page.locator('#poiThirdView').tap();await page.locator('#poiThirdView').tap();
  }
  await route(page,[34,17],0,bounds);
  await route(page,[34,16],0,bounds,true); // Enter newly authored door using actual phone touch.
  await route(page,[34,15],0,inside);
  await signVisibility(page,false);
  const ground=await state(page);
  assert.equal(ground.hiddenRoof,owner,'ground-floor camera is in the centered guild cutaway');
  assert.equal(ground.sceneCutOwner,owner);
  assert.ok(!ground.visibleRoofs.includes(owner),'roof concealed in the actual interior');
  assert.ok(ground.visibleRoofs.length>0,'unrelated roofs stay rendered');
  await capture(page,'guild-interior-sign-hidden');
  await route(page,[28,14],1,inside);
  await signVisibility(page,false);
  assert.equal((await state(page)).sceneCutOwner,owner,'2F retains guild-only cutaway');
  assert.equal(await page.evaluate(()=>window.__editorTest.canStep(34,8)),false,'2F atrium is a real void');
  await capture(page,'guild-2f');
  await route(page,[39,13],2,inside);
  await signVisibility(page,false);
  await route(page,[34,11],2,inside);
  await route(page,[34,10],2,inside,true);
  await route(page,[34,9],2,inside);
  await capture(page,'guild-3f-office-approach');
  assert.equal(page.url(),url,'plaza, guild interior and both floors live in same game world');
  assert.deepEqual(await getMap(page),original,'tour neither adds nor deletes actual map objects');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function legacyResume(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:79,z:16},{legacy:true});
 try{
  assert.deepEqual(await pos(page),{x:34,z:15,level:0},'old eastern guild resume moves to matching centered interior tile');
  const snapshot=()=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
  await page.waitForFunction(k=>JSON.parse(localStorage.getItem(k))?.townLayout===3,resumeKey);
  assert.equal((await snapshot()).townLayout,3,'migration version stored');
  await signVisibility(page,false);
  await page.reload();
  await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
  assert.deepEqual(await pos(page),{x:34,z:15,level:0},'coordinates migrate once, not on every launch');
  const guild=(await state(page)).buildings.find(row=>row.id==='townGuild'),bounds=[26,43,1,21];
  await route(page,[guild.entrance.x,17],0,bounds);
  await signVisibility(page,true);
  assert.equal((await state(page)).hiddenRoof,null,'walking back out restores the exterior sign');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function gates(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:19,z:45});
 try{
  const data=await getMap(page),inside=await state(page);
  assert.equal(inside.miniMap.location,'拠点');
  assert.ok(data.world.some(o=>o.x===19&&o.z===47&&o.y===0&&o.type==='poiFortGate'&&o.rot===0),'real south-facing three-wide gate model');
  for(const x of [17,21])
   assert.ok(data.world.some(o=>o.x===x&&o.z===47&&o.y===0&&/^poiFort(?:Wall|Corner)$/.test(o.type)),'gate flank is real stone wall '+x);
  for(const x of [18,19,20])
   assert.equal(await page.evaluate(x=>window.__editorTest.canStep(x,47),x),true,'three-tile gate through-opening '+x);
  await route(page,[19,47],0,[18,20,44,49],true);
  assert.equal((await state(page)).miniMap.location,'外');
  await capture(page,'south-stone-gate');
  await route(page,[20,47],0,[18,20,47,47]);
  await page.keyboard.press('ArrowRight');
  assert.deepEqual(await pos(page),{x:20,z:47,level:0},'walking through an opening does not allow crossing its stone flank');
  await route(page,[19,48],0,[18,20,47,49],true);
  for(const z of [44,45,46])
   assert.equal(await page.evaluate(z=>window.__editorTest.canStep(62,z),z),true,'old east forestry access retains a real opening '+z);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function eastGate(browser){
 const {ctx,page,errors}=await setup(browser,'base',{x:61,z:45});
 try{
  await route(page,[63,45],0,[60,64,44,46],true);
  assert.deepEqual(await pos(page),{x:63,z:45,level:0},'old eastern forest road remains traversable through gate');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await town(browser);await legacyResume(browser);await gates(browser);await eastGate(browser);
 console.log('PASS mobile Chromium: centered guild walk and stairs, exterior sign versus interior cutaway, prior town resume remaps once, original saves protected');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
