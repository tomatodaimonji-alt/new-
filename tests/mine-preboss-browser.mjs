import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {mkdir} from 'node:fs/promises';
import vm from 'node:vm';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const begin=html.indexOf('const FACILITY_SITES=Object.freeze('),end=html.indexOf('function workshopResumeDecode(',begin);
assert(begin>=0&&end>begin);
const site=vm.runInNewContext(html.slice(begin,end)+";buildFacilitySite('base')");
const p=site.mine?.preBossSupply;
assert(p?.id==='mine-preboss-mace'&&p.x===94&&p.z===62&&p.y===-1&&p.type==='equipStoneMace'&&p.durability===100,
 'v206 exact western mine reward must exist');
const track=[[97,61,'ArrowLeft'],[96,61,'ArrowLeft'],[95,61,'ArrowLeft'],[94,61,'ArrowLeft'],[94,62,'ArrowDown']];
for(const [x,z] of [[98,61],...track]){
 const c=site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===-1);
 assert(c.some(o=>/^(?:stone|moss|road\w+)$/.test(o.type))&&
  c.every(o=>/^(?:stone|moss|road\w+|ruinDoorBroken)$/.test(o.type)),'real dry clear authored mine approach '+[x,z]);
}
if(process.env.MINE_PREBOSS_LAYOUT_ONLY==='1'){
 console.log('PASS exact v206 western mine, stone pedestal and authored dry approach');
 process.exit(0);
}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const fixtures={
 [kitKey]:'{"version":1,"weapon":"equipWoodSword","potions":0,"gold":12,"claimedCaches":["glade"]}',
 'forest-world-editor-v1':'{"format":"forest-world-v1","version":1,"width":30,"height":30,"size":30,"world":[{"x":2,"y":0,"z":2,"type":"stonewall","rot":1}],"models":[],"prefabs":[],"terrainHeights":[],"checks":[]}',
 'world-workshop-audio-v2':'{"master":70,"bgm":40,"se":50,"enabled":true}'
};
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const api=page=>page.evaluate(()=>window.__editorTest.facility());
const map=page=>page.evaluate(()=>window.__editorTest.data());
const stock=page=>page.evaluate(key=>localStorage.getItem(key),kitKey);
const pos=(x,z,level=-1)=>({x,z,level});
const active=page=>page.waitForFunction(()=>window.__editorTest?.facility?.().active);
async function launch(browser,start){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await ctx.addInitScript(()=>{
  const P=AudioBufferSourceNode.prototype,start=P.start;
  window.__mineFoley=[];
  P.start=function(){
   if(this.buffer&&Math.abs(this.buffer.duration-.148)<.002)
    window.__mineFoley.push({duration:this.buffer.duration,rate:this.buffer.sampleRate,context:this.context.state});
   return start.apply(this,arguments);
  };
 });
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,start})=>{
  for(const [k,v] of Object.entries(fixtures))localStorage.setItem(k,v);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:10*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:start.x,z:start.z,y:start.level,facing:0},townLayout:5,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:start.level,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{fixtures,resumeKey,start});
 await page.goto(origin+'/?resume=1&test=1');
 await active(page);
 assert.deepEqual((await api(page)).position,start);
 return {ctx,page,errors};
}
async function waitPosition(page,x,z,level=-1){
 await page.waitForFunction(([x,z,level])=>{
  const p=window.__editorTest.facility().position;return p.x===x&&p.z===z&&p.level===level;
 },[x,z,level],{timeout:5000});
}
const maceId='mine-preboss-mace',type='equipStoneMace',start=pos(98,61),hunt=pos(94,62);
const action='#poiWalkAction';
const inv=state=>[...state.inventory.hotbar,...state.inventory.bag].filter(i=>i?.type===type);
async function walk(page,list){
 for(const [x,z,d] of list){
  await page.keyboard.press(d);
  try{await waitPosition(page,x,z)}
  catch(e){throw new Error('Native mine step '+[x,z]+' stopped at '+JSON.stringify((await api(page)).position),{cause:e})}
  await page.waitForTimeout(211);
 }
}
async function gateStillLocked(page){
 assert.equal(await page.evaluate(()=>window.__editorTest.canStep(121,47,121,48)),false,'original treasure gate is still physically blocked');
 const s=await api(page),k=JSON.parse(await stock(page));
 assert.equal(s.mineVault.gateOpen,false);
 assert.equal(k.mineGateCleared,undefined);assert.equal(k.mineTreasureChest,undefined);assert.equal(k.quests,undefined);
 assert(s.combat.actors.some(a=>a.type==='monsterMineGuard'&&a.hp===140&&a.visible),'old elite remains alive and unchanged');
}
async function trial(browser){
 const {ctx,page,errors}=await launch(browser,start);
 try{
  const mapBefore=await map(page),url=page.url();
  const s=await api(page);
  assert.equal(s.sceneLayer,'cellar');assert.equal(s.miniMap.location,'廃坑');
  assert.equal(inv(s).length,0);assert.equal(JSON.parse(await stock(page)).mineFindClaims,undefined);
  assert(s.mineVault.sideFinds.some(d=>d.id===maceId));
  await gateStillLocked(page);
  await page.locator(action).tap(); // trusted user audio activation; no target in this pocket
  await walk(page,track);
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('world-workshop-hotbar-v1'))?.mineFindClaims?.includes(id),maceId);
  await page.waitForFunction(()=>window.__mineFoley?.some(b=>b.context==='running'&&b.rate===24000),null,{timeout:8000});
  assert.equal((await api(page)).musicZone,'mine');
  assert.deepEqual(inv(await api(page)),[{type,count:1,durability:100}],'native step picks up one prepared 100-condition stone mace');
  assert(!(await api(page)).mineVault.sideFinds.some(d=>d.id===maceId),'claimed world item is removed');
  const taken=await stock(page);
  if(out)await page.screenshot({path:out+'/v206-mine-mace-workroom.png'});
  await walk(page,[[94,61,'ArrowUp'],[95,61,'ArrowRight']]);
  await page.reload();await active(page);
  assert.deepEqual((await api(page)).position,pos(95,61));
  assert.equal(await stock(page),taken);
  await walk(page,track.slice(3));
  assert.deepEqual((await api(page)).position,hunt);
  assert.equal(await stock(page),taken,'native revisit cannot mint duplicate mace');
  assert.equal(inv(await api(page)).length,1);
  await gateStillLocked(page);
  await walk(page,[[94,61,'ArrowUp'],[95,61,'ArrowRight'],[96,61,'ArrowRight'],[97,61,'ArrowRight'],[98,61,'ArrowRight']]);
  assert.deepEqual((await api(page)).position,start);
  assert.equal(page.url(),url);assert.deepEqual(await map(page),mapBefore);
  for(const [k,v] of Object.entries(fixtures))if(k!==kitKey)assert.equal(await page.evaluate(key=>localStorage.getItem(key),k),v);
  assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await trial(browser);
 console.log('PASS native mine approach, actual mica-room mace, footsteps and durable locked vault');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
