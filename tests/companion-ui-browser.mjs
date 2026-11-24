import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const a='  freeMovementPose:()=>({x:poiWalkViewX,z:poiWalkViewZ,level:poiWalkLevel}),';assert.equal(source.split(a).length,2);
const html=source.replace(a,a+`
 companionUiQA:{
  inventoryToBag:()=>poiInventoryMove(4,{zone:'bag',index:0}),
  view:()=>{
   const k=poiHotbarRead(),cells=poiInventorySlots(k),s=poiCompanionSnapshot(performance.now());
   return {hp:s.hp,weapon:k.weapon,active:s.active,mode:s.mode,actor:!!s.actor,cell:cells.findIndex(c=>c?.type==='slimeSoul')};
  }
 },
`);
for(const m of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(m[1]);
if(process.env.COMPANION_UI_LAYOUT_ONLY==='1'){console.log('companion UI browser fixture parses exact source');process.exit(0)}
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
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:90};slots[4]={type:'slimeSoul',count:1,durability:17};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,gold:0,slots}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:24,z:91,y:0,facing:0},
   townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.companionUiQA);
 const view=()=>page.evaluate(()=>window.__editorTest.companionUiQA.view());
 const soul=page.locator('#poiHotbar [data-hotbar-slot="4"]'),blade=page.locator('#poiHotbar [data-hotbar-slot="0"]');
 const menu=page.locator('#poiCompanionCommands'),ally=page.locator('#poiCompanionHud'),player=page.locator('[data-party-slot="0"]');
 const selected=async(slot)=>assert.deepEqual(await page.locator('#poiHotbar [aria-pressed="true"]').evaluateAll(xs=>xs.map(x=>x.dataset.hotbarSlot)),[String(slot)]);
 async function thumbnail(locator){
  const art=locator.locator('canvas[data-item-model="monsterSlime"]');
  await art.waitFor({state:'visible'});
  assert(await art.evaluate(cv=>{
   const p=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
   let blue=0;for(let i=0;i<p.length;i+=4)if(p[i+3]>90&&p[i+2]>p[i]+15&&p[i+2]>=p[i+1])blue++;
   return blue>60;
  }),'real drawn blue mesh pixels, not fallback glyph');
 }
 await thumbnail(soul);await selected(0);
 await soul.tap();await ally.waitFor({state:'visible'});assert(!await menu.isVisible(),'first tap summons');
 await selected(4);
 const ap=await ally.boundingBox(),pp=await player.boundingBox();assert(Math.abs(ap.x-pp.x)<1&&ap.y>=pp.y+pp.height,'ally directly below player');
 assert.equal(await page.locator('#poiCompanionHudHpValue').textContent(),'17/36');
 assert.equal((await view()).weapon,'equipWoodSword');
 await soul.tap();await menu.waitFor({state:'visible'});
 assert.deepEqual(await menu.locator('button').allTextContents(),['戦う','逃げる','魂に戻す','戻る']);
 await menu.getByRole('button',{name:'戻る',exact:true}).tap();assert((await view()).active);
 await soul.tap();await menu.getByRole('button',{name:'戦う'}).tap();assert.equal((await view()).mode,'fight');
 await soul.tap();await menu.getByRole('button',{name:'逃げる'}).tap();assert.equal((await view()).mode,'flee');
 assert.equal((await view()).hp,17);
 await blade.tap();await selected(0);await soul.tap();assert(!await menu.isVisible(),'first tap after selecting weapon only moves cursor');
 await soul.tap();await menu.getByRole('button',{name:'魂に戻す'}).tap();
 await ally.waitFor({state:'hidden'});assert(!(await view()).active);assert.equal((await view()).hp,17);await selected(0);
 assert((await page.evaluate(()=>window.__editorTest.companionUiQA.inventoryToBag())).ok);
 await page.locator('#poiBagToggle').tap();
 await thumbnail(page.locator('#poiBagSlots [data-bag-slot="0"]'));
 assert.equal((await view()).cell,9);
 assert.deepEqual(errors,[]);
 console.log('Native soul mesh in hotbar and inventory; selectable shortcut; HUD under player; commands preserve HP and weapon.');
}finally{await browser?.close();await new Promise(y=>server.close(y))}
