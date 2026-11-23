import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(req.url.startsWith('/seed')?'<!doctype html><title>Isolated fixtures</title>':html);
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
const worldKit='world-workshop-hotbar-v1';
const readStock=page=>page.evaluate(k=>JSON.parse(localStorage.getItem(k)),worldKit);
const openAt=async(page,x,z,fromX,fromZ)=>page.evaluate(([x,z,fx,fz])=>window.__editorTest.canStep(x,z,fx,fz),[x,z,fromX,fromZ]);
const morning=9*60;
const kit={version:1,weapon:'equipWoodSword',potions:3,gold:12,claimedCaches:['glade']};
const expected=(x,z,level)=>({x,z,level});
const pocket=async page=>(await state(page)).position;
const waitPosition=async(page,goal)=>{
 await page.waitForFunction(goal=>{
  const f=window.__editorTest?.facility?.();
  const p=f?.position;
  return f?.active&&p?.x===goal.x&&p.z===goal.z&&p.level===goal.level;
 },goal);
 return goal;
};
const chestReach=page=>page.locator('#poiWalkAction');
async function south(ctx,page,goal){
 await page.evaluate(()=>{
  const sample=()=>{
   if(!window.__qaPortalTraceActive)return;
   const p=window.__editorTest.facility().position,label=[p.x,p.z,p.level].join(',');
   if(window.__qaPortalTrace.at(-1)!==label)window.__qaPortalTrace.push(label);
   requestAnimationFrame(sample);
  };
  window.__qaPortalTrace=[];window.__qaPortalTraceActive=true;sample();
 });
 const initial=await pocket(page),box=await page.locator('[data-poi-dir="s"]').boundingBox();
 assert(box?.width&&box.height,'real native south D-pad target');
 const at={x:Math.round(box.x+box.width/2),y:Math.round(box.y+box.height/2),id:1};
 const c=await ctx.newCDPSession(page);
 try{
  await c.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[at]});
  await page.waitForTimeout(450);
  await c.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 }finally{await c.detach()}
 await waitPosition(page,goal);
 await page.waitForTimeout(300);
 const trace=await page.evaluate(()=>{window.__qaPortalTraceActive=false;return window.__qaPortalTrace});
 const key=p=>[p.x,p.z,p.level].join(',');
 assert.deepEqual(trace,[key(initial),key(goal)],'held D-pad crosses exactly once without reentering or moving farther: '+JSON.stringify(trace));
}
async function assertPlanet(page){
 const s=await state(page);
 assert.equal(s.sceneLayer,'cellar');
 assert.equal(s.miniMap.location,'星蝕の回廊');
 assert.equal(s.miniMap.stars,'★★★★☆');
 assert.equal(s.position.level,-1);
 assert.equal(await page.locator('#poiLocationName').textContent(),'星蝕の回廊');
}
async function luminous(page,label){
 const shot=await page.locator('#view').screenshot();
 if(out){
  const {writeFile}=await import('node:fs/promises');
  await writeFile(out+'/v191-'+label+'.png',shot);
 }
 const found=await page.evaluate(async png=>{
  const im=new Image();im.src='data:image/png;base64,'+png;await im.decode();
  const c=document.createElement('canvas');c.width=im.width;c.height=im.height;
  const g=c.getContext('2d');g.drawImage(im,0,0);
  const image=g.getImageData(0,0,c.width,c.height).data;let count=0;
  // Saturated violet/blue light in actual composed viewport pixels.
  for(let i=0;i<image.length;i+=4){
   const [r,v,b]=[image[i],image[i+1],image[i+2]];
   if(image[i+3]>220&&b>=124&&b>v+28&&b>r+13)count++;
  }
  return count;
 },shot.toString('base64'));
 assert(found>=7,'visible saturated violet-blue portal pixels: '+found);
}
async function verifyRoute(browser){
 const surface=expected(118,87,0),vestibule=expected(100,90,-1);
 const {ctx,page,errors}=await launch(browser,'base',surface,{width:390,clockStart:morning,kit,facing:2,yaw:0});
 try{
  const source=await getMap(page);
  for(const [x,z,y] of [[118,88,0],[100,91,-1]])
   assert(source.world.some(o=>o.type==='otherworldPortal'&&o.x===x&&o.z===z&&o.y===y),'real authored portal at '+[x,z,y]);
  assert.deepEqual(await pocket(page),surface);
  assert.equal(await openAt(page,118,88,118,87),true,'portal center is actually walkable');
  assert.deepEqual(await readStock(page),kit,'not carrying any quest or key');
  await luminous(page,'surface-portal');
  await south(ctx,page,vestibule);
  await assertPlanet(page);
  assert.equal((await state(page)).dungeonEntranceSerial,1,'first entry plays one transition');
  await page.waitForFunction(()=>window.__editorTest?.facility?.()?.musicZone==='otherworld');
  assert.deepEqual(await readStock(page),kit,'portal transition never consumes gear or changes inventory');
  assert.equal((await state(page)).combat.playerHP,100);
  assert.equal((await state(page)).combat.threats.length,0,'first arrival is safely outside hostile targeting');
  const stamp=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)),resumeKey);
  assert.deepEqual(stamp.position,{x:100,z:90,y:-1,facing:0});
  const camera=(await page.locator('#poiThirdView').innerText()).trim();
  assert.match(camera,/俯瞰/);
  await page.waitForTimeout(800);
  assert.deepEqual(await pocket(page),vestibule,'landing does not bounce through return portal');
  await page.reload();await page.waitForFunction(()=>window.__editorTest?.facility?.().active);
  assert.deepEqual(await pocket(page),vestibule,'reloading inside resumes same floor and cell');
  assert.equal((await page.locator('#poiThirdView').innerText()).trim(),camera);
  await assertPlanet(page);
  await luminous(page,'return-portal');
  await south(ctx,page,surface);
  assert.equal((await state(page)).dungeonEntranceSerial,0,'return does not play an entry effect');
  await page.waitForFunction(()=>window.__editorTest?.facility?.()?.musicZone==='outside');
  await page.locator('#poiMessageLog').getByText('星蝕の回廊を出た。',{exact:true}).waitFor({state:'visible'});
  assert(!await page.getByText('ゲーム世界に戻った。',{exact:true}).count());
  await page.waitForTimeout(700);
  assert.deepEqual(await pocket(page),surface,'return does not bounce');
  assert.equal((await state(page)).sceneLayer,'surface');
  assert.notEqual((await state(page)).miniMap.location,'星蝕の回廊');
  assert.equal((await page.locator('#poiThirdView').innerText()).trim(),camera);
  assert.deepEqual(await readStock(page),kit);
  assert.deepEqual(await getMap(page),source);
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
async function verifyThreat(browser){
 const practiceKit={...kit,slots:[{type:'equipWoodSword',count:1,durability:80},
  {type:'healingHerb',count:3},{type:'cannedFood',count:5},...Array(9+18-3).fill(null)]};
 const {ctx,page,errors}=await launch(browser,'base',{x:101,z:80},{level:-1,width:390,clockStart:morning,kit:practiceKit,facing:0});
 try{
  await assertPlanet(page);
  const initial=await state(page);
  assert.equal(initial.inventory.hotbar[2]?.count,5,'real 27-slot inventory decodes battle provisions');
  const before=initial.combat.playerHP;

  const dragon=(await state(page)).combat.actors.find(a=>a.type==='monsterDragon'&&a.level===-1&&a.x===101&&a.z===79);
  assert.equal(dragon?.hp,150,'the authored elite is a real 150HP enemy, not a scenery actor');
  await page.waitForFunction(()=>window.__editorTest.facility().combat.threats.some(t=>t.type==='monsterDragon'&&t.x===101&&t.z===80&&t.y===-1));
  await page.waitForFunction(h=>window.__editorTest.facility().combat.playerHP<h,before);
  assert.equal((await state(page)).combat.playerHP,before-(22-2),'the standing player takes the real elite strike less 2 defense from starting cloth shorts');
  assert.equal(await openAt(page,100,76),false,'deep reward gate is solid until elite defeat');
  assert.equal((await readStock(page)).otherworldCleared,undefined);
  // Complete the real fight with the starting wooden sword. The boost is only
  // the resume fixture placing the player adjacent, not any injected damage.
  assert.equal((await state(page)).inventory.weapon,'equipWoodSword');
  await page.keyboard.press('ArrowUp'); // face the actual blocking dragon
  assert.deepEqual(await pocket(page),expected(101,80,-1));
  const dragonHp=async()=> (await state(page)).combat.actors.find(a=>a.type==='monsterDragon'&&a.level===-1)?.hp;
  let hp=150;
  for(let hit=0;hit<6;hit++){
   const target=Math.max(0,hp-28);
   for(let attempt=0;attempt<2 && await dragonHp()===hp;attempt++){
    // This is ★4: use normal carried food through the real shortcut instead
    // of deliberately face-tanking the elite and both approaching guards.
    const live=await state(page);
    if(live.combat.playerHP<=80){
     assert(live.inventory.hotbar[2]?.type==='cannedFood','a legal canned food is available');
     await page.keyboard.press('3');
    }
    await page.keyboard.press('Space');
    await page.waitForTimeout(340);
   }
   const found=await dragonHp();
   if(found!==target){
    const s=await state(page);
    throw Error('Wooden strike '+(hit+1)+': wanted '+target+'HP, got '+found+'; '+JSON.stringify({position:s.position,enemy:s.combat.actors.filter(a=>a.level===-1),player:s.combat.playerHP,held:s.inventory.weapon,aria:await chestReach(page).getAttribute('aria-label'),pageErrors:errors,kit:await readStock(page)}));
   }
   hp=target;
  }
  assert.equal((await readStock(page)).otherworldCleared,true);
  await page.evaluate(key=>{
   const save=JSON.parse(localStorage.getItem(key));
   save.position={x:100,z:77,y:-1,facing:0};
   localStorage.setItem(key,JSON.stringify(save));
  },resumeKey);
  await page.reload();await waitPosition(page,expected(100,77,-1));
  assert.equal(await openAt(page,100,76),true,'authored gate opens and stays open after reload');
  await move(page,'n',true,true);await move(page,'n',true,true);
  assert.deepEqual(await pocket(page),expected(100,75,-1));
  const chest=page.locator('#poiChestPanel'),gauge=page.locator('#poiMineUnlockProgress');
  await chestReach(page).tap();
  await gauge.waitFor({state:'visible'});
  assert.equal(await gauge.innerText(),'','no visible unlock caption');
  assert((await gauge.boundingBox()).width<=62,'the same compact gauge follows the other chamber chest');
  assert(await gauge.locator('progress').getAttribute('aria-label'));
  await chest.waitFor({state:'visible'});
  await gauge.waitFor({state:'hidden'});
  const reward=await readStock(page);
  assert.equal(reward.gold,kit.gold+18);
  assert(!reward.kitchenChest&&!reward.mineTreasureChest,'each dungeon chest owns independent saved storage');
  assert.equal(reward.otherworldChest.slots[0].type,'cannedFood');
  if(out)await page.screenshot({path:out+'/v191-otherworld-reward.png'});
  await page.locator('#poiChestClose').tap();
  await page.reload();await waitPosition(page,expected(100,75,-1));
  await chestReach(page).tap();
  await chest.waitFor({state:'visible'});
  assert.deepEqual(await readStock(page),reward,'reopening cannot repeat the gold reward or regenerate inventory');
  await unchanged(page);assert.deepEqual(errors,[]);
 }finally{await ctx.close()}
}
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 await verifyRoute(browser);await verifyThreat(browser);
 console.log('PASS visible portal, real native travel/return and reload, consistent camera/inventory, actual difficulty and elite threat');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
