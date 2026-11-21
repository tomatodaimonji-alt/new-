import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html');
const baseline=process.argv[3]&&readFileSync(process.argv[3]);
const trigger='  spawn={x:19,z:21};';
assert.equal(html.toString().split(trigger).length,2,'temporary QA monster anchor');
const combat=html.toString().replace(trigger,"  put(20,21,'monsterDragon');\n"+trigger);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':req.url.startsWith('/baseline')?baseline:req.url.startsWith('/combat')?combat:html);
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
const mini='#poiMiniHud',party='#poiPartyHud',pad='#poiWalkPad',hpValue='#poiPlayerHpValue';
const bar='#poiHotbar',key='world-workshop-hotbar-v1',ai='#pineAIPlanCapture';
const controls=[pad,'[data-poi-dir=n]','[data-poi-dir=s]','[data-poi-dir=e]','[data-poi-dir=w]','#poiWalkAction'];
const settle=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
const confirmText=async (page,css,want)=>assert.equal((await page.locator(css).textContent()).trim(),want,css);
const snapshot=async (page,name)=>{if(out){await settle(page);await page.screenshot({path:out+'/v127-'+name+'.png'});}};
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
 for(const css of [mini,party,bar])assert.equal(await page.locator(css).isVisible(),false,css+' must not show');
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
const slot=(page,i)=>page.locator(bar+' button[data-hotbar-slot="'+i+'"]');
const store=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),key);
const readHp=page=>page.locator('#poiPlayerHp').evaluate(e=>e.value);
async function hpText(page){
 const current=await readHp(page);
 assert.match(await page.locator(hpValue).textContent(),new RegExp('\\b'+current+'\\s*[/／]\\s*100\\b'),'numeric HP label matches real progress value');
 return current;
}
async function geometry(page,width,height,drawer=false){
 const viewport=await box(page,'#viewWrap');
 const [b,p,d]=await Promise.all([bar,party,pad].map(css=>box(page,css)));
 assert.ok(contained(b,viewport)&&contained(b,{x:0,y:0,width,height}),'six-slot hotbar remains onscreen');
 assert.ok(p.y+p.height<=b.y+1&&b.y+b.height<=d.y+1,'party, hotbar and D-pad ordered separately');
 assert.ok(d.y-(b.y+b.height)<=20,'hotbar immediately above D-pad');
 const slots=page.locator(bar+' button[data-hotbar-slot]');
 assert.equal(await slots.count(),6);
 const dims=await Promise.all(Array.from({length:6},(_,i)=>slot(page,i).boundingBox()));
 assert.ok(dims.every(a=>a&&contained(a,b)&&Math.abs(a.width-dims[0].width)<=1&&Math.abs(a.height-dims[0].height)<=1&&Math.abs(a.y-dims[0].y)<=1),'one row of equal square-ish slots');
 assert.ok(dims[0].width>=40,'small viewport has an enlarged touch target');
 const partyCols=await page.locator(party).evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').map(parseFloat));
 assert.ok(partyCols.length===4&&partyCols.every(v=>Math.abs(v-partyCols[0])<1),'four-ready party row unchanged');
 assert.equal(await page.locator(party+' [data-party-slot]:visible').count(),1);
 for(const [label,rect] of await buttons(page))assert.ok(!intersects(b,rect)&&!intersects(p,rect),'play controls overlap '+label+' at width '+width);
 assert.equal(await page.locator(pad).evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(22, 46, 39, 0.54)','D-pad keeps original semitransparent surface');
 const panels=['header','#poiGameTools','#poiMiniMap','#poiLocationPanel','.poiPartyCard','#poiHotbar [data-hotbar-slot="4"]'];
 if(drawer)panels.push('#poiSoundPanel');
 for(const panel of panels)assert.equal(await page.locator(panel).evaluate(el=>getComputedStyle(el).backgroundColor),
  'rgba(22, 46, 39, 0.54)',panel+' matches the D-pad surface');
 if(drawer)assert.ok(await page.locator('#poiSoundPanel').isVisible());
 return Object.fromEntries(await Promise.all(controls.map(async css=>[css,await box(page,css)])));
}
async function kit(page){
 await page.locator(bar).waitFor({state:'visible'});
 for(const [i,label] of ['素手','木の剣','回復薬'].entries()){
  const target=slot(page,i),name=(await target.getAttribute('aria-label'))??(await target.getAttribute('title'))??'';
  assert.match(name,new RegExp(label));
  assert.ok(await target.locator('.hotbar-icon').isVisible(),'kit slot '+i+' has an icon');
 }
 for(const i of [3,4,5])assert.equal(await slot(page,i).locator('.hotbar-count:visible').count(),0,'empty slots show no item quantity');
}
async function visibleQuantity(page,value){
 const c=slot(page,2).locator('.hotbar-count');
 assert.equal((await c.textContent()).trim(),String(value),'stack quantity display');
}
async function equip(page,label,count){
 await page.waitForFunction(({key,label,count})=>{
  const data=JSON.parse(localStorage.getItem(key));return data?.version===1&&data.weapon===label&&data.potions===count;
 },{key,label,count});
 assert.deepEqual(await store(page),{version:1,weapon:label,potions:count},'only the dedicated loadout writes');
}
async function assertSelected(page,i){
 assert.equal(await slot(page,i).getAttribute('aria-pressed'),'true','weapon slot '+i+' visibly selected');
 assert.equal(await slot(page,1-i).getAttribute('aria-pressed'),'false','other weapon not selected');
}
async function play(page,mobile){
 await press(page,'#enterGameWorld',mobile);
 await page.waitForFunction(()=>window.__editorTest?.facility?.().mode==='play');
}
async function screen(browser,width,height,interactive=false){
 const {page,ctx,mobile,errors}=await initialize(browser,width,height);
 try{
  await noHud(page);
  await play(page,mobile);
  await kit(page);await visibleQuantity(page,3);await assertSelected(page,0);
  assert.equal(await hpText(page),100);
  const actual=await geometry(page,width,height);
  if(baseline){
   const old=await initialize(browser,width,height,'/baseline');
   try{
    await play(old.page,mobile);
    const beforeSlot=await slot(old.page,0).boundingBox(),afterSlot=await slot(page,0).boundingBox();
    assert.ok(afterSlot.width>=beforeSlot.width+3.5,'shortcuts actually enlarged on width '+width);
    for(const css of controls)for(const [k,v] of Object.entries(await box(old.page,css)))
     assert.ok(Math.abs(v-actual[css][k])<=1,'D-pad bounding box changed '+width+' '+css+' '+k);
   }finally{await old.ctx.close();}
  }
  await snapshot(page,width+'-hotbar');
  await press(page,'#poiSoundSettingsToggle',mobile);
  await geometry(page,width,height,true);
  await snapshot(page,width+'-sound-drawer');
  await press(page,'#poiSoundSettingsToggle',mobile);
  if(interactive){
   await press(page,bar+' button[data-hotbar-slot="1"]',mobile);await assertSelected(page,1);
   await equip(page,'equipWoodSword',3);
   await press(page,bar+' button[data-hotbar-slot="2"]',mobile);await assertSelected(page,1);
   await visibleQuantity(page,3);assert.equal(await hpText(page),100,'no consumption when already full');
   for(const k of ['4','5','6'])await page.keyboard.press(k);
   await equip(page,'equipWoodSword',3);
   await page.keyboard.press('1');await equip(page,null,3);await assertSelected(page,0);
   await page.keyboard.press('2');await equip(page,'equipWoodSword',3);await assertSelected(page,1);
   await page.keyboard.press('3');await equip(page,'equipWoodSword',3);
  }
  await press(page,'#pineAIPlayView',mobile);
  await page.locator(ai).waitFor({state:'visible'});await noHud(page);
  const close=page.locator(ai).getByRole('button',{name:'通常画面へ戻る'});
  if(mobile)await close.tap();else await close.click();
  await page.locator(bar).waitFor({state:'visible'});
  await press(page,'#poiWalkToggle',mobile);
  await noHud(page);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function realCombat(browser){
 const {page,ctx,errors}=await initialize(browser,390,844,'/combat',{x:19,z:21});
 try{
  await kit(page);
  await page.keyboard.press('2');await equip(page,'equipWoodSword',3);
  const actor=await page.evaluate(()=>window.__editorTest.facility().combat.actors.find(a=>a.type==='monsterDragon'));
  assert.deepEqual([actor.x,actor.z],[20,21]);
  await page.locator('#poiWalkAction').tap();
  await page.waitForFunction(()=>window.__editorTest.facility().combat.actors.find(a=>a.type==='monsterDragon').hp<150);
  assert.equal(await page.evaluate(()=>window.__editorTest.facility().combat.actors.find(a=>a.type==='monsterDragon').hp),122,'held wooden sword applies its real damage bonus');
  // Stop on the exact HP value after two real dragon hits, then heal before the next attack.
  await page.waitForFunction(()=>document.querySelector('#poiPlayerHp').value===56,{},{polling:50});
  await page.keyboard.press('3');await equip(page,'equipWoodSword',2);
  assert.equal(await hpText(page),86,'one recovery potion adds precisely 30 HP');
  await assertSelected(page,1);await visibleQuantity(page,2);
  await snapshot(page,'390-healed');
  await page.goto(origin+'/?resume=1&test=1');
  await page.locator(bar).waitFor({state:'visible'});
  await assertSelected(page,1);await visibleQuantity(page,2);await equip(page,'equipWoodSword',2);
  assert.equal(await hpText(page),100,'persist kit only, do not persist HP into a new format');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
async function noOtherKit(browser,opts){
 const {page,ctx,errors,mobile}=await initialize(browser,390,844,'/',opts);
 try{
  if(opts.mode!=='adventure')await play(page,mobile);
  await page.locator(party).waitFor({state:'visible'});
  if(await page.locator(bar).isVisible())for(const i of [1,2]){
   assert.equal((await slot(page,i).locator('.hotbar-icon').textContent()).trim(),'','non-Game-World slot stays empty');
   assert.equal(await slot(page,i).getAttribute('aria-disabled'),'true');
  }
  assert.equal(await store(page),null);
  await page.keyboard.press('2');await page.keyboard.press('3');
  assert.equal(await store(page),null,'numbers cannot create Game World storage in other routes');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close();}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [w,h] of [[320,740],[390,844],[1210,800]])await screen(browser,w,h,w===390||w===1210);
 await realCombat(browser);
 await noOtherKit(browser,{id:'lodging'});
 await noOtherKit(browser,{mode:'adventure',x:23,z:24});
 console.log('PASS Playwright: six-slot responsive HUD, real controls/combat/heal, isolated persistent loadout, hidden AI/editor and preserved saves');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
