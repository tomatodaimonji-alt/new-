import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('content-type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Test fixtures</title>':html);
});
await new Promise((yes,no)=>server.listen(0,'127.0.0.1',yes).once('error',no));
const origin='http://127.0.0.1:'+server.address().port;
const idList=['lodging','kitchen','workshop','base'];
const map=(type)=>({format:'forest-world-v1',version:1,width:30,height:30,size:30,world:[{x:2,y:0,z:2,type,rot:0}],terrainHeights:[],models:[],prefabs:[]});
const fixture={
 'forest-world-editor-v1':JSON.stringify(map('stonewall'),null,2),
 'world-workshop-pois-v1':JSON.stringify([{name:'ギルド',id:'poi-guild-primary-v87',map:map('woodwall')},{name:'冒険者ギルド',id:'poi-adventurers-guild-v102',map:map('stonewall')}],null,2),
 'world-workshop-adventure-v1':JSON.stringify({version:1,x:23,z:24,monsters:[]},null,2),
 'pine-adventurers-guild-poi-before-v102':'{"untouched":true}',
 'pine-guild-screenshot-before-v86':JSON.stringify(map('stonewall'),null,2)
};
const step=(page,dx,dz)=>page.keyboard.press(dx===1?'ArrowRight':dx===-1?'ArrowLeft':dz===1?'ArrowDown':'ArrowUp');
const snap=async page=>page.evaluate(()=>window.__editorTest?.facility?.()??null);
const xy=({x,z})=>({x,z});
const key=(x,z)=>x+','+z;
const dirs=[[0,-1],[0,1],[-1,0],[1,0]];
const footprint=(b,y=0)=>new Set((b.floorFootprints[String(y)]||[]).map(p=>key(p.x,p.z)));
const inside=(area,x,z)=>area.has(key(x,z))&&dirs.every(([a,b])=>area.has(key(x+a,z+b)));
const stair=t=>t==='guildStairUp'||t==='guildStairDown';
async function route(page,map,start,check,transition=null,stay=()=>true){
 const blockedByStair=new Set(map.world.filter(o=>o.y===start.level&&stair(o.type)).map(o=>key(o.x,o.z)));
 const allowed=await page.evaluate(({width,height})=>{
  const result=[];
  for(let z=0;z<height;z++)for(let x=0;x<width;x++)if(window.__editorTest.canStep(x,z))result.push(x+','+z);
  return result;
 },{width:map.width,height:map.height});
 const pass=new Set(allowed);
 const q=[xy(start)],prev=new Map([[key(start.x,start.z),null]]);
 for(let i=0;i<q.length;i++){
  const here=q[i];
  if(check(here.x,here.z)){
   const out=[];for(let at=here;at;at=prev.get(key(at.x,at.z)))out.push({...at,level:start.level});
   out.reverse();
   if(transition!==null)out.at(-1).level=transition;
   return out;
  }
  for(const [dx,dz] of dirs){
   const x=here.x+dx,z=here.z+dz,k=key(x,z);
   if(!pass.has(k)||!stay(x,z)||prev.has(k)||(blockedByStair.has(k)&&!(transition!==null&&check(x,z))))continue;
   prev.set(k,here);q.push({x,z});
  }
 }
 return null;
}
async function walk(page,steps){
 assert(steps?.length,'no eligible walking route');
 let from=steps[0];
 for(const point of steps.slice(1)){
  await step(page,point.x-from.x,point.z-from.z);
  const found=await snap(page);
  assert.deepEqual(found.position,point,'walking failed at '+JSON.stringify(point));
  await page.waitForTimeout(185);from=point;
 }
}
async function staircase(page,map,area,delta,id,out,annex=null,bedrooms=[]){
 const here=await snap(page),target=here.position.level+delta;
 const startType=delta>0?'guildStairUp':'guildStairDown';
 const reverseType=delta>0?'guildStairDown':'guildStairUp';
 const stairs=map.world.find(o=>o.y===here.position.level&&o.type===startType&&area.has(key(o.x,o.z))&&map.world.some(p=>p.x===o.x&&p.z===o.z&&p.y===target&&p.type===reverseType));
 assert(stairs,id+' missing connecting stair');
 const hit=(x,z)=>x===stairs.x&&z===stairs.z;
 await walk(page,await route(page,map,here.position,hit,target));
 const reached=await snap(page);
 assert.equal(reached.position.level,target);
 assert.equal(reached.sceneLayer,target<0?'cellar':'surface');
 if(target<0){assert.deepEqual(reached.visibleRoofs,[]);assert.deepEqual(reached.visibleLayers,[-1]);assert(!reached.signIds.includes('pineGuildWorldMap'),'guild atlas leaked into cellar');}
 // Get off the landing before re-entering its matching staircase.
 const next=dirs.map(([dx,dz])=>[stairs.x+dx,stairs.z+dz]).filter(([x,z])=>map.world.some(o=>o.x===x&&o.z===z&&o.y===target&&!stair(o.type)));
 const clear=await route(page,map,reached.position,(x,z)=>next.some(([a,b])=>x===a&&z===b));
 assert(clear?.length>1,id+' no usable landing');
 await walk(page,clear);
 if(annex)await walk(page,await route(page,map,(await snap(page)).position,(x,z)=>x===annex.x&&z===annex.z));
 for(const [i,room] of bedrooms.entries()){
  for(const point of [room.door,room.free])
   await walk(page,await route(page,map,(await snap(page)).position,(x,z)=>x===point.x&&z===point.z));
  if(out&&id==='lodging-0')await page.screenshot({path:out+'/lodging-bedroom-'+(i+1)+'.png'});
 }
 if(out)await page.screenshot({path:out+'/'+id+'-floor-'+target+'.png'});
 await walk(page,await route(page,map,(await snap(page)).position,hit,here.position.level));
}
const expectStore=async page=>assert.deepEqual(await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(fixture)),fixture);
async function seed(page){
 await page.goto(origin+'/seed');
 await page.evaluate(f=>{for(const [k,v] of Object.entries(f))localStorage.setItem(k,v)},fixture);
}
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
let browser;
try{
 browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const desktop=await browser.newPage({viewport:{width:1210,height:800}});
 desktop.setDefaultTimeout(4500);
 const errors=[];
 desktop.on('pageerror',e=>errors.push(e.message));
 await seed(desktop);
 await desktop.goto(origin+'/?test=1');
 assert((await desktop.evaluate(()=>window.__editorTest?.state()))?.glLink,'WebGL init');
 await desktop.locator('#poiSampleCategories .categoryRow').click();
 assert.equal(await desktop.locator('[data-facility-id]').count(),8,'built-in POI entries');
 assert.equal(await desktop.locator('#poiSampleCategories button:not([data-guild-renewal])').filter({hasText:'冒険者ギルド'}).count(),1,'one existing guild still selectable beside the separate preview action');
 await expectStore(desktop);
 for(const id of idList){
  if(id==='lodging') await desktop.locator('[data-facility-id="lodging"]').click();
  else await desktop.goto(origin+'/?facility='+id+'&test=1');
  const editing=await snap(desktop);
  assert(editing&&editing.id===id&&!editing.active,'POI must open in the editor, not walk mode');
  assert(await desktop.locator('#quickTools').isVisible(),'missing regular placement tools');
  assert(await desktop.locator('#undo').isVisible(),'missing regular undo');
  assert(!(await desktop.locator('#poiWalkPad').isVisible()),'walk pad shown before Play');
  await expectStore(desktop);
  const [download]=await Promise.all([desktop.waitForEvent('download'),desktop.locator('#facilityExport').click()]);
  assert.equal(download.suggestedFilename(),'workshop-facility-'+id+'.json');
  const exported=JSON.parse(readFileSync(await download.path(),'utf8'));
  assert.equal(exported.format,'forest-world-v1');
  assert(exported.world.every(o=>o.y>=0),'v1 export would not import');
  const offset=['kitchen','base'].includes(id)?1:0;
  assert.deepEqual(exported.workshopFacility,{version:1,floorOffset:offset,groundY:offset});
  const raw=await desktop.evaluate(()=>window.__editorTest.data());
  assert.equal(raw.world.some(o=>o.y===-1),offset===1);
  const sign=['lodging','base'].includes(id);
  assert.equal(raw.world.some(o=>o.type==='poiInnSign'),sign);
  assert(raw.world.some(o=>o.type==='poiStreetLamp'));
  assert(raw.world.filter(o=>/latrine/i.test(o.type)).length>=(id==='base'?3:1));
  if(id==='base'){
   // Open today’s downloadable file through the actual existing v1 editor.
   const importer=await browser.newPage({viewport:{width:1210,height:800}});
   await importer.goto(origin+'/?test=1');
   await importer.locator('#openJson').click();
   await importer.locator('#jsonText').fill(JSON.stringify(exported));
   await importer.locator('#importJson').click();
   const imported=await importer.evaluate(()=>window.__editorTest.data());
   assert(imported.world.some(o=>o.type==='poiInnSign')&&imported.world.some(o=>o.type==='poiStreetLamp'));
   assert(imported.world.some(o=>o.y===0&&o.type==='guildStairUp'));
   await importer.close();
  }
  assert(exported.world.length>40&&exported.width<=128);
  await desktop.locator('#poiWalkToggle').click();
  const start=await snap(desktop);
  assert(start.active);
  assert.deepEqual(start.position,{...start.spawn,level:0});
  assert.equal(start.hiddenRoof,null);
  assert.equal(start.buildings.length,id==='base'?10:1);
  assert(start.roofMeshes.every(count=>count>0));
  if(out)await desktop.screenshot({path:out+'/'+id+'.png'});
  if(id==='base'){
   const westBench={x:16,z:17},eastBench={x:23,z:18};
   for(const bench of [westBench,eastBench]){
    assert(raw.world.some(o=>o.x===bench.x&&o.z===bench.z&&o.y===0&&o.type==='benchWood'));
    assert(raw.world.some(o=>o.x===bench.x&&o.z===bench.z&&o.y===0&&o.type==='roadCutStoneFull'));
   }
   // Capture the bench from the side, without the player standing inside it.
   if(out){
    await walk(desktop,await route(desktop,raw,start.position,(x,z)=>x===16&&z===19));
    const canvas=desktop.locator('#view');
    for(let n=0;n<7;n++)await canvas.dispatchEvent('wheel',{deltaY:-1});
    await desktop.screenshot({path:out+'/base-plaza-bench.png'});
    for(let n=0;n<7;n++)await canvas.dispatchEvent('wheel',{deltaY:1});
   }
  }
  for(const [index,b] of start.buildings.slice(0,id==='base'?3:1).entries()){
   const beforeStep=await snap(desktop);
   const ground=footprint(b);
   const boxArea=(b.x2-b.x1+1)*(b.z2-b.z1+1);
   if(id==='lodging'||(id==='base'&&index===0))assert(ground.size<boxArea,'inn lost irregular outline');
   else assert.equal(ground.size,boxArea,'lost regular rectangular envelope '+id+'/'+index);
   await walk(desktop,await route(desktop,raw,beforeStep.position,(x,z)=>inside(ground,x,z)));
   let interior=await snap(desktop);
   assert.equal(interior.hiddenRoof,index,'wrong roof hidden at building '+index);
   assert.deepEqual(interior.visibleRoofs,start.buildings.map((_,i)=>i).filter(i=>i!==index),'neighbor roof disappeared');
   const toilet=raw.world.find(o=>o.y===0&&/latrine/i.test(o.type)&&ground.has(key(o.x,o.z)));
   assert(toilet,'missing toilet at '+id+'/'+index);
   await walk(desktop,await route(desktop,raw,interior.position,(x,z)=>
    ground.has(key(x,z))&&Math.abs(x-toilet.x)+Math.abs(z-toilet.z)===1));
   const isInn=id==='lodging'||(id==='base'&&index===0);
   const localPoint=([lx,lz])=>({x:b.x1+lx,z:b.z1+lz});
   const walkLocal=async (lx,lz,stay)=>{
    const point=localPoint([lx,lz]);
    return walk(desktop,await route(desktop,raw,(await snap(desktop)).position,
     (x,z)=>x===point.x&&z===point.z,null,stay));
   };
   if(isInn){
    // The clerk/ledger stays on the desk, and the owner's suite is reached
    // from the staff side without going back outside or through the public WC.
    const confined=(x,z)=>ground.has(key(x,z));
    // The 1F bench remains, and the player can now walk onto its tile.
    const bench=localPoint([8,8]);
    assert(raw.world.some(o=>o.y===0&&o.type==='benchWood'&&o.x===bench.x&&o.z===bench.z));
    await walkLocal(8,8,confined);
    await walkLocal(4,9,confined);
    if(out&&id==='lodging')await desktop.screenshot({path:out+'/lodging-reception.png'});
    for(const [x,z] of [[5,7],[5,4],[5,2],[6,2],[7,2]])await walkLocal(x,z,confined);
    if(out&&id==='lodging')await desktop.screenshot({path:out+'/lodging-ground.png'});
    for(const [x,z] of [[6,2],[5,2],[5,0],[5,-1],[5,0],[5,2],[5,4]])
     await walkLocal(x,z,(xx,zz)=>confined(xx,zz)||(xx===b.x1+5&&zz===b.z1-1));
    const upper=footprint(b,1);
    assert.deepEqual([...upper].sort(),[...ground].sort(),'upstairs must cover downstairs');
    const floor=new Set(raw.world.filter(o=>o.y===1&&/^woodfloor/.test(o.type)).map(o=>key(o.x,o.z)));
    const open=[...upper].filter(p=>!floor.has(p));
    assert.deepEqual(open,[key(b.x1+10,b.z1+6)],'unexpected views through missing upper floor');
   }
   if(b.floorFootprints['1']){
    const bedrooms=isInn?[[[4,4],[4,2]],[[7,4],[7,2]],[[5,6],[5,8]]].map(([door,free])=>
     ({door:localPoint(door),free:localPoint(free)})):[];
    await staircase(desktop,raw,ground,1,id+'-'+index,out,null,bedrooms);
   }
   if(b.floorFootprints['-1']){
    const point=(x,z)=>id==='base'?{x:b.x1+z,z:b.z2-x}:{x:b.x1+x,z:b.z1+z};
    const approach=point(10,1);
    const before=await snap(desktop);
    const chairTiles=new Set(raw.world.filter(o=>o.y===0&&['chairWood','stoolRound'].includes(o.type)).map(o=>key(o.x,o.z)));
    const at=([x,z],type)=>{
     const mark=point(x,z);
     return raw.world.some(o=>o.y===0&&o.x===mark.x&&o.z===mark.z&&o.type===type);
    };
    assert(at([8,8],'stoolRound'),'marked cashier staff stool');
    for(const type of ['counterWood','poiLedgerPapers'])assert(at([7,8],type),'marked cashier '+type);
    assert(at([7,7],'counterWood'),'second marked cashier tile');
    assert(!at([9,4],'poiLedgerPapers'),'serving counter still furnished as a till');
    const occupiedAisle=(x,z)=>ground.has(key(x,z))&&!chairTiles.has(key(x,z));
    const visit=async mark=>await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,
      (x,z)=>x===mark.x&&z===mark.z,null,occupiedAisle));
    // Exercise both sides of the cashier even when the seats are occupied.
    for(const mark of [point(6,8),point(6,7),point(8,7),point(9,6),point(10,6)])await visit(mark);
    if(out&&id==='kitchen'){
     const canvas=desktop.locator('#view');
     for(let n=0;n<7;n++)await canvas.dispatchEvent('wheel',{deltaY:-1});
     await desktop.screenshot({path:out+'/kitchen-cashier.png'});
     for(let n=0;n<7;n++)await canvas.dispatchEvent('wheel',{deltaY:1});
    }
    // Push through each staff door with actual key presses, including the east
    // door on the route to the unchanged stair aperture.
    for(const x of [4,11]){
     assert(at([x,4],'stonewallDoor'),'staff door '+x);
     const path=[point(x,5),point(x,4),point(x,3)];
     await visit(path[0]);
     await walk(desktop,path.map(p=>({...p,level:0})));
    }
    await visit(approach);
    if(out&&id==='kitchen'){
     const canvas=desktop.locator('#view');
     for(let n=0;n<11;n++)await canvas.dispatchEvent('wheel',{deltaY:-1});
     await desktop.screenshot({path:out+'/kitchen-cellar-approach.png'});
     for(let n=0;n<10;n++)await canvas.dispatchEvent('wheel',{deltaY:1});
    }
    assert.equal(before.position.level,0);
    const annex=id==='base'?{x:b.x1+4,z:b.z2-8}:{x:b.x1+8,z:b.z1+4};
    await staircase(desktop,raw,ground,-1,id+'-'+index,out,annex);
   }
   if(id==='workshop'||(id==='base'&&index===2)){
    const point=(x,z)=>id==='base'?{x:b.x2-z,z:b.z1+x}:{x:b.x1+x,z:b.z1+z};
    const counter=point(4,7),staff=point(3,6),customer=point(4,8);
    for(const type of ['counterWood','poiLedgerPapers'])assert(raw.world.some(o=>o.y===0&&o.x===counter.x&&o.z===counter.z&&o.type===type),'work-order counter '+type);
    assert(raw.world.some(o=>o.y===0&&o.x===staff.x&&o.z===staff.z&&o.type==='stoolRound'),'work-order stool');
    const apron=point(9,11);
    assert(raw.world.some(o=>o.x===apron.x&&o.z===apron.z&&o.y===0&&o.type==='handcartLoaded'),'parked loaded cart outside');
    await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>x===customer.x&&z===customer.z,null,
     (x,z)=>x!==staff.x||z!==staff.z));
    if(out&&id==='workshop')await desktop.screenshot({path:out+'/workshop-counter.png'});
    const annex=id==='base'?{x:b.x2-3,z:b.z1+9}:{x:b.x1+9,z:b.z1+3};
    await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>x===annex.x&&z===annex.z));
   }
   if(out&&id==='base')await desktop.screenshot({path:out+'/base-room-'+index+'.png'});
   if(id==='base') {
    const here=await snap(desktop);
    await walk(desktop,await route(desktop,raw,here.position,(x,z)=>here.buildings.every(other=>!inside(footprint(other),x,z))));
    assert.equal((await snap(desktop)).hiddenRoof,null,'roof did not restore');
   }
  }
  await expectStore(desktop);
  await desktop.reload();
  assert.equal((await snap(desktop)).active,false);
  await desktop.locator('#poiWalkToggle').click();
  const afterReload=await snap(desktop);
  assert(afterReload.active);
  assert.deepEqual(afterReload.position,{...start.spawn,level:0});
  assert.equal(afterReload.hiddenRoof,null);
  await desktop.locator('#poiWalkToggle').click();
  assert.equal((await snap(desktop)).active,false);
  await expectStore(desktop);
  await desktop.locator('#facilityExit').click();
  await desktop.waitForURL(url=>!url.searchParams.has('facility'));
  await desktop.waitForFunction(()=>window.__editorTest?.state?.().glLink===true);
  assert.equal(await snap(desktop),null);
  const restored=await desktop.evaluate(()=>window.__editorTest?.state());
  assert(restored?.world.some(o=>o.x===2&&o.z===2&&o.type==='stonewall'));
  await expectStore(desktop);
  console.log('PASS: '+id+' navigation, rendering, walking, JSON, storage and reload');
 }
 // Each new site has its own editor route and can be walked from a real entrance.
 for(const id of ['artisan','stable','homes','toolshop','base']){
  await desktop.goto(origin+'/?facility='+id+'&test=1');
  const before=await snap(desktop);
  assert.equal(before?.id,id);
  assert.equal(before?.active,false);
  const raw=await desktop.evaluate(()=>window.__editorTest.data());
  if(id==='base')assert.equal(await desktop.locator('#facilitySessionName').textContent(),'ゲーム世界');
  assert.equal(before.buildings.length,id==='base'?10:id==='homes'?3:1);
  await desktop.locator('#poiWalkToggle').click();
  if(out)await desktop.screenshot({path:out+'/town-'+id+'.png'});
  for(const b of before.buildings.slice(id==='base'?3:0)){
   const area=footprint(b);
   const exteriorDoors=raw.world.filter(o=>o.y===0&&o.type.endsWith('wallDoor')&&area.has(key(o.x,o.z))&&
    dirs.some(([dx,dz])=>!area.has(key(o.x+dx,o.z+dz))));
   assert(exteriorDoors.length>0,id+' missing exterior door');
   const insideOther=(x,z)=>before.buildings.some(bb=>inside(footprint(bb),x,z));
   await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>!insideOther(x,z)));
   const through=(x,z)=>exteriorDoors.some(o=>o.x===x&&o.z===z);
   await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,through,null,(x,z)=>!area.has(key(x,z))||through(x,z)));
   await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>inside(area,x,z),null,(x,z)=>area.has(key(x,z))));
   assert.equal((await snap(desktop)).hiddenRoof,before.buildings.indexOf(b));
   if(out&&id==='stable')await desktop.screenshot({path:out+'/stable-open-loading-bay.png'});
   if(out&&id==='homes')await desktop.screenshot({path:out+'/homes-interior-'+b.id+'.png'});
   if(id==='toolshop'){
    // Enter the bedroom from behind the shop, never through the WC or sales floor wall.
    const shopZone=(x,z)=>area.has(key(x,z));
    for(const [x,z] of [[6,4],[6,2],[4,2],[3,2],[4,2],[6,2],[6,4],[3,6]]){
     await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,
      (a,b2)=>a===b.x1+x&&b2===b.z1+z,null,shopZone));
     if(out&&x===3&&z===2)await desktop.screenshot({path:out+'/toolshop-private-room.png'});
    }
   }
   await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>!area.has(key(x,z))));
  }
  if(id==='base'){
   // Take the same route a player can use without walls between town and trail.
   const landscapeStops=[[34,53,'starter-meadow'],[67,38,'woodland-trail'],[19,42,'stable-lane']];
   for(const [x,z,name] of landscapeStops){
    await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(a,b)=>a===x&&b===z));
    assert.equal((await snap(desktop)).hiddenRoof,null,name+' should be outdoors');
    if(out)await desktop.screenshot({path:out+'/'+name+'.png'});
   }
  }
  await expectStore(desktop);
  console.log('PASS: '+id+' new neighborhood geometry, entrances and save isolation');
 }
 // Force editor reload on browser Back (launch default disables BFCache) with a
 // legacy snapshot that normal v102 boot would install and persist automatically.
 const historyPage=await browser.newPage({viewport:{width:1210,height:800}});
 await historyPage.goto(origin+'/?test=1');
 const historical=map('stonewall');
 historical.world=Array.from({length:100},(_,i)=>({x:i%10,z:Math.floor(i/10),y:0,type:i<3?'counterWood':'stonewall',rot:0}));
 const historicalJson=JSON.stringify(historical,null,2);
 await historyPage.evaluate(raw=>{
  localStorage.setItem('pine-guild-screenshot-before-v86',raw);
  localStorage.setItem('world-workshop-pois-v1','[ ]');
 },historicalJson);
 await historyPage.locator('#poiSampleCategories .categoryRow').click();
 await historyPage.locator('[data-facility-id="base"]').click();
 assert.equal((await snap(historyPage)).id,'base');
 await historyPage.goBack();
 assert(new URL(historyPage.url()).searchParams.has('facility-return'));
 assert.equal(await historyPage.evaluate(()=>localStorage.getItem('world-workshop-pois-v1')),'[ ]');
 assert.equal(await historyPage.evaluate(()=>localStorage.getItem('pine-guild-screenshot-before-v86')),historicalJson);
 console.log('PASS: browser Back preserves pending legacy guild data');
 assert.deepEqual(errors,[],'desktop page errors');
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 mobile.on('pageerror',e=>errors.push(e.message));
 await seed(mobile);
 await mobile.goto(origin+'/?test=1');
 const shell=async p=>p.locator('header h1,#undo,#redo,#quickTools button:not([hidden]),#poiGameTools button:not([hidden]),#mobileTabs button')
  .evaluateAll(nodes=>nodes.filter(e=>e.getClientRects().length>0).map(e=>[e.id,e.id?e.textContent.trim():e.tagName]));
 const normalShell=await shell(mobile);
 const commonControls=['#poiWalkPad','[data-poi-dir="n"]','[data-poi-dir="s"]','[data-poi-dir="e"]','[data-poi-dir="w"]','#poiWalkAction'];
 const playControls=async()=>{
  const bounds={};
  for(const css of commonControls){
   const loc=mobile.locator(css);assert(await loc.isVisible(),css+' not visible');
   const box=await loc.boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,css+' overflowed');
   bounds[css]=Object.fromEntries(Object.entries(box).map(([k,v])=>[k,Math.round(v)]));
  }
  const action=mobile.locator('#poiWalkAction');
  return {bounds,label:(await action.innerText()).replace(/\s+/g,' '),aria:await action.getAttribute('aria-label')};
 };
 await mobile.locator('#poiWalkToggle').tap();
 const normalPlay=await playControls();
 assert.match(normalPlay.label,/攻撃.*決定/);
 await mobile.locator('#poiWalkToggle').tap();
 await mobile.goto(origin+'/?facility=base&test=1');
 assert.equal((await snap(mobile)).id,'base');
 assert.equal((await snap(mobile)).active,false);
 assert.deepEqual(await shell(mobile),normalShell,'facility entry must keep ordinary upper/lower editor controls');
 if(out)await mobile.screenshot({path:out+'/mobile-editor.png'});
 await mobile.locator('#enterGameWorld').tap();
 assert.equal((await snap(mobile)).active,true);
 assert.deepEqual(await playControls(),normalPlay,'facility must use the ordinary pad and center action dimensions and labels');
 const actionBefore=(await snap(mobile)).combat.actionAt;
 await mobile.locator('#poiWalkAction').tap();
 assert((await snap(mobile)).combat.actionAt>actionBefore,'facility center tap did not dispatch the shared action');
 const mobileStart=(await snap(mobile)).position;
 const controls=[['n',0,-1],['s',0,1],['e',1,0],['w',-1,0]];
 let touched=false;
 for(const [dir,dx,dz] of controls){
  const x=mobileStart.x+dx,z=mobileStart.z+dz;
  if(!(await mobile.evaluate(([a,b])=>window.__editorTest.canStep(a,b),[x,z])))continue;
  await mobile.locator('[data-poi-dir="'+dir+'"]').tap();
  assert.deepEqual((await snap(mobile)).position,{x,z,level:0},'touch movement');
  touched=true;break;
 }
 assert(touched,'no legal movement from base spawn');
 if(out)await mobile.screenshot({path:out+'/mobile.png'});
 await expectStore(mobile);
 assert.deepEqual(errors,[],'page errors');
 const scratch=await browser.newPage({viewport:{width:1210,height:800}});
 await seed(scratch);
 await scratch.goto(origin+'/?facility=base&test=1');
 const count=async()=>scratch.evaluate(()=>window.__editorTest.data().world.filter(o=>o.x===0&&o.z===0).length);
 const beforeEdit=await count();
 assert.equal(await scratch.locator('#facilityCellarOption').count(),1,'cellar option not retained in editor');
 assert(await scratch.locator('#level option[value="9"]').isDisabled(),'cellar export needs one level of headroom');
 await scratch.locator('#openJson').click();
 await scratch.locator('#jsonText').fill(JSON.stringify(map(0)));
 await scratch.locator('#importJson').click();
 assert.equal(await count(),beforeEdit,'whole-map import changed the isolated facility');
 await scratch.locator('#closeJson').click();
 await scratch.evaluate(()=>window.__editorTest.place(0,0));
 assert.equal(await count(),beforeEdit+1,'facility edit not applied');
 await scratch.locator('#undo').click();assert.equal(await count(),beforeEdit);
 await scratch.locator('#redo').click();assert.equal(await count(),beforeEdit+1);
 await scratch.locator('#poiWalkToggle').click();assert((await snap(scratch)).active);
 await scratch.locator('#poiWalkToggle').click();assert.equal(await count(),beforeEdit+1);
 // Exercise the real object-category UI, then target the same coordinate
 // that the scenery picker delivers. The existing desk must not be replaced.
 const baseState=await snap(scratch),inn=baseState.buildings[0];
 const desk={x:inn.x1+4,z:inn.z1+8};
 const decorations=scratch.locator('#decorList');
 for(const label of ['オブジェクト','装飾品','帳簿・筆記具'])
  await decorations.locator('.categoryRow').filter({hasText:label}).first().click();
 assert(await decorations.getByRole('button',{name:'帳簿と書類',exact:true}).isVisible(),'missing papers in decorative palette');
 const allAt=async ({x,z})=>scratch.evaluate(([x,z])=>window.__editorTest.data().world.filter(o=>o.x===x&&o.z===z&&o.y===0),[x,z]);
 const furnished=await allAt(desk);
 assert(furnished.some(o=>o.type==='counterWood')&&furnished.some(o=>o.type==='poiLedgerPapers'));
 const desk2={x:desk.x+1,z:desk.z};
 await decorations.getByRole('button',{name:'帳簿と書類',exact:true}).click();
 await scratch.evaluate(({x,z})=>window.__editorTest.place(x,z),desk2);
 assert((await allAt(desk2)).some(o=>o.type==='counterWood')&&(await allAt(desk2)).some(o=>o.type==='poiLedgerPapers'));
 await scratch.locator('#undo').click();
 assert(!(await allAt(desk2)).some(o=>o.type==='poiLedgerPapers'),'decoration undo retained new decor');
 await scratch.locator('#redo').click();
 assert((await allAt(desk2)).some(o=>o.type==='poiLedgerPapers'),'decoration redo lost new decor');
 // The second bottom Check press clears annotations, never map objects.
 const snapshotData=()=>scratch.evaluate(()=>window.__editorTest.data());
 await scratch.locator('#pineCheckMode').click();
 await scratch.evaluate(()=>{window.__editorTest.check(2,2);window.__editorTest.check(3,3)});
 const marked=await snapshotData();
 assert.equal(marked.checks.length,2);
 await scratch.locator('#pineCheckMode').click();
 const afterClear=await snapshotData();
 assert.equal(afterClear.checks.length,0);
 assert.deepEqual(afterClear.world,marked.world);
 await scratch.locator('#undo').click();
 assert.deepEqual((await snapshotData()).checks,marked.checks);
 await scratch.locator('#redo').click();
 assert.equal((await snapshotData()).checks.length,0);
 const [scratchFile]=await Promise.all([scratch.waitForEvent('download'),scratch.locator('#facilityExport').click()]);
 assert.equal(JSON.parse(readFileSync(await scratchFile.path(),'utf8')).world.filter(o=>o.x===0&&o.z===0).length,beforeEdit+1);
 await expectStore(scratch);
 scratch.once('dialog',d=>d.accept());
 await scratch.reload();assert.equal(await count(),beforeEdit,'temporary edit appeared in the original or template after reload');
 await expectStore(scratch);
 console.log('PASS: ordinary mobile editor shell and temporary edit/undo/redo/export without any original-save change');
 console.log('PASS: New POI discovery, WebGL, four preview routes and exports, real keyboard door passage and roof switching, reload, return, unchanged save bytes, mobile controls.');
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
