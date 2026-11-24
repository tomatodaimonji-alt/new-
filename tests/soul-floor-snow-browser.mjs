import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
let h=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(h.split(anchor).length,2);
h=h.replace(anchor,anchor+`
 soulSnowQA:()=>{
  const kit=poiHotbarRead();
  return {region:facilitySite.id,x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,display:poiSoulFloorStatic?.count??0,
   drops:kit.soulDrops??[],local:(kit.soulDrops??[]).filter(poiSoulFloorWorld),active:kit.companionSoul?.active??null,
   item:poiInventorySlots(kit).filter(c=>poiCompanionType(c?.type)),gold:kit.gold,
   action:$('poiWalkAction')._shopPrompt,saved:JSON.parse(localStorage.getItem(POI_HOTBAR_KEY)||'{}')};
 },
`);
for(const [,body] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(body);
if(process.env.SOUL_FLOOR_SNOW_PARSE_ONLY){console.log('Parsed native snow soul realm test');process.exit(0);}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf8');res.end(req.url==='/seed'?'<title>seed</title>':h)});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const url='http://127.0.0.1:'+server.address().port;
let browser,phase='boot',last;
try{
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65});
 const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(17500);
 await p.goto(url+'/seed');
 const baseItem={x:60,z:137,y:0,type:'orvasSoul',durability:317};
 await p.evaluate(baseItem=>{
  const slots=Array(27).fill(null);slots[0]={type:'equipWoodSword',count:1,durability:77};slots[2]={type:'slimeSoul',count:1,durability:17};
  localStorage.setItem('world-workshop-hotbar-v1',JSON.stringify({version:1,weaponDurabilityVersion:2,weapon:'equipWoodSword',potions:0,gold:12,slots,soulDrops:[baseItem]}));
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:60,z:137,y:0,facing:2},
   townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.24,orbitDistance:5.5}}));
 },baseItem);
 const read=async()=>last=await p.evaluate(()=>window.__editorTest.soulSnowQA());
 const at=(region,z)=>p.waitForFunction(([id,z])=>{const qa=window.__editorTest;return qa?.snowPassRegion().id===id&&Math.round(qa.freeMovementPose().z)===z},[region,z]);
 await p.goto(url+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden'});await at('base',137);
 assert.deepEqual((await read()).local,[baseItem]);
 const cdp=await ctx.newCDPSession(p),pad=p.locator('#poiAnalogPad');
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const cross=async(sign,next,z=sign>0?0:138)=>{
  const r=await pad.boundingBox();assert(r);
  const pt={x:Math.round(r.x+r.width*.5),y:Math.round(r.y+r.height*.5),id:7};
  await touch('touchStart',[pt]);await touch('touchMove',[{...pt,y:pt.y+36*sign}]);
  await p.waitForFunction(([next,z])=>{const qa=window.__editorTest;return qa?.snowPassRegion().id===next&&Math.round(qa.freeMovementPose().z)===z},[next,z]);
  await touch('touchEnd',[]);
 };
 phase='real base-to-snow seam retains base record but does not expose its loot target';
 await cross(1,'snowpass');await at('snowpass',0);
 const winter=await read();assert.deepEqual(winter.drops,[baseItem]);assert.deepEqual(winter.local,[]);assert.equal(winter.action,'action');
 await p.waitForTimeout(255);await p.keyboard.press('ArrowDown');await at('snowpass',1);
 phase='side-region trusted drop remains isolated on its own local ground';
 const slot=p.locator('#poiHotbar [data-hotbar-slot="2"]'),bounds=await slot.boundingBox();assert(bounds);
 const point={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2,id:9};
 await touch('touchStart',[point]);for(let i=1;i<=3;i++)await touch('touchMove',[{...point,x:point.x+i*2,y:point.y-i*35}]);await touch('touchEnd',[]);
 await p.waitForFunction(()=>window.__editorTest.soulSnowQA().local.length===1);
 const drop=await read(),snow=drop.local[0];
 assert.equal(snow.type,'slimeSoul');assert.equal(snow.region,'snowpass');assert.equal(snow.durability,17);
 assert(!drop.item.length);assert.deepEqual(drop.saved.soulDrops,[baseItem,snow]);
 phase='cold Snow resume, actual step over remains inert, exact open input picks only the Snow soul';
 await p.reload();await p.locator('#pineStartupCover').waitFor({state:'hidden'});await at('snowpass',1);
 assert.deepEqual((await read()).local,[snow]);
 assert.equal(snow.x,12);assert.equal(snow.z,2);
 await p.waitForTimeout(250);await p.keyboard.press('ArrowDown');await at('snowpass',2);
 assert.deepEqual((await read()).local,[snow]);assert.equal(last.action,'soul-pickup');
 await p.locator('#poiWalkAction').tap();
 await p.waitForFunction(()=>window.__editorTest.soulSnowQA().item.some(c=>c.type==='slimeSoul'));
 assert.deepEqual((await read()).item,[{type:'slimeSoul',count:1,durability:17}]);assert.deepEqual(last.drops,[baseItem]);assert.equal(last.active,null);
 phase='real return to base exposes preserved extension-lobe item and leaves wallet alone';
 await cross(-1,'base');await at('base',138);
 assert.deepEqual((await read()).local,[baseItem]);assert.equal(last.gold,12);assert.equal(last.saved.soulDrops[0].durability,317);
 assert.deepEqual(errors,[]);console.log('PASS two trusted region transitions, isolated miniatures across cold Snow and explicit pickup; exact saved base seam and HP kept');
}catch(e){console.error(phase,JSON.stringify(last));throw e}
finally{await browser?.close();await new Promise(ok=>server.close(ok))}
