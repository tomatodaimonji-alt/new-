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
async function route(page,map,start,check,transition=null){
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
   if(!pass.has(k)||prev.has(k)||(blockedByStair.has(k)&&!(transition!==null&&check(x,z))))continue;
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
async function staircase(page,map,area,delta,id,out,annex=null){
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
 assert.equal(await desktop.locator('[data-facility-id]').count(),4,'built-in POI entries');
 assert.equal(await desktop.locator('#poiSampleCategories button').filter({hasText:'冒険者ギルド'}).count(),1,'existing guild still selectable');
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
  assert.equal(start.buildings.length,id==='base'?3:1);
  assert(start.roofMeshes.every(count=>count>0));
  if(out)await desktop.screenshot({path:out+'/'+id+'.png'});
  for(const [index,b] of start.buildings.entries()){
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
   if(id==='lodging'||(id==='base'&&index===0)){
    for(const [lx,lz] of [[7,6],[4,6],[4,8],[3,4]]){
     await walk(desktop,await route(desktop,raw,(await snap(desktop)).position,(x,z)=>x===b.x1+lx&&z===b.z1+lz));
    }
    if(out&&id==='lodging')await desktop.screenshot({path:out+'/lodging-ground.png'});
   }
   if(b.floorFootprints['1'])await staircase(desktop,raw,ground,1,id+'-'+index,out);
   if(b.floorFootprints['-1']){
    const annex=id==='base'?{x:b.x1+4,z:b.z2-8}:{x:b.x1+8,z:b.z1+4};
    await staircase(desktop,raw,ground,-1,id+'-'+index,out,annex);
   }
   if(id==='workshop'||(id==='base'&&index===2)){
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
 await mobile.goto(origin+'/?facility=base&test=1');
 assert.equal((await snap(mobile)).id,'base');
 assert.equal((await snap(mobile)).active,false);
 assert.deepEqual(await shell(mobile),normalShell,'facility entry must keep ordinary upper/lower editor controls');
 if(out)await mobile.screenshot({path:out+'/mobile-editor.png'});
 await mobile.locator('#enterGameWorld').tap();
 assert.equal((await snap(mobile)).active,true);
 for(const css of ['#poiWalkToggle','[data-poi-dir="n"]']){
  const loc=mobile.locator(css);assert(await loc.isVisible(),css+' not visible');
  const box=await loc.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=390&&box.y+box.height<=844,css+' overflowed');
 }
 const pad=await mobile.locator('#poiWalkPad').boundingBox();
 const north=await mobile.locator('[data-poi-dir="n"]').boundingBox();
 assert(pad.height<=180&&north.width>=44&&north.height>=44,'compact touch controls');
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
