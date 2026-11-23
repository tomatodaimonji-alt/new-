import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/uLootHighlight/,'v205 marks actual loot models through their shader');
assert.doesNotMatch(html,/function poiLootMarksDraw\(/,'obsolete vertical beacon mesh must be absent');
assert.match(html,/smoothstep\(9\.0,12\.0,length\(vLootXZ-uLootHighlight\.xy\)\)/,'actual shader softly falls off from nine cells and reaches neutral beyond twelve');
assert.match(html,/visible:poiDungeonVisualVisible\(/,'production still exposes real scoped actors');
if(process.env.LOOT_PULSE_LAYOUT_ONLY==='1'||process.env.DUNGEON_LOOT_LAYOUT_ONLY==='1'){
 console.log('PASS actual loot shader exists and obsolete post mesh is gone');
 process.exit(0);
}
// Expose which saved objects contribute real vertices, without changing
// their scope, material, mesh, storage, or draw call.
const filterLine='    if(d.y!==poiWalkLevel||!validPos(d.x,d.z)||!poiDungeonVisualVisible(d.x,d.z,d.y))continue;';
const rebuildLine='  poiInventoryReleaseMesh();\n  poiInventoryMeshDrops=';
const wildPick=' const p=poiWildPick(rng);';
const batchLine=' gl.uniform4f(loc.lootHighlight,poiWalkX+.5,poiWalkZ+.5,pulse,1);';
for(const anchor of [filterLine,rebuildLine,wildPick,batchLine])assert.equal(html.split(anchor).length,2,anchor);
const fixture=html.replace(rebuildLine,'  window.__drawnItemRecords=[];\n'+rebuildLine)
 .replace(filterLine,filterLine+'\n    (window.__drawnItemRecords||=[]).push({type:d.type,x:d.x,z:d.z,y:d.y});')
 .replace(batchLine," window.__pulseBatch=batch===poiEconomyMesh?'coins':batch===poiInventoryMesh?'inventory':'other';\n"+batchLine)
 .replace(wildPick,' const p=null;'); // preserve all authored monsters and combat
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixture</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const editorKey='forest-world-editor-v1',personal='{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}';
const knifeSurface={id:'north-watchpost-warrior',type:'equipBoneSword',x:124,z:43,y:0,durability:37};
const far={id:'monsterSkelArcher',type:'equipWoodBow',x:124,z:50,y:0,durability:31};
const wrongFloor={id:'monsterSkelWarrior',type:'equipBoneSword',x:124,z:42,y:-1,durability:31};
const daggerMine={id:'monsterSkelWarrior',type:'equipBoneSword',x:116,z:61,y:-1,durability:31};
const wrongRealm={id:'monsterSkelKnight',type:'equipIronSword',x:106,z:78,y:-1,durability:31};
const aboveMine={...knifeSurface,x:116,z:61};
const cases=[
 {id:'night-surface',x:124,z:34,y:0,item:knifeSurface,foreign:[wrongFloor],far,dir:'ArrowDown'},
 {id:'mine',x:116,z:60,y:-1,item:daggerMine,foreign:[wrongRealm,aboveMine],dir:'ArrowDown'}
];
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const game=page=>page.evaluate(()=>window.__editorTest.facility());
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const geometry=page=>page.evaluate(()=>window.__drawnItemRecords||[]);
const exact=(a,b)=>a.type===b.type&&a.x===b.x&&a.z===b.z&&a.y===b.y;
async function launch(browser,c){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  // Observe actual GLES uniforms and drawArrays. No state changes are made.
  window.__pulseGL={active:[],reset:0,draws:0,depthBad:0,states:[]};
  for(const P of [window.WebGLRenderingContext?.prototype,window.WebGL2RenderingContext?.prototype].filter(Boolean)){
   const locations=new WeakSet(),daylightLocations=new WeakSet(),daylight=new WeakMap(),state=new WeakMap();
   const locate=P.getUniformLocation,uniform=P.uniform4f,vector=P.uniform4fv,day=P.uniform3f,draw=P.drawArrays;
   P.getUniformLocation=function(program,name){
    const location=locate.call(this,program,name);if(location&&name==='uLootHighlight')locations.add(location);
    if(location&&name==='uTownDaylight')daylightLocations.add(location);
    return location;
   };
   const record=(gl,l,v)=>{
    if(!l||!locations.has(l))return;
    state.set(gl,v);
    const r=window.__pulseGL;
    if(v[3]>.5){
     if(r.active.length<2000)r.active.push({x:v[0],z:v[1],pulse:v[2],t:performance.now()});
    }else{r.reset++}
   };
   P.uniform3f=function(l,r,g,b){if(l&&daylightLocations.has(l))daylight.set(this,[r,g,b]);return day.apply(this,arguments)};
   P.uniform4f=function(l,a,b,c,d){record(this,l,[a,b,c,d]);return uniform.apply(this,arguments)};
   P.uniform4fv=function(l,v){record(this,l,Array.from(v));return vector.apply(this,arguments)};
   P.drawArrays=function(mode,first,count){
    const v=state.get(this),p=window.__pulseGL;
    if(v?.[3]>.5&&count>0){
     p.draws++;
     if(p.draws<=50){
      if(!this.isEnabled(this.DEPTH_TEST)||!this.getParameter(this.DEPTH_WRITEMASK))p.depthBad++;
      p.states.push({mode,count,batch:window.__pulseBatch,daylight:daylight.get(this)});
     }
    }
    return draw.apply(this,arguments);
   };
  }
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({kitKey,resumeKey,editorKey,personal,c})=>{
  localStorage.setItem(kitKey,JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,gold:12,claimedCaches:['glade'],armedDrops:[c.item,...c.foreign,c.far].filter(Boolean)}));
  localStorage.setItem(editorKey,personal);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:0}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:c.x,z:c.z,y:c.y,facing:2},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:c.y,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{kitKey,resumeKey,editorKey,personal,c});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await game(page)).position,{x:c.x,z:c.z,level:c.y});
 return {ctx,page,errors};
}
const pulseValue=page=>page.evaluate(()=>window.__pulseGL);
async function trial(browser,c){
 const {ctx,page,errors}=await launch(browser,c);
 try{
  const world=await map(page),raw=await stock(page),url=page.url();
  await page.waitForFunction(item=>window.__drawnItemRecords?.some(a=>a.type===item.type&&a.x===item.x&&a.z===item.z&&a.y===item.y),c.item);
  let records=await geometry(page);
  if(c.far)assert(records.some(a=>exact(a,c.far)),'plain model stays present even beyond highlight radius');
  assert(records.some(a=>exact(a,c.item)),'actual mesh batch contains the saved same-floor weapon');
  for(const item of c.foreign)assert(!records.some(a=>exact(a,item)),'wrong floor/realm cannot feed into a loot mesh');
  await page.waitForFunction(()=>{
   const p=window.__pulseGL,samples=p.active.map(a=>a.pulse);
   return p.draws>=3&&p.reset>=3&&samples.length>=3&&Math.max(...samples)-Math.min(...samples)>.15;
  },null,{timeout:11000});
  const highlight=await pulseValue(page);
  assert(highlight.active.every(v=>Math.abs(v.x-c.x-.5)<.01&&Math.abs(v.z-c.z-.5)<.01),'GPU effect centered on actual player from stationary portrait fixture');
  assert.equal(highlight.depthBad,0,'highlight does not bypass occlusion by walls or terrain');
  assert(highlight.states.every(v=>v.mode===4&&v.count>0&&(v.batch==='coins'||v.batch==='inventory')),'highlight wraps only native loot triangle batches');
  assert(highlight.states.some(v=>v.batch==='inventory'));
  if(c.y===0){
   assert(highlight.states.some(v=>v.batch==='coins'),'actual existing coin pile batch gets the same soft treatment');
   assert(highlight.states.some(v=>v.batch==='inventory'&&v.daylight?.[0]<.70),'actual outdoor item applies under midnight lighting');
  }
  assert.equal(await stock(page),raw,'pulse/visibility cannot itself transfer the item');
  if(out){
   await page.screenshot({path:out+'/v205-'+c.id+'-loot.png'});
  }
  for(let z=c.z+1;z<=c.item.z;z++){
   await page.keyboard.press(c.dir);
   await page.waitForFunction(z=>window.__editorTest.facility().position.z===z,z,{timeout:5000});
   await page.waitForTimeout(211);
  }
  await page.waitForFunction(({k,id})=>!JSON.parse(localStorage.getItem(k))?.armedDrops?.some(d=>d.id===id),{k:kitKey,id:c.item.id});
  await page.waitForFunction(item=>!window.__drawnItemRecords?.some(a=>a.type===item.type&&a.x===item.x&&a.z===item.z&&a.y===item.y),c.item);
  records=await geometry(page);
  assert(!records.some(a=>exact(a,c.item)),'picked up object no longer contributes highlighted mesh');
  const inventory=(await game(page)).inventory;
  assert([...inventory.hotbar,...inventory.bag].some(i=>i?.type===c.item.type&&i.durability===c.item.durability));
  const after=await stock(page);
  for(const f of c.foreign)assert(JSON.parse(after).armedDrops?.some(a=>exact(a,f)),'pickup does not mutate other-floor/realm data');
  assert.equal(page.url(),url);assert.deepEqual(await map(page),world);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),editorKey),personal);
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.equal(await stock(page),after);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function scope(browser,start,realm){
 const {ctx,page,errors}=await launch(browser,{...start,item:null,foreign:[]});
 try{
  const snapshot=await game(page);
  const living=snapshot.combat.actors.filter(a=>a.level===-1&&a.hp>0);
  const rendered=living.filter(a=>a.visible===true);
  const dragon=living.find(a=>a.type==='monsterDragon');
  const chapel=living.find(a=>a.type==='monsterSkeleton'&&a.x===79&&a.z===78);
  assert(dragon&&chapel,'actual authored dungeon actors remain registered and alive');
  assert.equal(dragon.visible,realm,'living dragon appears only in Otherworld, not behind mine walls');
  assert.equal(chapel.visible,false,'chapel skeleton does not float in either neighboring underground region');
  if(realm)assert(!rendered.some(a=>a.type==='monsterMineGuard'||a.type==='monsterSlime'));
  else{
   assert(rendered.some(a=>a.type==='monsterMineGuard'),'mine golem stays render-eligible');
   assert(rendered.filter(a=>a.type==='monsterSlime').length>=2,'native mine slimes stay render-eligible');
  }
  if(out)await page.screenshot({path:out+'/v205-'+(realm?'otherworld':'mine')+'-scoped.png'});
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 if(process.env.DUNGEON_LOOT_CASE!=='beacons'&&process.env.DUNGEON_LOOT_CASE!=='loot'&&!process.env.LOOT_PULSE_CASE){
  await scope(browser,{x:116,z:60,y:-1},false);
  await scope(browser,{x:100,z:90,y:-1},true);
 }
 if(process.env.DUNGEON_LOOT_CASE!=='scope')for(const c of cases.filter(c=>!process.env.LOOT_PULSE_CASE||process.env.LOOT_PULSE_CASE===c.id))await trial(browser,c);
 console.log('PASS actual depth-tested pulsing loot on night surface and mine, scoped records, pickup and reload');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
