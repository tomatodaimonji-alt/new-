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
async function unchanged(page){
 const before=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixtures));
 assert.deepEqual(before,fixtures,'route must not write existing editor, Guild/archives, adventure, or audio settings');
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const range='#poiEnemyHud .poiEnemyHealth';
const open='#enterGameWorld';
const actor=async page=>(await state(page)).combat.actors.find(x=>x.wildSpawn&&x.hp>0);
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:0,facing:2},townLayout:3,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch});
 await page.goto(origin+'/'+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
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
async function faceAndSwing(page,style){
 if(style==='sword')await page.keyboard.press('2');else await page.keyboard.press('1');
 const angle=await page.evaluate(()=>{
  const {position,combat}=window.__editorTest.facility(), mob=combat.actors.find(a=>a.wildSpawn&&a.hp>0);
  if(!mob)return null;
  const dx=mob.x-position.x,dz=mob.z-position.z;
  return Math.abs(dx)+Math.abs(dz)===1&&(dx>0?'e':dx<0?'w':dz>0?'s':'n');
 });
 assert.ok(angle,'slime moves into actual melee range');
 const old=(await state(page)).position;
 // Attempting to step into the occupied tile is blocked, but the shared
 // D-pad input correctly faces the player toward the adjacent enemy.
 await page.keyboard.press(arrow[angle]);
 assert.deepEqual((await state(page)).position,old);
 await page.locator('#poiWalkAction').tap();
}
async function capture(page,name){
 if(!out)return;
 await page.screenshot({path:out+'/v141-'+name+'.png'});
}
async function approachActor(page,limits){
 for(let i=0;i<25;i++){
  const next=await page.evaluate(([x0,x1,z0,z1])=>{
   const api=window.__editorTest,{position:p,combat}=api.facility(),mob=combat.actors.find(a=>a.wildSpawn&&a.hp>0);
   if(!mob)return null;
   const steps=[[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']];
   const seen=new Set([p.x+','+p.z]),q=[{x:p.x,z:p.z,d:null}];
   for(let j=0;j<q.length;j++){
    const {x,z,d}=q[j];
    if(Math.abs(x-mob.x)+Math.abs(z-mob.z)===1)return {d};
    for(const [dx,dz,key] of steps){
     const xx=x+dx,zz=z+dz,k=xx+','+zz;
     if(xx<x0||xx>x1||zz<z0||zz>z1||seen.has(k)||!api.canStep(xx,zz,x,z))continue;
     seen.add(k);q.push({x:xx,z:zz,d:d??key});
    }
   }
   return null;
  },limits);
  if(next?.d===null)return;
  if(next?.d)await move(page,next.d,false);else await page.waitForTimeout(450);
 }
 assert.fail('real player could not approach the spawned enemy');
}
async function follow(page,goal,bounds){
 const route=await page.evaluate(({goal,bounds})=>{
  const api=window.__editorTest,{position:p}=api.facility(),[a,b,c,d]=bounds;
  const dirs=[[1,0,'e'],[-1,0,'w'],[0,1,'s'],[0,-1,'n']],key=(x,z)=>x+','+z;
  const start=key(p.x,p.z),end=key(...goal),q=[[p.x,p.z]],seen=new Map([[start,null]]);
  for(let i=0;i<q.length&&!seen.has(end);i++){
   const [x,z]=q[i];
   for(const [dx,dz,dir] of dirs){
    const xx=x+dx,zz=z+dz,k=key(xx,zz);
    if(xx<a||xx>b||zz<c||zz>d||seen.has(k)||!api.canStep(xx,zz,x,z))continue;
    seen.set(k,{before:key(x,z),dir});q.push([xx,zz]);
   }
  }
  if(!seen.has(end))return null;
  const path=[];for(let k=end;k!==start;k=seen.get(k).before)path.push(seen.get(k).dir);
  return path.reverse();
 },{goal,bounds});
 assert.ok(route,'no walkable route through grassland to '+goal);
 for(const step of route)await move(page,step);
}
async function waitGrassSlime(page,world){
 await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.hp>0),null,{timeout:22000,polling:100});
 const slime=await actor(page);assert.equal(slime.type,'monsterSlime');assert.equal(slime.hp,35);
 const before=(await state(page)).position;
 assert.ok(Math.hypot(slime.x-before.x,slime.z-before.z)<=13,'slime appears within authentic nearby walking range');
 const ground=world.world.filter(o=>o.x===slime.x&&o.z===slime.z&&o.y===0);
 assert.ok(ground.every(o=>/^grass|^moss$/.test(o.type)),'new enemy starts on natural turf, never a road, solid prop, fort or water at '+[slime.x,slime.z]+' '+ground.map(o=>o.type));
 return slime;
}
async function southern(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:19,z:45});
 try{
  const world=await page.evaluate(()=>window.__editorTest.data()),ready=await state(page);
  for(const [x0,x1,z0,z1,min] of [[15,39,49,55,5],[72,85,37,46,4]]){
   const patch=world.world.filter(o=>o.y===0&&o.x>=x0&&o.x<=x1&&o.z>=z0&&o.z<=z1);
   assert.ok(patch.filter(o=>o.type==='grassMeadow').length>=min&&!patch.some(o=>/^tree[A-Z]/.test(o.type)),'open authored meadow, rather than the previous dense tree cover');
  }
  assert.equal(ready.miniMap.location,'拠点');
  await page.waitForTimeout(950);
  assert.equal((await state(page)).wildSpawn.nextIn,0,'housing/town disarms encounter timer');
  assert.equal(await actor(page),undefined);
  for(let i=0;i<4;i++)await move(page,'s',true,i===1);
  assert.deepEqual((await state(page)).position,{x:19,z:49,level:0});
  assert.equal((await state(page)).miniMap.location,'外');
  assert.ok(world.world.some(o=>o.x===19&&o.z===47&&o.y===0&&o.type==='poiFortGate'),'walked through real south gate');
  assert.equal(await actor(page),undefined,'spawn not instantaneous on gate crossing');
  await waitGrassSlime(page,world);
  await approachActor(page,[5,36,47,55]);
  const slime=await actor(page); assert.ok(slime);
  await capture(page,'south-grassland-with-slime');
  await faceAndSwing(page,'hand');
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.some(a=>a.wildSpawn&&a.hp===15));
  await page.waitForTimeout(360);
  await faceAndSwing(page,'sword');
  const loot=(await state(page)).economy;
  const coin=loot.drops.find(c=>c.x===slime.x&&c.z===slime.z);
  assert.ok(coin&&coin.amount===3&&loot.gold===0,'real defeat creates ground coin without early wallet credit');
  await follow(page,[coin.x,coin.z],[5,36,47,55]);
  assert.equal((await state(page)).economy.gold,3,'walking onto reward still works in new meadow');
  assert.deepEqual(await page.evaluate(()=>window.__editorTest.data()),world,'spawn/loot do not mutate map');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function eastern(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:61,z:45});
 try{
  const world=await page.evaluate(()=>window.__editorTest.data());
  await move(page,'e',true,true);await move(page,'e');await move(page,'e');
  assert.deepEqual((await state(page)).position,{x:64,z:45,level:0});
  assert.equal((await state(page)).miniMap.location,'外');
  assert.ok(world.world.some(o=>o.x===62&&o.z===45&&o.y===0&&o.type==='poiFortGate'),'real east gate is still connected');
  await capture(page,'east-grassland-exterior');
  await follow(page,[67,38],[63,67,37,46]);
  await move(page,'e');await move(page,'e');
  await page.keyboard.press('ArrowDown');
  assert.deepEqual((await state(page)).position,{x:69,z:38,level:0},'old creek-side water still blocks, not disguised by meadow terrain');
  await move(page,'e');
  assert.deepEqual((await state(page)).position,{x:70,z:38,level:0},'existing bridge remains a real crossing');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function easternEncounter(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:61,z:45});
 try{
  const map=await page.evaluate(()=>window.__editorTest.data());
  for(let i=0;i<3;i++)await move(page,'e',true,i===0);
  const slime=await waitGrassSlime(page,map);
  assert.ok(slime.x>=63&&slime.x<=67,'east encounter stays reachable on the near bank');
  assert.ok((await state(page)).wildSpawn.count<=3);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function pictures(browser){
 if(!out)return;
 for(const [name,x,z,yaw] of [['south-grassland-vista',19,49,0],['east-grassland-vista',64,45,Math.PI/2]]){
  const {ctx,page}=await launch(browser,'base',{x,z},{camera:true,orbitYaw:yaw,pitch:.25});
  try{await capture(page,name);}finally{await ctx.close();}
 }
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
 args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await southern(browser);await eastern(browser);await easternEncounter(browser);await pictures(browser);
 console.log('PASS Chromium: grassland reached through both gates, natural weak slime spawns, real battle/coins, old creek crossing, protected original saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
