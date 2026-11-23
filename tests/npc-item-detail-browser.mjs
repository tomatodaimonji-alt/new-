import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';

const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
assert.match(html,/id:'towncook',name:'イネス'/,'named chef belongs to authored schedule');
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixture</title>':html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const out=process.env.FACILITY_SCREENSHOTS;if(out)await mkdir(out,{recursive:true});
const game=page=>page.evaluate(()=>window.__editorTest.facility());
const raw=page=>page.evaluate(k=>localStorage.getItem(k),kitKey);
const talk=page=>page.evaluate(()=>window.__editorTest.townResidents().dialogue);
const cook={x:26,z:41,dir:2,id:'towncook',name:'イネス',at:[26,42],weapon:'equipFryingPan',torso:'armorCookApron',head:'armorCookHat'};
const legacy='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
async function launch(browser,r,kit=null){
 const ctx=await browser.newContext({viewport:{width:390,height:740},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({r,kit,kitKey,resumeKey})=>{
  if(kit!==null)localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1',JSON.stringify({version:1,gameMs:11*60*500}));
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:r.x,z:r.z,y:0,facing:r.dir},townLayout:5,townMapHeight:128,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{r,kit,kitKey,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');
 await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
 assert.deepEqual((await game(page)).position,{x:r.x,z:r.z,level:0});
 return {ctx,page,errors};
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const {ctx,page,errors}=await launch(browser,cook,legacy);
 const npc=page.locator('#poiNpcInventory'),dialog=page.locator('#poiItemDetail');
 await page.waitForFunction(r=>window.__editorTest.townResidents().actors.some(a=>a.id===r.id&&a.activity==='work'&&a.x===r.at[0]&&a.z===r.at[1]),cook);
 await page.waitForFunction(label=>document.querySelector('#poiWalkAction').getAttribute('aria-label')===label,
  'イネス（食堂の料理人）と話す');
 await page.locator('#poiWalkAction').tap();
 await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
 const before=await talk(page);
 assert(before.name.startsWith('イネス'));
 const empty=npc.locator('[data-npc-bag-slot="1"]');
 await empty.tap();
 assert.equal(await dialog.evaluate(d=>d.open),false,'empty space does not open details');
 for(const [selector,name,description,damage,key] of [
  ['[data-npc-item="equipLadle"]','おたま',/耐久：100%/,17],
  ['[data-npc-equipment="equipFryingPan"]','フライパン',/耐久：100%/,26,'Enter'],
  ['[data-npc-equipment="armorCookApron"]','料理人の服',/防御力：.+耐久：100%/,null]
 ]){
  const slot=npc.locator(selector);
  if(key){await slot.focus();await page.keyboard.press(key)}else await slot.tap();
  assert.equal(await dialog.evaluate(d=>d.open),true,name+' opens from NPC inventory');
  assert.equal(await dialog.locator('h2').textContent(),name);
  assert.match(await dialog.locator('#poiItemDetailDescription').textContent(),description);
  const stats=dialog.locator('#poiItemDetailWeaponStats');
  assert.equal(await stats.isVisible(),damage!==null);
  if(damage!==null)assert.equal(await stats.locator('#poiItemDetailAttack').textContent(),String(damage));
  assert.deepEqual(await dialog.locator('button:visible').allTextContents(),['戻る'],'NPC items cannot be used or moved');
  assert(await dialog.locator('#poiItemDetailIcon canvas').isVisible());
  if(out)await page.screenshot({path:out+'/v213-'+name+'.png'});
  if(key)await page.keyboard.press('Escape');else await dialog.getByRole('button',{name:'戻る'}).tap();
  assert.equal(await dialog.evaluate(d=>d.open),false);
  assert(await slot.evaluate(el=>document.activeElement===el),'the original slot regains focus');
 }
 assert.deepEqual(await talk(page),before);
 assert.equal(await raw(page),legacy,'inspection does not write inventory');
 await npc.locator('#poiNpcInventoryClose').tap();
 assert.equal(await npc.isVisible(),false);
 assert.deepEqual(errors,[]);
 await ctx.close();
 console.log('PASS NPC read-only item details, back/focus, and unchanged save in mobile Chromium');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
