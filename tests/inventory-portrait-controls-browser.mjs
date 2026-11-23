import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const hook='function poiNpcInventorySync(actor=null){';
assert.equal(html.split(hook).length,2);
const fixture=html.replace(hook,`window.__portraitRefreshFixture=(hp=0)=>{
 const a=poiTownDialogue?.actor;if(!a)return false;
 a.hp+=hp;poiNpcInventorySync(a);return true;
};
`+hook);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(req.url==='/seed'?'<!doctype html><title>Isolated portrait controls</title>':fixture);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const origin='http://127.0.0.1:'+server.address().port;
const cook={x:26,z:41,y:0,facing:2};
const kitKey='world-workshop-hotbar-v1',resumeKey='world-workshop-resume-v1';
const kit='{"version":1,"weapon":"equipWoodSword","potions":3,"gold":12,"claimedCaches":["glade"]}';
async function launch(browser,width,height){
 const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 await context.addInitScript(()=>{
  window.__portraitPaints={poiAvatarPreview:0,poiNpcPortrait:0};
  const put=CanvasRenderingContext2D.prototype.putImageData;
  CanvasRenderingContext2D.prototype.putImageData=function(...args){
   if(Object.hasOwn(window.__portraitPaints,this.canvas.id))window.__portraitPaints[this.canvas.id]++;
   return put.apply(this,args);
  };
 });
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.goto(origin+'/seed');
 await page.evaluate(({cook,kitKey,kit,resumeKey})=>{
  localStorage.setItem(kitKey,kit);
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem(resumeKey,JSON.stringify({version:1,route:'facility',id:'base',play:true,
    position:cook,townLayout:5,townMapHeight:128,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,
      hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },{cook,kitKey,kit,resumeKey});
 await page.goto(origin+'/?resume=1&test=1');await page.waitForFunction(()=>window.__editorTest?.facility?.()?.active);
 const session=await context.newCDPSession(page);
 return {context,page,errors,send:(type,touchPoints)=>session.send('Input.dispatchTouchEvent',{type,touchPoints})};
}
async function pixels(canvas){
 return canvas.evaluate(el=>{
  const image=el.getContext('2d').getImageData(0,0,el.width,el.height).data;
  let hash=2166136261,area=0;
  for(let i=0;i<image.length;i++){hash=Math.imul(hash^image[i],16777619);if(i%4===3&&image[i]>125)area++}
  return {hash,area};
 });
}
const nPaint=(page,id)=>page.evaluate(id=>window.__portraitPaints[id],id);
const freshPaint=(page,id,before)=>page.waitForFunction(({id,before})=>window.__portraitPaints[id]>before,{id,before});
const game=page=>page.evaluate(resumeKey=>{
 const f=window.__editorTest.facility(),saved=JSON.parse(localStorage.getItem(resumeKey));
 return {position:f.position,attack:f.combat.actionAt,view:saved.view};
},resumeKey);
function within(rect,x,y,id=1){return {x:Math.round(rect.x+rect.width*x),y:Math.round(rect.y+rect.height*y),id,radiusX:4,radiusY:4,force:.65}}
async function openNpc(page){
 await page.waitForFunction(()=>document.querySelector('#poiWalkAction')?.getAttribute('aria-label')==='住人と話す');
 await page.locator('#poiWalkAction').tap();
 await page.locator('#poiNpcMenu [data-npc-action="status"]').tap();
 const portrait=page.locator('#poiNpcPortrait');await portrait.waitFor();return portrait;
}
let browser;
try{
 browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const npc=await launch(browser,844,390);
 try{
  const {page,send}=npc,base=await game(page),portrait=await openNpc(page),id='poiNpcPortrait';
  const original=await pixels(portrait),box=await portrait.boundingBox(),n=await nPaint(page,id);
  assert(original.area>150&&n===1&&box?.width>50);
  await portrait.evaluate(el=>{window.__stablePortrait=el});
  await send('touchStart',[within(box,.28,.55)]);
  await send('touchMove',[within(box,.65,.56)]);
  assert(await page.evaluate(()=>window.__portraitRefreshFixture(-3)),'force real routine sync during a held drag');
  assert(await portrait.evaluate(el=>el===window.__stablePortrait),'same canvas remains attached during NPC health update');
  assert.match(await page.locator('#poiNpcStatus [data-npc-stat="hp"]').textContent(),/97\/100/);
  await send('touchMove',[within(box,.83,.56)]);
  await send('touchEnd',[]);
  await freshPaint(page,id,n);
  let turned=await pixels(portrait);
  assert.notEqual(turned.hash,original.hash,'touch drag rotates rendered model pixels');
  assert(turned.area>100);
  let last=await nPaint(page,id);
  await send('touchStart',[within(box,.40,.49)]);
  await send('touchStart',[within(box,.40,.49),within(box,.60,.49,2)]);
  await send('touchMove',[within(box,.27,.49),within(box,.73,.49,2)]);
  await send('touchEnd',[]);
  await freshPaint(page,id,last);
  await page.waitForTimeout(95);
  const enlarged=await pixels(portrait);
  assert(enlarged.area>turned.area*1.2,'native pinch out enlarges the mesh');
  last=await nPaint(page,id);
  await send('touchStart',[within(box,.27,.49)]);
  await send('touchStart',[within(box,.27,.49),within(box,.73,.49,2)]);
  await send('touchMove',[within(box,.46,.49),within(box,.54,.49,2)]);
  await send('touchEnd',[]);
  await freshPaint(page,id,last);
  await page.waitForTimeout(95);
  assert((await pixels(portrait)).area<turned.area*.8,'native pinch in zooms out');
  const idle=await nPaint(page,id),shown=await pixels(portrait);
  for(let i=0;i<4;i++)assert(await page.evaluate(()=>window.__portraitRefreshFixture()));
  await page.waitForTimeout(420);
  assert.equal(await nPaint(page,id),idle,'idle and unchanged NPC refresh do not repaint');
  assert.deepEqual(await pixels(portrait),shown);
  const ladle=page.locator('#poiNpcInventory [data-npc-item="equipLadle"]'),detail=page.locator('#poiItemDetail');
  await ladle.tap();await detail.waitFor({state:'visible'});
  assert(await page.evaluate(()=>window.__portraitRefreshFixture(-1)));
  assert(await detail.isVisible(),'unrelated status update leaves the open item detail intact');
  await detail.getByRole('button',{name:'戻る'}).tap();
  assert(await ladle.evaluate(el=>el===document.activeElement));
  assert.deepEqual(await game(page),base,'rotating and zooming the portrait cannot move, attack or move the world camera');
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
  await page.locator('#poiNpcInventoryClose').tap();
  assert.equal(await portrait.count(),0);
  assert.deepEqual(npc.errors,[]);
 }finally{await npc.context.close()}
 const player=await launch(browser,390,740);
 try{
  const {page}=player,base=await game(page),id='poiAvatarPreview';
  await page.locator('#poiBagToggle').tap();
  const doll=page.locator('#poiAvatarPreview');await doll.waitFor();
  const neutral=await pixels(doll);
  assert(neutral.area>120&&await nPaint(page,id)===1);
  await doll.focus();
  await page.keyboard.press('ArrowRight');await freshPaint(page,id,1);
  const turn=await pixels(doll);assert.notEqual(turn.hash,neutral.hash);
  const prior=await nPaint(page,id);
  await page.keyboard.press('ArrowUp');await freshPaint(page,id,prior);
  assert((await pixels(doll)).area>turn.area,'keyboard zoom changes the shared player canvas');
  const enlarged=await nPaint(page,id);
  await page.keyboard.press('Home');await freshPaint(page,id,enlarged);
  assert.deepEqual(await pixels(doll),neutral,'Home restores the exact original resting view');
  await page.locator('#poiBagClose').tap();
  await page.locator('#poiBagToggle').tap();await doll.waitFor();
  assert.equal(await nPaint(page,id),enlarged+1,'reopening without changes leaves the cached portrait intact');
  assert.deepEqual(await game(page),base);
  assert.equal(await page.evaluate(k=>localStorage.getItem(k),kitKey),kit);
  assert.deepEqual(player.errors,[]);
 }finally{await player.context.close()}
 console.log('PASS native touch NPC spin/pinch, stable same-NPC panel, no idle paints, safe player portrait keyboard and save protection');
}finally{await browser?.close();await new Promise(r=>server.close(r))}
