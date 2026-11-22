import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// Fix only the first wild spawn coordinate for repeatable real player combat.
const spawnAnchor='const p=poiWildPick(rng);';
assert.equal(html.split(spawnAnchor).length,2);
const startMesh=html.indexOf('function poiMonsterRender(');
const stopMesh=html.indexOf('poiMonsterDrawBreaks(m,now);',startMesh);
const render=html.slice(startMesh,stopMesh);
const meshStart='for(const [obj,s] of poiMonsterStates){';
const meshEnd='\n  }\n  ';
assert.ok(startMesh>=0&&stopMesh>startMesh&&render.includes(meshStart)&&render.endsWith(meshEnd),'unique live slime render loop');
const observedRender=render
 .replace(meshStart,meshStart+'const __slimeStart=m.p.length;')
 .slice(0,-meshEnd.length)+`
   if(obj.type==='monsterSlime'&&(s.wildSpawn||s.townOwned)&&m.p.length>__slimeStart){
    const cache=window.__slimeGeometry??=(Object.create(null));
    let min=Infinity,max=-Infinity;
    for(let __i=__slimeStart+1;__i<m.p.length;__i+=3){min=Math.min(min,m.p[__i]);max=Math.max(max,m.p[__i]);}
    const key=s.wildSpawn?'wild':s.townHunt;
    const hp=s.wildSpawn?poiPlayerHP:poiTownNpcActors.find(a=>a.role.id===s.townHunt)?.hp;
    const sample={min,height:max-min,now,hp,tile:[s.x,s.z],attack:attack?{...attack}:null,vertices:(m.p.length-__slimeStart)/3};
    cache[key]=sample;
    if(key==='wild'||key==='resadventurer'){
     const logs=window.__slimeMeshFrames??=(Object.create(null));
     (logs[key]??=[]).push(sample);
     if(logs[key].length>200)logs[key].shift();
    }
   }
  }
  `;
const observed=html.slice(0,startMesh)+observedRender+html.slice(stopMesh);
const fixture=observed.replace(spawnAnchor,'const p=(poiWalkX===41&&poiWalkZ===73)?{x:42,z:73}:poiWildPick(rng);');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/player')?fixture:observed);
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
const open='#enterGameWorld';
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:680},deviceScaleFactor:.65,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  if(clockStart!==null)localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:clockStart*500}));
  if(kit)localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify(kit));
  if(start)localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id,play:true,position:{...start,y:level,facing},townLayout,
   view:{yaw,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:camera,orbitYaw,orbitPitch:pitch,orbitDistance:dist}}));
 },{fixtures,resumeKey,id,start,camera,yaw,orbitYaw,pitch,townLayout,facing,kit,clockStart,dist,level});
 await page.goto(origin+'/'+fixture+(start?'?resume=1&test=1':'?facility='+id+'&test=1'));
 if(!start)await page.locator(open).tap();
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.equal((await state(page)).id,id);
 return {ctx,page,errors};
}

const kit={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readKit=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')));
const readMap=page=>page.evaluate(()=>window.__editorTest.data());
async function timeline(page,npc){
 return page.evaluate(npc=>new Promise(resolve=>{
  const start=performance.now(),rows=[];
  let firstContact=null;
  const host=()=>window.__editorTest.townResidents();
  const readMeshes=()=>window.__slimeMeshFrames?.[npc?'resadventurer':'wild']??[];
  function tick(now){
   const f=window.__editorTest.facility(),r=npc?host():null;
   const target=npc?r.actors.find(a=>a.id==='resadventurer'):null;
   const prey=npc?r.encounters.find(a=>a.owner==='resadventurer'):null;
   const slime=npc?prey&&f.combat.actors.find(a=>!a.wildSpawn&&a.type==='monsterSlime'&&a.x===prey.x&&a.z===prey.z&&a.level===prey.y)
    :f.combat.actors.find(a=>a.wildSpawn&&a.type==='monsterSlime'&&a.x===42&&a.z===73);
   if(slime){
    const hp=npc?target.hp:f.combat.playerHP;
    const row={now,hp,pos:[slime.x,slime.z],target:npc?[target.x,target.z]:[f.position.x,f.position.z],attack:slime.attack??null,mesh:window.__slimeGeometry?.[npc?'resadventurer':'wild']??null};
    rows.push(row);
    if(hp<100&&firstContact===null)firstContact=now;
   }
   if(firstContact!==null&&now-firstContact>=480)return resolve({rows,firstContact,meshes:readMeshes()});
   if(now-start>43000)return resolve({rows,firstContact,meshes:readMeshes()});
   requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
 }),npc);
}
function assertAttack(trace,label){
 const {rows,firstContact,meshes}=trace;
 assert.ok(firstContact!==null,label+' received true contact damage');
 const hit=rows.find(r=>r.now===firstContact);
 assert.equal(hit.hp,94,label+' loses exactly six HP, once');
 assert.ok(rows.slice(rows.indexOf(hit)).every(r=>r.hp===94),'no duplicate hit within slime recovery');
 // SwiftShader may paint only one or two frames during a 360 ms attack.
 // Use the actual submitted vertex frame, not the later observation by RAF.
 const visible=meshes.filter(m=>m.vertices>=12);
 const contact=visible.find(m=>m.hp===94&&m.attack?.phase==='contact');
 assert.ok(contact,label+' impact and HP change share a real mesh contact frame: '+JSON.stringify(visible.slice(-12)));
 assert.equal(contact.attack.contact,170);
 assert.ok(contact.attack.elapsed>=170&&contact.attack.elapsed<195,'contact key is sampled at the planned animation point');
 const rest=visible.find(m=>!m.attack&&m.hp===100);
 assert.ok(rest,'real rest mesh for comparison');
 assert.ok(visible.some(m=>m.hp===100&&m.now<contact.now),'no damage before the rendered contact');
 assert.ok(contact.min>rest.min+.09,'submitted vertex batch leaves the ground');
 assert.ok(contact.height<rest.height*.96,'submitted vertex batch compresses at the impact pose');
 const hop=contact.attack;
 assert.deepEqual(contact.tile,hit.pos,'mesh lunge remains anchored to real collider tile');
 const dot=hop.dx*(hit.target[0]-hit.pos[0])+hop.dz*(hit.target[1]-hit.pos[1]);
 assert.ok(dot>.25,'contact lunge is directed toward target');
 const active=rows.filter(r=>r.attack&&r.now>=firstContact-180&&r.now<=firstContact+150);
 assert.ok(active.every(r=>r.pos[0]===hit.pos[0]&&r.pos[1]===hit.pos[1]),'visual hop never moves the real tile');
 assert.ok(visible.some(m=>m.now>contact.now&&(!m.attack||m.attack.lift<.12))||
  label==='resident target'&&rows.at(-1).now-firstContact>=480,'settles, or scene has removed the subsequently defeated prey');
 console.log(label,JSON.stringify({hp:hit.hp,contact:hop,sceneObservation:hit.attack,meshSamples:visible.length}));

}
async function exercise(browser,npc){
 const start=npc?{x:53,z:72}:{x:41,z:73};
 const config={width:390,kit,facing:1,...(npc?{clockStart:9*60,camera:true,orbitYaw:1.5*Math.PI,pitch:.15,dist:6}:{fixture:'player'})};
 const {ctx,page,errors}=await launch(browser,'base',start,config);
 try{
  const authored=await readMap(page);
  const trace=await timeline(page,npc);
  assertAttack(trace,npc?'resident target':'player target');
  assert.deepEqual((await state(page)).position,{...start,level:0},'incoming hit does not move the observing player');
  assert.deepEqual(await readMap(page),authored);
  assert.deepEqual(await readKit(page),kit);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await exercise(browser,false);await exercise(browser,true);
 console.log('PASS 390px Chromium slime attack: true player and resident wind-up, hop, contact once, land without grid movement, no saved-world edits');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
