import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
// This disposable route accelerates resident scheduling only; every
// collision, path, supply handoff and save uses unmodified gameplay code.
const residentTick='const POI_TOWN_RESIDENT_TICK=380;';
const routine='function poiTownNpcRoutine(a,clock,now,budget){';
assert.equal(html.split(residentTick).length,2);
assert.equal(html.split(routine).length,2);
const observed=html.replace(residentTick,'const POI_TOWN_RESIDENT_TICK=105;').replace(routine,`function poiTownNpcRoutine(a,clock,now,budget){
 const result=__qaNativeRoutine(a,clock,now,budget);
 if(a.role.id==='toolkeeper'){
  const events=window.__qaTobinTrace??=[];
  const current=[a.x,a.z,a.y,a.activity].join(',');
  if(events.at(-1)!==current)events.push(current);
 }
 return result;
}
function __qaNativeRoutine(a,clock,now,budget){`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':observed);
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
async function launch(browser,id='base',start={x:19,z:45},{camera=false,yaw=.24,orbitYaw=0,pitch=.24,townLayout=5,facing=2,kit=null,clockStart=null,fixture='',dist=5.5,level=0,width=390}={}){
 const ctx=await browser.newContext({viewport:{width,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
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
 await page.screenshot({path:out+'/v172-'+label+'.png'});
}
async function noMapMutation(page,map){
 assert.deepEqual(await getMap(page),map,'NPCs, rooms and clock do not write authenticated game layout or tiles');
 await unchanged(page);
}
const action='#poiWalkAction';
const clock=page=>page.evaluate(()=>window.__editorTest.townClock());
const residents=page=>page.evaluate(()=>window.__editorTest.townResidents());
function byId(info,id){return info.actors.find(o=>o.id===id);}
const worldKit='world-workshop-hotbar-v1';
const stock={version:1,weapon:null,potions:3,gold:12,claimedCaches:['glade']};
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z)=>page.evaluate(([x,z])=>window.__editorTest.canStep(x,z),[x,z]);
const speech='#poiTownSpeech';
const dateMinute=12*60;
const talkInfo=page=>page.evaluate(()=>{
 const api=window.__editorTest;return api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
});
async function waitDialogue(page,opened){
 await page.waitForFunction(opened=>{
  const api=window.__editorTest,t=api.townResidents()?.dialogue??api.facility()?.residents?.dialogue??null;
  return Boolean(t)===opened;
 },opened);
 const bubble=page.locator(speech);
 await bubble.waitFor({state:'hidden'});
}
async function worker(page,id){
 await page.waitForFunction(id=>window.__editorTest.townResidents()?.actors.some(x=>x.id===id&&x.activity==='work'),id);
 return byId(await residents(page),id);
}
const morning=9*60+25, menu='#poiNpcMenu';
const choice=(page,id)=>page.locator(menu+' [data-npc-action="'+id+'"]');
const rawSupply=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')||'null')?.toolshopSupply??null);
const trace=page=>page.evaluate(()=>window.__qaTobinTrace||[]);
const first={version:1,stock:3,delivered:0,cargo:1},delivered={version:1,stock:7,delivered:1,cargo:0};
const waitSupply=(page,expected,ms)=>page.waitForFunction(expected=>{
 const actual=JSON.parse(localStorage.getItem('world-workshop-hotbar-v1')||'null')?.toolshopSupply;
 return actual&&Object.entries(expected).every(([k,v])=>actual[k]===v);
},expected,{timeout:ms});
async function run(browser){
 const {ctx,page,errors}=await launch(browser,'base',{x:69,z:35},{width:390,clockStart:morning,facing:1});
 try{
  const original=await getMap(page);
  await worker(page,'toolkeeper');
  assert.equal(await rawSupply(page),null,'no fixture inventory/stock seeded');
  await page.waitForFunction(()=>window.__editorTest.townResidents()?.actors.some(a=>a.id==='toolkeeper'&&a.activity==='supply-pickup'),
   null,{timeout:15000});
  assert.equal(await rawSupply(page),null,'walking toward supplier cannot immediately credit desk stock');
  await waitSupply(page,first,25000);
  const outbound=await trace(page);
  assert(outbound.some(v=>v.startsWith('71,35,0,'))&&outbound.some(v=>v.startsWith('34,61,0,')),
   'Tobin physically walked from staffed desk to Noah delivery tile: '+JSON.stringify(outbound));
  assert(outbound.filter(v=>v.endsWith('supply-pickup')).length>=10,'real path used intermediate tiles');
  assert.deepEqual(await rawSupply(page),first,'even physical pickup only records cargo, not retail stock');
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await rawSupply(page),first,'reload with cargo does not teleport credit');
  await waitSupply(page,delivered,25000);
  const incoming=await trace(page);
  assert(incoming.some(v=>v.startsWith('71,35,0,'))&&incoming.filter(v=>v.endsWith('supply-return')).length>=10,
   'merchant physically returned to old desk before credit: '+JSON.stringify(incoming));
  const clerk=byId(await residents(page),'toolkeeper');
  assert.deepEqual([clerk.x,clerk.z,clerk.y],[71,35,0]);
  await worker(page,'toolkeeper');
  await page.locator(action).tap();
  await page.locator(menu).waitFor({state:'visible'});
  await choice(page,'shop').tap();
  const row=choice(page,'trade:shop-herb');await row.waitFor({state:'visible'});
  assert.match(await row.innerText(),/薬草\s*6\s*G.*[（(]7[）)]/,'fixed shop shows seven legitimately delivered herbs at old 6G');
  if(out)await page.screenshot({path:out+'/v193-returned-retail-stock.png'});
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  await page.waitForTimeout(1700);
  assert.deepEqual(await rawSupply(page),delivered,'same day does not repeat/re-credit delivery after reload');
  assert(!(await trace(page)).some(v=>v.endsWith('supply-pickup')),'no second route for the same day');
  assert.deepEqual(await getMap(page),original);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await run(browser);
 console.log('PASS real scheduled NPC shipment pickup, saved cargo reload, physical delivery once and old 6G retail stock');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
