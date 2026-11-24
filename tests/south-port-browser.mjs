import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(s,a,b){assert.equal(s.split(a).length,2,a);return s.replace(a,b)}
const anchor='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';
let fixture=inject(source,anchor,anchor+`
  southPortQA:{
   manual:()=>{window.__portManualFrames=true},
   frame:()=>{if(!window.__portManualFrames)throw Error('manual frames not armed');render()},
   stepClock:()=>[performance.now(),poiWalkNextReady],
   state:()=>{
    const api=window.__editorTest, place=api.facility(),road=facilitySite.southRoad,port=facilitySite.southPort??null;
    return {now:performance.now(),ready:poiWalkNextReady,pos:place.position,location:place.miniMap.location,
     scene:place.sceneLayer,entranceSerial:place.dungeonEntranceSerial,music:place.musicZone,
     port:port?{name:port.name,entrance:port.entrance,market:port.market,fisher:port.fisher,dock:port.dock}:null,
     old:{name:road.town.name,inn:road.town.inn.name,market:road.town.market.name,arrival:road.town.arrival,
      oldMarketDoor:road.town.market.door,oldInnDoor:road.town.inn.door},
     local:api.localSceneStatus?.()??null,vertexCount:sceneMesh?.count??0,scenes:facilityScenes.size,worldSize:world.length,
     inventory:place.inventory,economy:place.economy,residents:api.townResidents()?.actors,
     stored:JSON.parse(localStorage.getItem('world-workshop-resume-v1')||'null')};
   }
  },
`);
const schedule='function render(){\n if(window.pineStartup.failed)return;\n requestAnimationFrame(render);';
fixture=inject(fixture,schedule,schedule.replace('requestAnimationFrame(render);','if(!window.__portManualFrames)requestAnimationFrame(render);'));
fixture=inject(fixture,' const p=poiWildPick(rng);',' const p=null;');
fixture=inject(fixture,'function poiWildRegionalFrame(now,rng){','function poiWildRegionalFrame(now,rng){return;');
if(process.env.SOUTH_PORT_LAYOUT_ONLY==='1'){
 for(const [,,js] of [...fixture.matchAll(/<script(?:\s+([^>]*))?>([\s\S]*?)<\/script>/gi)].filter(([,a])=>!a||!/\b(?:src|type)\s*=/.test(a)))new Script(js);
 console.log('PASS south port fixture exact anchors and instrumented script parses');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>seed</title>':fixture)});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));
const base='http://127.0.0.1:'+server.address().port;
const resume='world-workshop-resume-v1',hotbar='world-workshop-hotbar-v1',clock='world-workshop-town-clock-v1',editor='forest-world-editor-v1';
const markerMap='{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}';
const q=p=>p.evaluate(()=>window.__editorTest?.southPortQA.state());
const xy=p=>[p.x,p.z],pos=(x,z)=>({x,z,level:0});
const arithmetic=(x,sign,to)=>Array.from({length:Math.abs(x-to)},(_,i)=>x+(i+1)*sign);
function line([x,z],[u,v]){
 assert(x===u||z===v,'must be an intentional cardinal path between authored waypoints');
 return x===u?arithmetic(z,Math.sign(v-z),v).map(j=>[x,j]):arithmetic(x,Math.sign(u-x),u).map(i=>[i,z]);
}
// Follow the real straight dock path while the fisher works on its side platform.
const checkpoints=[[105,111],[105,123],[91,123],[84,123],[84,120],[79,120],[79,118],[73,118]];
const portResidents=['portfishseller','portfisher'];
const portActors=s=>(s.residents??[]).filter(a=>portResidents.includes(a.id));
const complete=checkpoints.slice(1).reduce((a,p,i)=>a.concat(line(checkpoints[i],p)),[checkpoints[0]]);
const arrow=(dx,dz)=>dx<0?'ArrowLeft':dx>0?'ArrowRight':dz<0?'ArrowUp':'ArrowDown';
const economyInvariant=async p=>p.evaluate(([hotbar,editor])=>{
 const kit=JSON.parse(localStorage.getItem(hotbar));
 return {gold:kit.gold,weapon:kit.weapon,potions:kit.potions,slots:kit.slots,worn:kit.worn,
  claimedCaches:kit.claimedCaches,editor:localStorage.getItem(editor)};
},[hotbar,editor]);
async function ready(p){
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:20000});
 await p.waitForFunction(()=>window.__editorTest?.facility()?.active&&document.querySelector('#viewWrap')?.hasAttribute('data-analog-play'),null,{polling:30,timeout:10000});
 const wall=await p.evaluate(()=>Date.now());
 await p.clock.pauseAt(wall+1500);
 await p.evaluate(()=>window.__editorTest.southPortQA.manual());
}
async function tick(p,ms){
 await p.clock.fastForward(ms);
 await p.evaluate(()=>window.__editorTest.southPortQA.frame());
}
async function walk(p,route){
 if(!route.length)return;
 let [x,z]=xy((await q(p)).pos);
 for(const [nextX,nextZ] of route){
  const dx=nextX-x,dz=nextZ-z;
  assert.equal(Math.abs(dx)+Math.abs(dz),1);
  const ctl=await p.evaluate(()=>window.__editorTest.southPortQA.stepClock());
  if(ctl[0]<ctl[1])await tick(p,Math.ceil(ctl[1]-ctl[0])+2);
  await p.keyboard.press(arrow(dx,dz));
  await tick(p,230);
  const state=await p.evaluate(()=>{const p=window.__editorTest.freeMovementPose();return [Math.round(p.x),Math.round(p.z),p.level]});
  assert.deepEqual(state,[nextX,nextZ,0],'genuine movement '+[x,z]+' → '+[nextX,nextZ]);
  [x,z]=[nextX,nextZ];
 }
}
async function reload(p,where){
 await tick(p,560);
 const stored=(await q(p)).stored;
 assert.deepEqual([stored.position.x,stored.position.z,stored.position.y],[...where,0]);
 assert.equal(stored.route,'facility');assert.equal(stored.id,'base');
 // Fresh document, retaining only the normal save storage. No start override.
 await p.clock.resume();
 await p.reload();
 await ready(p);
 const restored=await q(p);
 assert.deepEqual(restored.pos,pos(...where),'cold resume must be exact without coordinate translation');
 return restored;
}
let browser,phase='launch';
const watchdog=setTimeout(()=>{console.error('south port browser stalled: '+phase);process.exit(1)},125000);
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
  phase='load old layout-5 save at southern inn';
  await p.clock.install({time:new Date('2026-11-24T12:00:00Z')});
  await p.goto(base+'/seed');
  await p.evaluate(({resume,hotbar,clock,editor,markerMap})=>{
   localStorage.setItem(hotbar,JSON.stringify({version:1,weapon:'equipWoodSword',potions:0,gold:37,claimedCaches:['glade']}));
   localStorage.setItem(clock,'{"version":1,"gameMs":285000}');
   localStorage.setItem(editor,markerMap);
   localStorage.setItem(resume,JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:{x:105,z:111,y:0,facing:2},townLayout:5,townMapHeight:128,
    view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
  },{resume,hotbar,clock,editor,markerMap});
  await p.goto(base+'/?resume=1&test=1');await ready(p);
  const initial=await q(p),stock=await economyInvariant(p),url=p.url();
  assert.deepEqual(initial.pos,pos(...complete[0]));
  assert.equal(initial.location,'街道の宿場');
  assert.equal(initial.old.inn,'並木の宿');assert.equal(initial.old.market,'街道市場');
  assert.deepEqual(xy(initial.old.oldMarketDoor),[102,112]);
  assert.deepEqual(xy(initial.old.oldInnDoor),[108,116]);
  assert.equal(initial.port?.name,'セルネア');
  assert.deepEqual(xy(initial.port.entrance),[91,123]);
  const far=[110,111];
  phase='old inn at a distance: no port draw/build';
  await walk(p,line(complete[0],far));
  const distant=await q(p);
  assert.equal(distant.location,'街道の宿場');
  assert.equal(distant.local?.active,null,'port props are absent beyond the local eviction buffer');
  assert.equal(distant.local.vertices,0);
  assert.deepEqual(portActors(distant),[],'port residents are not even active by the old inn');
  assert(distant.residents.some(a=>a.id==='southmerchant'),'old market merchant still participates in native resident schedule');
  await tick(p,120);
  const stayed=await q(p);
  assert.equal(stayed.local.draws,distant.local.draws,'distant scene spends no port-specific draw');
  assert.equal(stayed.local.builds,distant.local.builds,'distant scene performs no port mesh rebuild');
  phase='cold reload before crossing to the new port';
  const farReload=await reload(p,far);
  assert.deepEqual(farReload.local,{active:null,vertices:0,builds:0,draws:0},
   'cold old-side resume allocates no local port mesh and submits no port draw');
  await walk(p,line(far,complete[0]));
  phase='walk the connected old-road and new harbor route';
  const entrance=complete.findIndex(([x,z])=>x===91&&z===123);
  await walk(p,complete.slice(1,entrance+1));
  const arriving=await q(p);
  assert.deepEqual(arriving.pos,pos(...complete[entrance]));
  assert.equal(arriving.local.active,'southPort');
  assert(arriving.local.vertices>0&&arriving.local.draws>0,'walk-in activates and draws actual local port geometry');
  const traders=portActors(arriving);
  for(const [id,x,z,activity] of [
   ['portfishseller',84,117,'fish-stall'],['portfisher',77,117,'fishing']
  ]){
   const a=traders.find(a=>a.id===id);
   assert(a&&!a.recessed&&a.activity===activity&&a.x===x&&a.z===z,
    'nearby runtime activates '+id+' at its real daytime anchor: '+JSON.stringify(traders));
  }
  await walk(p,complete.slice(entrance+1));
  phase='dock and solid water barrier';
  const dock=await q(p);
  assert.deepEqual(dock.pos,pos(...complete.at(-1)));
  assert.equal(dock.scene,'surface');assert.equal(dock.location,'セルネア');
  assert.equal(dock.local.active,'southPort');
  assert.equal(dock.local.builds,arriving.local.builds,'walking within the port does not upload a new local mesh per step');
  assert.equal(dock.entranceSerial,initial.entranceSerial);assert.equal(p.url(),url);
  await p.keyboard.press('ArrowLeft');await tick(p,240);
  assert.deepEqual((await q(p)).pos,dock.pos,'ordinary input cannot walk off the last plank into deep sea');
  phase='cold reload on the far dock';
  const restored=await reload(p,complete.at(-1));
  assert.equal(restored.location,'セルネア');
  // One real frame is explicitly driven after cold resume to verify it
  // actually rehydrates the local geometry instead of only the coordinate.
  await tick(p,64);
  assert.equal((await q(p)).local.active,'southPort');
  await p.keyboard.press('ArrowLeft');await tick(p,240);
  assert.deepEqual((await q(p)).pos,dock.pos,'blocked shoreline is still solid after resume');
  phase='walk the same continuous connection home';
  await walk(p,complete.slice(0,-1).reverse());
  const end=await q(p);
  assert.deepEqual(end.pos,initial.pos);
  assert.equal(end.location,initial.location);
  assert.deepEqual(end.old,initial.old);
  assert.equal(end.entranceSerial,initial.entranceSerial);
  await walk(p,line(complete[0],far));
  const departed=await q(p);
  assert.equal(departed.local.active,null,'leaving the vicinity releases the local render buffer');
  assert.equal(departed.local.vertices,0);
  assert.deepEqual(portActors(departed),[],'leaving the vicinity retires port resident simulation');
  assert(departed.residents.some(a=>a.id==='southmerchant'));
  assert.deepEqual(await economyInvariant(p),stock,'ordinary port travel preserves funds, item bag and the private editor save');
  assert.deepEqual(errors,[]);
  console.log('PASS real south port walk, no swimming, two cold resumes and old village/economy intact');
 }finally{await ctx.close()}
}finally{await browser?.close();await new Promise(r=>server.close(r));clearTimeout(watchdog)}
