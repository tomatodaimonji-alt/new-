import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html'),baseline=process.argv[3]&&readFileSync(process.argv[3]);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url.startsWith('/seed')?'<!doctype html>':req.url.startsWith('/old')?baseline:html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port,out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const protectedEditor='{"format":"forest-world-v1","version":1,"width":30,"height":30,"world":[{"x":3,"z":3,"y":0,"type":"stonewall","rot":0}],"models":[],"prefabs":[],"terrainHeights":[]}';
const fixture={'forest-world-editor-v1':protectedEditor,'world-workshop-pois-v1':'[]',
 'world-workshop-hotbar-v1':'{"version":1,"weapon":null,"potions":3}'};
const state=p=>p.evaluate(()=>window.__editorTest.facility());
async function open(browser,id,x,z,old=false,view=null){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(14000);
 await page.goto(origin+'/seed');
 await page.evaluate(({id,x,z,fixture,view})=>{
  for(const [k,v] of Object.entries(fixture))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id,play:true,position:{x,z,y:0,facing:0},view}));
 },{id,x,z,fixture,view});
 await page.goto(origin+(old?'/old':'/')+'?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 assert.deepEqual((await state(page)).position,{x,z,level:0});
 return {ctx,page,errors};
}
async function keys(page,steps){
 for(const s of steps){
  await page.keyboard.press(s.key);
  await page.waitForFunction(([x,z])=>{const p=window.__editorTest.facility().position;return p.x===x&&p.z===z},[s.x,s.z]);
  await page.waitForTimeout(185);
 }
}
async function walk(page,x,z,bounds){
 const route=await page.evaluate(({goal,bounds})=>{
  const editor=window.__editorTest,p=editor.facility().position;
  const q=[{x:p.x,z:p.z,steps:[]}],seen=new Set([p.x+','+p.z]);
  for(let i=0;i<q.length;i++){
   const a=q[i];if(a.x===goal.x&&a.z===goal.z)return a.steps;
   for(const [dx,dz,key] of [[0,-1,'ArrowUp'],[0,1,'ArrowDown'],[-1,0,'ArrowLeft'],[1,0,'ArrowRight']]){
    const x=a.x+dx,z=a.z+dz,k=x+','+z;
    if(x<bounds[0]||x>bounds[1]||z<bounds[2]||z>bounds[3]||seen.has(k)||!editor.canStep(x,z))continue;
    seen.add(k);q.push({x,z,steps:[...a.steps,{x,z,key}]});
   }
  }
  return null;
 },{goal:{x,z},bounds});
 assert.ok(route,'walkable route to '+x+','+z);
 await keys(page,route);
}
async function capture(page,name){
 if(!out)return;
 await page.evaluate(()=>new Promise(f=>requestAnimationFrame(()=>requestAnimationFrame(f))));
 await page.screenshot({path:out+'/v136-'+name+'.png'});
}
async function assertUnchanged(page,errors){
 const values=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixture));
 assert.deepEqual(values,fixture);assert.deepEqual(errors,[]);
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {page,ctx,errors}=await open(browser,'base',54,18);
 try{
  const gs=(await state(page)).buildings.filter(b=>b.name==='冒険者ギルド');
  assert.equal(gs.length,1);const g=gs[0];
  const {x:gx,z:gz}=g.entrance;
  assert.equal((await state(page)).buildings.length,10);
  await walk(page,gx,gz+2,[53,g.x2+1,g.z2,g.z2+3]);
  await capture(page,'guild-exterior');
  await walk(page,gx,gz-3,[g.x1,g.x2,g.z1,g.z2+2]);
  assert.equal((await state(page)).miniMap.location,'冒険者ギルド');
  assert.notEqual((await state(page)).hiddenRoof,null,'entering the guild hides its own roof');
  const model=await page.evaluate(()=>window.__editorTest.data());
  const stairs=model.world.filter(o=>o.type==='guildStairUp'&&o.x>=g.x1&&o.x<=g.x2&&o.z>=g.z1&&o.z<=g.z2).sort((a,b)=>a.y-b.y);
  assert.deepEqual(stairs.map(s=>s.y),[0,1]);
  for(const [i,stair] of stairs.entries()){
   await walk(page,stair.x,stair.z,[g.x1,g.x2,g.z1,g.z2]);
   await page.waitForFunction(level=>window.__editorTest.facility().position.level===level,i+1);
   assert.equal((await state(page)).miniMap.location,'冒険者ギルド');
  }
  await capture(page,'guild-third-floor');
  await assertUnchanged(page,errors);
 }finally{await ctx.close();}
 for(const old of baseline?[true,false]:[false]){
  const {page:p,ctx:c,errors:e}=await open(browser,'base',19,14,old);
  try{await capture(p,old?'inn-before':'inn-depth');await assertUnchanged(p,e)}
  finally{await c.close();}
 }
 console.log('PASS connected real town approach, Guild interior and two stair flights, and mobile inn view; exact protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
