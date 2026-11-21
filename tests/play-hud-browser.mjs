import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=process.argv[3]&&readFileSync(process.argv[3]);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?baseline:html);
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
const mini='#poiMiniHud',party='#poiPartyHud',pad='#poiWalkPad',health='#poiPlayerHp';
const ai='#pineAIPlanCapture',safe='☆☆☆☆☆',outside='★☆☆☆☆';
const controls=[pad,'[data-poi-dir=n]','[data-poi-dir=s]','[data-poi-dir=e]','[data-poi-dir=w]','#poiWalkAction'];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const confirmText=async (page,css,want)=>assert.equal((await page.locator(css).textContent()).trim(),want,css);
const snapshot=async (page,name)=>{if(out){await settle(page);await page.screenshot({path:out+'/v123-'+name+'.png'});}};
async function initialize(browser,width,height,prefix='/',opts={}){
 const mobile=width<800,ctx=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 const page=await ctx.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(12000);
 const {id='base',mode='facility',x,z,y=0,legacy}=opts;
 await page.goto(origin+'/seed');
 await page.evaluate(({fixtures,resumeKey,id,mode,x,z,y,legacy})=>{
  Object.entries(fixtures).forEach(([k,v])=>localStorage.setItem(k,v));
  if(legacy)localStorage.setItem('world-workshop-adventure-v1',JSON.stringify(legacy));
  if(Number.isInteger(x))localStorage.setItem(resumeKey,JSON.stringify({version:1,route:mode,id,play:true,position:{x,z,y,facing:1}}));
 },{fixtures,resumeKey,id,mode,x,z,y,legacy});
 const query=Number.isInteger(x)?'?resume=1&test=1':'?facility='+id+'&test=1';
 await page.goto(origin+prefix+query);
 if(mode==='facility')await page.waitForFunction(id=>window.__editorTest?.facility?.().id===id,id);
 else await page.locator('#poiWalkPad.active').waitFor({state:'visible'});
 await settle(page);
 return {page,ctx,errors,mobile};
}
async function press(page,css,mobile){
 const loc=page.locator(css);
 if(mobile)await loc.tap();else await loc.click();
}
async function noHud(page){
 for(const css of [mini,party,'#poiCombatHud','#poiWalkCoords'])assert.equal(await page.locator(css).isVisible(),false,css+' must not show');
}
async function box(page,css){
 const rect=await page.locator(css).boundingBox();assert.ok(rect,css+' visible with measurable dimensions');return rect;
}
const intersects=(a,b)=>a.x<b.x+b.width-.5&&a.x+a.width>b.x+.5&&a.y<b.y+b.height-.5&&a.y+a.height>b.y+.5;
const contained=(a,b)=>a.x>=b.x-1&&a.y>=b.y-1&&a.x+a.width<=b.x+b.width+1&&a.y+a.height<=b.y+b.height+1;
async function buttons(page){
 const elements=page.locator('#poiGameTools button:visible, #quickTools button:visible, #poiSoundPanel:visible');
 const rects=[];
 for(const el of await elements.all()){
  const r=await el.boundingBox();if(r)rects.push([await el.getAttribute('id'),r]);
 }
 return rects;
}
async function geometry(page,width,height,duringDrawer=false){
 const [viewport,radar,left,walk,name,stars]=await Promise.all(['#viewWrap','#poiMiniMap',party,pad,'#poiLocationName','#poiLocationStars'].map(css=>box(page,css)));
 const minimapOuter=await box(page,mini);
 for(const [label,rect] of [['minimap',minimapOuter],['party',left],['D-pad',walk]])
  assert.ok(contained(rect,viewport)&&contained(rect,{x:0,y:0,width,height}),label+' stays onscreen');
 assert.ok(minimapOuter.x<=viewport.x+15&&minimapOuter.y<=viewport.y+32,'radar touches upper left margin');
 assert.ok(left.x<=viewport.x+viewport.width*.16&&left.x<walk.x+8&&radar.width>=70&&radar.width<=132,'left-aligned player and compact square radar');
 assert.ok(Math.abs(radar.width-radar.height)<=1,'radar is square');
 assert.ok(name.y>=radar.y+radar.height-1&&stars.y>=name.y,'location text and difficulty sit below the radar');
 const locationBox=await box(page,'#poiLocationPanel');
 assert.ok(contained(name,locationBox)&&contained(stars,locationBox)&&name.x+name.width<=stars.x+1&&
  Math.abs((name.y+name.height/2)-(stars.y+stars.height/2))<=4,'location name and all stars fit side by side');
 assert.ok(walk.y-(left.y+left.height)>=-1&&walk.y-(left.y+left.height)<=20,'HP panel is immediately above unchanged D-pad');
 assert.ok(!intersects(minimapOuter,left)&&!intersects(minimapOuter,walk),'mini/party/pad do not overlap');
 for(const [label,rect] of await buttons(page)){
  assert.ok(!intersects(minimapOuter,rect),'minimap obscures '+label+' at width '+width);
  assert.ok(!intersects(left,rect),'party panel obscures '+label+' at width '+width);
 }
 const grid=await page.locator(party).evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
 assert.equal(grid.length,4,'four equal slot columns even with one player');
 assert.ok(grid[0]>0&&grid.every(v=>Math.abs(v-grid[0])<1),'party grid equal columns');
 const active=page.locator(party+' [data-party-slot]:visible');
 assert.equal(await active.count(),1,'only the current player occupies a visible party slot');
 assert.equal(await active.first().getAttribute('data-party-slot'),'0');
 const activeBox=await active.first().boundingBox();
 assert.ok(activeBox&&Math.abs(activeBox.x-left.x)<2&&activeBox.width<=grid[0]+2,'single player never expands beyond one quarter');
 assert.equal(await page.locator('#poiCombatHud').isVisible(),false,'old HP/attack status stays absent');
 assert.equal(await page.locator('#poiWalkCoords').isVisible(),false,'old upper status stays absent');
 if(duringDrawer)assert.ok(await page.locator('#poiSoundPanel').isVisible());
 return Object.fromEntries(await Promise.all(controls.map(async css=>[css,await box(page,css)])));
}
async function location(page,name,stars=safe){
 await confirmText(page,'#poiLocationName',name);
 await confirmText(page,'#poiLocationStars',stars);
 assert.deepEqual(await page.locator('#poiMiniMap').evaluate(c=>[c.width,c.height]),[144,144]);
}
async function verifyViewport(browser,width,height){
 const {page,ctx,mobile,errors}=await initialize(browser,width,height);
 try{
  await noHud(page);
  await press(page,'#enterGameWorld',mobile);
  await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
  await page.locator(mini).waitFor({state:'visible'});
  await location(page,'拠点');
  const old=baseline&&await initialize(browser,width,height,'/baseline');
  let expected;
  if(old){
   try{
    await press(old.page,'#enterGameWorld',mobile);
    await old.page.locator(pad).waitFor({state:'visible'});
    expected=Object.fromEntries(await Promise.all(controls.map(async css=>[css,await box(old.page,css)])));
   }finally{await old.ctx.close();}
  }
  const actual=await geometry(page,width,height);
  if(expected)for(const css of controls)for(const k of ['x','y','width','height'])
   assert.ok(Math.abs(actual[css][k]-expected[css][k])<=1,'D-pad geometry changed '+width+' '+css+' '+k);
  const player=page.locator(party+' [data-party-slot="0"]');
  assert.match(await player.textContent(),/プレイヤー/,'panel shows player name');
  await page.locator(health).waitFor({state:'visible'});
  assert.equal(await hp(page),100,'base starts with full real HP');
  await snapshot(page,width+'-play');
  await press(page,'#poiSoundSettingsToggle',mobile);
  await geometry(page,width,height,true);
  await snapshot(page,width+'-audio-drawer');
  await press(page,'#poiSoundSettingsToggle',mobile);
  await press(page,'#pineAIPlayView',mobile);
  await page.locator(ai).waitFor({state:'visible'});
  await noHud(page);
  const closeAI=page.locator(ai).getByRole('button',{name:'通常画面へ戻る'});
  if(mobile)await closeAI.tap();else await closeAI.click();
  await page.locator(mini).waitFor({state:'visible'});
  await location(page,'拠点');
  await press(page,'#poiWalkToggle',mobile);
  await noHud(page);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function hp(page){
 return page.locator(health).evaluate(el=>{
  const n=el.getAttribute('aria-valuenow');
  if(n!==null)return Number(n);
  const v=el.value??el.textContent.trim().match(/\d+/)?.[0];
  return Number(v);
 });
}
async function townBoundary(browser){
 const width=390,height=844;
 const {page,ctx,errors}=await initialize(browser,width,height,'/',{x:19,z:46});
 try{
  await page.locator(mini).waitFor({state:'visible'});
  await location(page,'拠点');
  const radar=page.locator('#poiMiniMap');
  const before=await radar.evaluate(c=>c.toDataURL());
  const a=(await state(page)).miniMap;
  assert.deepEqual([a.x,a.z,a.level],[19,46,0],'map marker follows real coordinates before step');
  await press(page,'[data-poi-dir=s]',true);
  await page.waitForFunction(()=>window.__editorTest.facility().position.z===47);
  await settle(page);
  await location(page,'外',outside);
  const b=(await state(page)).miniMap;
  assert.deepEqual([b.x,b.z,b.level,b.facing],[19,47,0,2],'marker moves by one tile south with correct heading');
  assert.equal(b.topologyBuilds,a.topologyBuilds,'ordinary movement should not rebuild terrain overview');
  assert.notEqual(await radar.evaluate(c=>c.toDataURL()),before,'canvas really repaints after the player moves');
 const color=await radar.evaluate(c=>{
  const scale=Math.min((c.width-10)/96,(c.height-16)/56);
  const x=(c.width-96*scale)/2+19.5*scale,z=(c.height-56*scale)/2+3+47.5*scale;
  return Array.from(c.getContext('2d').getImageData(Math.floor(x),Math.floor(z),1,1).data);
 });
 assert.deepEqual(color,[255,222,127,255],'actual gold player marker painted at the mapped game tile');
  await snapshot(page,'390-outside');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function legacyHp(browser){
 const legacy={version:1,x:24,z:24,hp:72,monsters:[{x:24,z:25,hp:35}]};
 const {page,ctx,errors}=await initialize(browser,390,844,'/',{mode:'adventure',x:24,z:24,legacy});
 try{
  await page.locator(health).waitFor({state:'visible'});
  const initial=await hp(page);
  assert.ok(initial>0&&initial<=72,'HUD reads seeded real adventure HP and not a made-up full bar');
  await page.waitForFunction(({health,initial})=>{
   const el=document.querySelector(health);
   const n=Number(el?.getAttribute('aria-valuenow')??el?.value??el?.textContent.trim().match(/\d+/)?.[0]);
   return n>0&&n<initial;
  },{health,initial});
  await snapshot(page,'390-real-monster-hp');
  const expected={...fixtures,'world-workshop-adventure-v1':JSON.stringify(legacy)};
  const raw=await page.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(expected));
  assert.deepEqual(raw,expected,'passive legacy resume and HUD do not write protected saved state');
  assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [w,h] of [[320,740],[390,844],[845,850],[1210,800]])await verifyViewport(browser,w,h);
 await townBoundary(browser);
 const lodging=await initialize(browser,390,844,'/',{id:'lodging',x:13,z:10});
 try{
  const p=lodging.page;
  await p.locator(mini).waitFor({state:'visible'});
  await location(p,'宿舎');
  assert.equal((await state(p)).miniMap.level,0);
  await press(p,'[data-poi-dir=n]',true);
  await p.waitForFunction(()=>window.__editorTest.facility().miniMap?.level===1);
  await location(p,'宿舎');
  assert.deepEqual((await state(p)).position,{x:13,z:9,level:1});
  await snapshot(p,'390-lodging-2f');
  await unchanged(p);assert.deepEqual(lodging.errors,[]);
 }finally{await lodging.ctx.close();}
 await legacyHp(browser);
 console.log('PASS responsive play-only radar/player HUD, no overlap, unchanged D-pad, live marker/location/difficulty and HP, and original saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
