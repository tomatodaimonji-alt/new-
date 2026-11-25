import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
const before=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
assert.equal(before.split(anchor).length,2);
const html=before.replace(anchor,anchor+`
 npcJourneyQA:(seed=false)=>{
  const a=poiTownNpcActors.find(a=>a.role.id==='resadventurer');
  if(seed&&facilitySite?.id==='base'&&a){
   for(let k=0;k<5;k++)if(poiTownNpcPurseApply(a,'hunt')!=='ok')throw Error('test purse could not seed');
   if(poiTownNpcPurseApply(a,'herb')!=='ok')throw Error('test purse herb could not seed');
   a.hp=88;
  }
  return {region:facilitySite?.id,z:poiWalkViewZ,a:a&&{hp:a.hp,coins:a.coins,potions:a.potions}};
 },
`);
const {chromium}=createRequire(import.meta.url)('playwright');
const server=createServer((request,response)=>{
 response.setHeader('Content-Type','text/html; charset=utf-8');
 response.end(request.url==='/seed'?'<title>Isolated seam</title>':html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const ctx=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.65,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 const page=await ctx.newPage(),errors=[];
 const origin='http://127.0.0.1:'+server.address().port;
 await ctx.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/seed');
 await page.evaluate(()=>{
  localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":2}');
  localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":330000}');
  localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x:60,z:136,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
   view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:.37,orbitPitch:.24,orbitDistance:5.5}}));
 });
 await page.goto(origin+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 await page.waitForFunction(()=>window.__editorTest?.npcJourneyQA()?.a,null,{timeout:12000});
 const expected={hp:88,coins:9,potions:1};
 assert.deepEqual((await page.evaluate(()=>window.__editorTest.npcJourneyQA(true))).a,expected);
 const pad=await page.locator('#poiAnalogPad').boundingBox();assert(pad);
 const cdp=await ctx.newCDPSession(page);
 async function cross(sign,id){
  const input={x:Math.round(pad.x+pad.width/2),y:Math.round(pad.y+pad.height/2),id,radiusX:4,radiusY:4,force:.7};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[input]});
  try{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...input,y:input.y+sign*36}]});
   await page.waitForFunction(sign=>{
    const s=window.__editorTest.npcJourneyQA();
    return sign>0?s.region==='snowpass'&&s.z>.78:s.region==='base'&&s.z<137.22&&!!s.a;
   },sign,{polling:30,timeout:12000});
  }finally{await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})}
 }
 await cross(1,71);
 assert.equal((await page.evaluate(()=>window.__editorTest.npcJourneyQA())).a,undefined);
 await cross(-1,72);
 assert.deepEqual((await page.evaluate(()=>window.__editorTest.npcJourneyQA())).a,expected);
 assert.deepEqual(errors,[]);
 console.log('PASS: actual trusted drag Base → Snow → Base retains the same resident outcome');
}finally{await b?.close();await new Promise(r=>server.close(r))}
