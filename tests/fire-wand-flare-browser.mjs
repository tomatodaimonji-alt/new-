import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const a='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';assert.equal(source.split(a).length,2);
let html=source.replace(a,a+`
 wandUiQA:{
  move:(from,to)=>poiInventoryMove(from,to),
  audio:()=>({events:window.__flareEvents??[],state:poiAudioContext?.state,isLive:!!window.__flareSource&&poiAudioTransient.has(window.__flareSource)}),
  view:()=>({
   armed:poiArmedWandIndex(),weapon:poiHotbarRead().weapon,held:window.__wandWorldType,
   mesh:poiWalkMesh?.count??0,charges:poiInventorySlots(poiHotbarRead()).map(c=>c?.charges??null)
  })
 },
`);
const mesh='function poiBuildPlayerMesh(weapon,pose,gear,stride=0,r=0,x=0,y=0,z=0,heading=null,worldSpear=false){';
assert.equal(html.split(mesh).length,2);html=html.replace(mesh,mesh+'if(worldSpear)window.__wandWorldType=weapon;');
const audioStart=' poiAudioTransient.add(source);source.start(when);source.stop(when+(cap??(buffer.duration+.012)));';
assert.equal(html.split(audioStart).length,2);
html=html.replace(audioStart,audioStart+`
 if(buffer===poiRecordedFoleyCache.get('wandFlameLaunch')){
  const data=buffer.getChannelData(0),peak=data.reduce((m,x)=>Math.max(m,Math.abs(x)),0);
  window.__flareSource=source;
  (window.__flareEvents??=[]).push({length:buffer.length,duration:buffer.duration,rate:buffer.sampleRate,channels:buffer.numberOfChannels,
   loop:source.loop,cap,volume,peak});
 }
`);
for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(m[1]);
if(process.env.WAND_UI_LAYOUT_ONLY==='1'){console.log('wand cursor browser fixture parses exact source');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<title>temporary QA</title>':html)});
await new Promise((y,n)=>server.listen(0,'127.0.0.1',y).once('error',n));
const origin='http://127.0.0.1:'+server.address().port;let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await(await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.75})).newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[4]={type:'fireWand',count:1,charges:1};slots[6]={type:'fireWand',count:1,charges:2};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,gold:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:91,y:0,facing:0},
   townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.wandUiQA);
 const view=()=>page.evaluate(()=>window.__editorTest.wandUiQA.view());
 const button=i=>page.locator('#poiHotbar [data-hotbar-slot="'+i+'"]');
 const selected=async(slot)=>assert.deepEqual(await page.locator('#poiHotbar [aria-pressed="true"]').evaluateAll(xs=>xs.map(x=>x.dataset.hotbarSlot)),slot===null?[]:[String(slot)]);
 await selected(0);assert.equal((await view()).held,'equipWoodSword');
 await button(4).tap();await selected(4);let q=await view();
 assert(q.mesh>0);assert.equal(q.armed,4);assert.equal(q.held,'fireWand');assert.equal(q.weapon,'equipWoodSword');
 await button(6).tap();await selected(6);q=await view();assert.equal(q.armed,6);assert.equal(q.held,'fireWand');
 assert((await page.evaluate(()=>window.__editorTest.wandUiQA.move(6,{zone:'hotbar',index:5}))).ok);
 await selected(5);q=await view();assert.equal(q.armed,5);assert.equal(q.charges[5],2);assert.equal(q.charges[4],1);
 assert((await page.evaluate(()=>window.__editorTest.wandUiQA.move(5,{zone:'bag',index:0}))).ok);
 await selected(null);q=await view();assert.equal(q.armed,9);assert.equal(q.held,'fireWand');
 await button(4).tap();await selected(4);
 const events=()=>page.evaluate(()=>window.__editorTest.wandUiQA.audio());
 assert.equal((await events()).events.length,0);
 await page.locator('#poiWalkAction').tap();await selected(0);
 await page.waitForFunction(()=>window.__editorTest.wandUiQA.audio().events.length===1);
 const audio=await events(),e=audio.events[0];assert.equal(audio.state,'running');
 assert.deepEqual([e.rate,e.length,e.channels,e.loop,e.cap,e.volume],[24000,4128,1,false,null,.52]);
 assert(Math.abs(e.duration-.172)<1e-6&&e.peak<=.461);
 await page.waitForFunction(()=>!window.__editorTest.wandUiQA.audio().isLive);
 assert.equal((await events()).events.length,1);
 q=await view();assert.equal(q.armed,null);assert.equal(q.charges[4],null);assert.equal(q.charges[9],2);
 await page.waitForFunction(()=>window.__editorTest.wandUiQA.view().held==='equipWoodSword');
 await button(0).tap();await selected(0);
 assert.deepEqual(errors,[]);
 console.log('Native Fire Wand physical cast, one real 172-ms no-loop audio buffer, ended source cleanup and exactly one charge.');
}finally{await browser?.close();await new Promise(y=>server.close(y))}
