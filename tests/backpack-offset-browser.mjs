import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Seed</title>':html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
function measure(page,old=false){
 return page.evaluate(old=>{
  const style=[...document.querySelectorAll('style')].find(el=>el.textContent.includes('/* BEGIN LOWER LANDSCAPE BACKPACK */'));
  if(!style)throw Error('backpack stylesheet missing');
  const original=style.textContent;
  if(old)style.textContent=original.replace(/\/\* BEGIN LOWER LANDSCAPE BACKPACK \*\/[\s\S]*?\/\* END LOWER LANDSCAPE BACKPACK \*\//,'');
  const b=['#poiBagToggle','#poiWalkAction','#poiHotbar','#poiBagPanel'].map(q=>{
   const {x,y,width:w,height:h,right,bottom}=document.querySelector(q).getBoundingClientRect();
   return {x,y,w,h,right,bottom};
  });
  if(old)style.textContent=original;
  return b;
 },old);
}
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE||undefined,
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 for(const [width,height] of [[568,320],[844,390],[1120,500],[390,740]]){
  const ctx=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
  try{
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   await p.goto(origin+'/seed');
   await p.evaluate(()=>{
    localStorage.setItem('world-workshop-hotbar-v1','{"version":1,"weapon":null,"potions":3,"gold":12}');
    localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
     position:{x:41,z:43,y:0,facing:1},townLayout:5,townMapHeight:128,view:{yaw:.24,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:false,orbitYaw:0,orbitPitch:.35,orbitDistance:5.5}}));
   });
   await p.goto(origin+'/?resume=1&test=1');
   await p.waitForFunction(()=>window.__editorTest?.facility?.().active);
   await p.locator('#pineStartupCover').waitFor({state:'hidden'});
   const landscape=width>height;
   await p.locator(landscape?'#viewWrap[data-analog-play]':'#viewWrap:not([data-analog-play])').waitFor({state:'attached'});
   const [before,oldAction,oldBar]=await measure(p,true);
   const [after,action,bar]=await measure(p);
   assert.deepEqual(action,oldAction,'attack moved or resized');
   assert.deepEqual(bar,oldBar,'shortcut panel moved or resized');
   assert.deepEqual([after.x,after.w,after.h],[before.x,before.w,before.h],'backpack only moves vertically');
   if(landscape){
    assert(after.bottom<=height-7,'protect lower safe inset');
    const drop=after.y-before.y,barOverlaps=bar.right>after.x-3;
    const expected=barOverlaps?Math.max(0,Math.min(8,bar.y-before.bottom-3)):8;
    assert(Math.abs(drop-expected)<.5,'down 8px where clear; only protect overlapping shortcut gap '+JSON.stringify({width,before,after,bar,expected}));
    if(width===844)assert(drop>2&&drop<7,'intermediate phone width still moves, with a measured shortcut gap');
    if(barOverlaps)assert(after.bottom<=bar.y-2.9);
    assert(after.right+6<=action.x);
   }else assert.deepEqual(after,before,'portrait backpack unchanged');
   await p.locator('#poiBagToggle').tap();
   await p.locator('#poiBagPanel').waitFor({state:'visible'});
   assert.deepEqual((await measure(p))[3],(await measure(p,true))[3],'inventory panel must not move');
   await p.locator('#poiBagClose').tap();
   assert.deepEqual(errors,[]);
  }finally{await ctx.close()}
 }
 console.log('PASS landscape-only downward backpack shift, real touch hits, protected hotbar and preserved panel/portrait');
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
