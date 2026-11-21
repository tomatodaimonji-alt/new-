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
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=4,facing=2,kit=null}={}){
 const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  let seed=88;
  Math.random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:0,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:5.5}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit});
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
const getMap=page=>page.evaluate(()=>window.__editorTest.data());
const at=(x,z,level=0)=>({x,z,level});
const settle=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function picture(page,label){
 if(!out)return;
 await settle(page);
 await page.screenshot({path:out+'/v143-'+label+'.png'});
}
async function assertClockPosition(page,selector){
 const old=await page.locator('#poiGoldHud').boundingBox(),clock=await page.locator(selector).boundingBox();
 assert.ok(old&&clock&&clock.y>=old.y+old.height-1,'actual 24h clock renders directly below the wallet');
 assert.ok(Math.abs(clock.x-old.x)<2&&Math.abs(clock.width-old.width)<3,'clock aligns with wallet');
 const text=(await page.locator(selector).innerText()).trim();
 assert.match(text,/(?:[01][0-9]|2[0-3]):[0-5][0-9]/,'Japanese panel uses 24-hour HH:MM');
 return text.match(/(?:[01][0-9]|2[0-3]):[0-5][0-9]/)[0].split(':').reduce((h,m)=>Number(h)*60+Number(m));
}
async function noMapMutation(page,map){
 assert.deepEqual(await getMap(page),map,'NPCs, rooms and clock do not write authenticated game layout or tiles');
 await unchanged(page);
}
const clockHud='#poiClockHud',clockValue='#poiClockValue',action='#poiWalkAction';
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
async function jump(page,minute){
 assert.equal(await page.evaluate(()=>document.hidden),false,'advance only a live foreground simulation');
 await page.evaluate(m=>window.__editorTest.setTownTime(m),minute);
 await page.waitForFunction(m=>Math.floor(window.__editorTest.townClock().absoluteMinute)>=m,minute);
}
function byId(info,id){return info.actors.find(o=>o.id===id);}
async function walkTo(page,goal,phaseY,bounds){
 const path=await page.evaluate(({goal,bounds})=>{
  const api=window.__editorTest,p=api.facility().position,[x0,x1,z0,z1]=bounds;
  const stairs=new Set(api.data().world.filter(o=>o.y===p.level&&/^guildStair(?:Up|Down)$/.test(o.type)).map(o=>o.x+','+o.z));
  const ds=[[0,-1,'n'],[0,1,'s'],[1,0,'e'],[-1,0,'w']],key=(x,z)=>x+','+z,start=key(p.x,p.z),end=key(...goal);
  const q=[[p.x,p.z]],seen=new Map([[start,null]]);
  for(let i=0;i<q.length&&!seen.has(end);i++){
   const [x,z]=q[i];
   for(const [dx,dz,dir] of ds){
    const a=x+dx,b=z+dz,k=key(a,b);
    if(a<x0||a>x1||b<z0||b>z1||(stairs.has(k)&&k!==end)||seen.has(k)||!api.canStep(a,b,x,z))continue;
    q.push([a,b]);seen.set(k,{from:key(x,z),a,b,dir});
   }
  }
  if(!seen.has(end))return null;
  const route=[];for(let k=end;k!==start;k=seen.get(k).from)route.push(seen.get(k));return route.reverse();
 },{goal,bounds});
 assert.ok(path,'real bounded walking route to '+goal);
 for(const {dir} of path)await move(page,dir);
 const actual=(await state(page)).position;assert.deepEqual(actual,at(...goal,phaseY));
}
async function waitActivity(page,id,expected,timeout=16000){
 await page.waitForFunction(({id,expected})=>window.__editorTest.townResidents().actors.some(n=>n.id===id&&n.activity===expected),{id,expected},{timeout,polling:150});
 return byId(await residents(page),id);
}
async function dailyLife(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:31,z:24});
 try{
  const map=await getMap(page);
  await page.locator(clockHud).waitFor({state:'visible'});
  const display=await assertClockPosition(page,clockHud);
  assert.ok(display>=480&&display<=500,'day begins near 08:00 at 2 in-game minutes per real second');
  const real=await clock(page);
  await page.waitForFunction(m=>window.__editorTest.townClock().absoluteMinute>=m+2,real.absoluteMinute);
  // An entirely paused foreground simulation would not satisfy the previous
  // assertion. A hidden tab must not accumulate hours/NPC steps.
  await page.evaluate(()=>{
   Object.defineProperty(document,'hidden',{configurable:true,value:true});
   document.dispatchEvent(new Event('visibilitychange'));
  });
  const paused=await clock(page);
  await page.waitForTimeout(1100);
  assert.equal(Math.floor((await clock(page)).absoluteMinute),Math.floor(paused.absoluteMinute));
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});

  await jump(page,12*60);
  const host=await waitActivity(page,'innkeeper','work');
  assert.deepEqual([host.x,host.z,host.y],[31,20,0],'host physically at the inn desk');
  await picture(page,'innkeeper-day-and-clock');
  await jump(page,22*60);
  const already=byId(await residents(page),'innkeeper');
  assert.notEqual(already.activity,'sleep-home','setting clock alone does not teleport the resident to the private bed');
  const bed=await waitActivity(page,'innkeeper','sleep-home');
  assert.notDeepEqual([bed.x,bed.z,bed.y],[host.x,host.z,host.y],'actual resident movement from desk to home');
  assert.equal(bed.y,0,'innkeeper sleeps in own downstairs private room');
  await picture(page,'innkeeper-night-home');
  await jump(page,24*60+5);
  assert.equal((await clock(page)).hour,0,'HH:MM wraps to 00 at midnight');
  await page.waitForFunction(()=>document.getElementById('poiClockValue')?.textContent.startsWith('00:'));
  assert.match(await page.locator(clockValue).textContent(),/^00:/);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function sharedInn(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:31,z:24},{kit:{version:1,weapon:null,potions:3,gold:12}});
 try{
  const map=await getMap(page);
  const raw=()=>page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1'));
  const stored=await raw();
  await jump(page,12*60);
  await waitActivity(page,'innkeeper','work');
  await move(page,'n',true,true); // Gate/door opening is genuine touch.
  await move(page,'n');
  assert.deepEqual((await state(page)).position,at(31,22));
  assert.match(await page.locator(action).innerText(),/泊まる|宿泊/,'actual shared inn desk action visible to the player');
  await page.locator(action).tap();
  await page.waitForFunction(()=>!!window.__editorTest.townResidents().playerBedId);
  const booking=await residents(page),assigned=booking.innBeds.find(b=>b.id===booking.playerBedId);
  assert.ok(assigned&&assigned.y===1&&assigned.stand,'real bed on the upper inn floor is assigned');
  assert.equal(assigned.occupant,'player','shared ledger reserves the same bed pool for player');
  assert.equal(await raw(),stored,'no extra economic cost or eligibility mutation');
  assert.ok((await clock(page)).hour===12,'booking does not auto-skip evening or set next day');

  await walkTo(page,[36,19],1,[26,37,13,23]);
  await walkTo(page,[assigned.stand.x,assigned.stand.z],1,[26,37,13,23]);
  const [dx,dz]=[assigned.x-assigned.stand.x,assigned.z-assigned.stand.z];
  const facing=Object.entries(dirs).find(([,d])=>d[0]===dx&&d[1]===dz)?.[0];
  assert.ok(facing,'player bed stand is physically adjacent to its own assigned bed');
  await page.keyboard.press(arrow[facing]); // Bed itself blocks, but faces player.
  assert.match(await page.locator(action).innerText(),/休む|眠る/);
  await page.locator(action).tap();
  const after=(await residents(page)).innBeds.find(b=>b.id===assigned.id);
  assert.equal(after.occupant,'player');
  assert.notEqual((await residents(page)).playerService,'rest','same booking does not trigger repeated rest');
  assert.ok((await clock(page)).hour===12,'rest does not skip time');
  await picture(page,'player-at-assigned-guest-bed');
  // Let the healthy traveler walk from the field and speak to the day
  // clerk before closing, then independently advance to sleeping hours.
  await jump(page,16*60+30);
  await page.waitForFunction(()=>window.__editorTest.townResidents().actors.some(a=>a.id==='guestadventurer'&&!!a.bedId),null,{timeout:42000,polling:150});
  await jump(page,22*60);
  await page.waitForFunction(()=>{
   const info=window.__editorTest.townResidents(),n=info.actors.find(a=>a.id==='guestadventurer');
   const bed=info.innBeds.find(b=>b.occupant==='guestadventurer');
   return n&&bed&&n.activity==='sleep-inn'&&n.y===bed.y&&n.x===bed.stand.x&&n.z===bed.stand.z;
  },null,{timeout:28000,polling:150});
  const night=await residents(page),visitor=byId(night,'guestadventurer');
  const travelerBed=night.innBeds.find(b=>b.occupant==='guestadventurer');
  assert.ok(travelerBed&&travelerBed.id!==assigned.id,'AI boarder occupies distinct real bed from the same shared stock');
  assert.equal(night.innBeds.find(b=>b.id===assigned.id).occupant,'player');
  assert.equal(visitor.y,1,'boarder enters actual upper floor before sleeping');
  await picture(page,'npc-boarding-room');
  assert.equal(await raw(),stored);
  await noMapMutation(page,map);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await dailyLife(browser);await sharedInn(browser);
 console.log('PASS Chromium: actual clock, work and home sleep paths, player and NPC room sharing, unchanged game layout/protected saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
