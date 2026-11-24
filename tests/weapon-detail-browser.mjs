import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const anchor='  freeMovementPose:()=>';
assert.equal(html.split(anchor).length,2);
const fixture=html.replace(anchor,`  weaponDetailQA:type=>({damage:poiPlayerAttackDamage(type),grades:poiPlayerWeaponGrades(type)}),\n`+anchor);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':fixture)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const ctx=await browser.newContext({viewport:{width:568,height:320},isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12}');
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:26,z:41,y:0,facing:2},townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,
    top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 const detail=page.locator('#poiItemDetail'),stats=detail.locator('#poiItemDetailWeaponStats');
 const back=detail.locator('[data-item-detail-action="back"]');
 const slot=i=>'#poiHotbar [data-hotbar-slot="'+i+'"]';
 const cd=await ctx.newCDPSession(page);
 async function hold(where){
  const b=await page.locator(where).boundingBox();assert(b);
  const finger={x:Math.round(b.x+b.width/2),y:Math.round(b.y+b.height/2),id:1};
  await cd.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});
  await detail.waitFor({state:'visible'});
  await cd.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }
 await page.evaluate(()=>{
  window.__weaponDetailEvents=[];
  for(const type of ['pointerdown','pointerup','pointercancel','click','close']){
   document.addEventListener(type,e=>{
    const el=e.target;window.__weaponDetailEvents.push({type,id:el?.id,action:el?.dataset?.itemDetailAction,detail:e.detail,
     px:e.clientX,py:e.clientY,open:document.querySelector('#poiItemDetail')?.open});
   },true)
  }
 });
 async function rows(type,name){
  await stats.waitFor({state:'visible'}).catch(async cause=>{throw Error('Detail not visible: '+JSON.stringify(await page.evaluate(()=>window.__weaponDetailEvents.slice(-18))),{cause})});
  assert.equal(await detail.locator('#poiItemDetailName').innerText(),name);
  const desc=await detail.locator('#poiItemDetailDescription').innerText();
  assert(desc.trim().length>=5);assert.doesNotMatch(desc,/攻撃力：/);
  const v=await page.evaluate(type=>window.__editorTest.weaponDetailQA(type),type);
  const stars=n=>'★'.repeat(n)+'☆'.repeat(5-n);
  assert.equal(await stats.locator('#poiItemDetailAttack').innerText(),String(v.damage));
  assert.equal(await stats.locator('#poiItemDetailWeaponSpeed').innerText(),stars(v.grades.speed));
  assert.equal(await stats.locator('#poiItemDetailWeaponReach').innerText(),stars(v.grades.reach));
  assert.match(await stats.locator('#poiItemDetailSpeedAnnounce').textContent(),new RegExp('5段階中'+v.grades.speed));
  assert.deepEqual(await stats.locator('dt').allTextContents(),['攻撃力','速度','リーチ']);
  const boxes=await stats.locator('dt').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().top));
  assert(boxes[0]+8<boxes[1]&&boxes[1]+8<boxes[2],'real separate statistic rows');
 }
 const before=await page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1'));
 await hold(slot(0));await rows('equipWoodSword','木の剣');await back.tap();
 await hold(slot(1));assert.equal(await detail.locator('#poiItemDetailName').innerText(),'薬草');
 assert.equal(await stats.isVisible(),false);await back.tap();

 await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='イネス（食堂の料理人）と話す');
 await page.locator('#poiWalkAction').tap();await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
 const npc=page.locator('#poiNpcInventory');
 await npc.locator('[data-npc-item="equipLadle"]').tap();
 await rows('equipLadle','おたま');
 assert.deepEqual(await detail.locator('[data-item-detail-action]:visible').evaluateAll(nodes=>nodes.map(el=>el.dataset.itemDetailAction)),['back']);
 await back.tap();assert(await npc.isVisible(),'NPC view remains in place behind read-only detail');
 assert.equal(await page.evaluate(()=>localStorage.getItem('world-workshop-hotbar-v1')),before);
 assert.deepEqual(errors,[]);
 await cd.detach();await ctx.close();
 console.log('PASS actual hotbar and read-only NPC weapons show three canonical rows, consumables do not, and storage is unchanged');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}

