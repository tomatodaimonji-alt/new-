import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const html=readFileSync(process.argv[2]??'world-editor.html','utf8');
const server=createServer((_,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.end(html);
});
await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
const url='http://127.0.0.1:'+server.address().port+'/?facility=base&facility-play=1&test=1';
const panels=['#poiMiniMap','#poiLocationPanel','#poiClockHud'];
const others=['#poiWalkPad','#poiGameTools','.poiPartyCard'];
const out=process.env.FACILITY_SCREENSHOTS;
if(out)await mkdir(out,{recursive:true});
const frame=page=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const browser=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  try{
   const page=await context.newPage();
   await page.goto(url);
   await page.locator('#poiClockHud').waitFor({state:'visible'});
   assert.equal(await page.locator('#poiGoldHud').count(),0,'wallet moved to inventory');
   await frame(page);
   const boxes=await page.evaluate(({panels,others})=>{
    return Object.fromEntries(['#viewWrap','#poiMiniHud',...panels,...others].map(sel=>{
     const e=document.querySelector(sel),r=e.getBoundingClientRect(),s=getComputedStyle(e);
     return [sel,{x:r.x,y:r.y,width:r.width,height:r.height,color:s.backgroundColor,opacity:Number(s.opacity),fg:s.color,blur:s.backdropFilter}];
    }));
   },{panels,others});
   const wrap=boxes['#viewWrap'],hud=boxes['#poiMiniHud'];
   assert.ok(hud.x-wrap.x>=4&&hud.x-wrap.x<=10,`mobile ${width}: left inset ${hud.x-wrap.x}`);
   assert.ok(hud.y-wrap.y>=4&&hud.y-wrap.y<=10,`mobile ${width}: top inset ${hud.y-wrap.y}`);
   assert.equal(hud.color,'rgba(0, 0, 0, 0)','no enclosing dark/surface layer');
   assert.equal(hud.opacity,1,'do not fade text or the map marker as a group');
   assert.equal(boxes['#poiWalkPad'].color,'rgba(22, 46, 39, 0.54)');
   for(const sel of others){
    assert.equal(boxes[sel].color,boxes['#poiWalkPad'].color,sel+' has the same resting glass as the D-pad');
   }
   for(const sel of panels){
    assert.equal(boxes[sel].opacity,1,sel+' foreground not faded');
    assert.equal(boxes[sel].color,boxes['#poiWalkPad'].color,sel+' matches the D-pad tint');
    assert.equal(boxes[sel].blur,'none',sel+' does not invoke a WebView backdrop-filter');
    assert.ok(boxes[sel].width>60&&boxes[sel].height>12,sel+' visible');
   }
   if(out)await page.screenshot({path:`${out}/v148-panel-glass-${width}.png`});
   // Underlay only: make the existing scene canvas invisible, then substitute two
   // contrasting colors. The actual HUD canvases, borders, filter and CSS remain.
   await page.addStyleTag({content:'#viewWrap{background:var(--glass-probe)!important} #view{visibility:hidden!important}'});
   const pixels=[];
   for(const color of ['#000','#fff']){
    await page.locator('#viewWrap').evaluate((e,color)=>e.style.setProperty('--glass-probe',color),color);
    await frame(page);
    pixels.push((await page.screenshot()).toString('base64'));
   }
   const contrast=await page.evaluate(async({pixels,boxes,panels})=>{
    async function decode(data){
     const image=new Image(); image.src='data:image/png;base64,'+data;await image.decode();
     const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
     const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,image.width,image.height);
    }
    const [black,white]=await Promise.all(pixels.map(decode));
    const sample=(x,y)=>{
     const i=(Math.round(y)*white.width+Math.round(x))*4;
     return Math.abs(white.data[i]-black.data[i]);
    };
    return Object.fromEntries(panels.map(sel=>{
     const {x,y,width,height}=boxes[sel],d=[];
     for(let yy=5;yy<height-5;yy+=2)for(let xx=5;xx<width-5;xx+=2)d.push(sample(x+xx,y+yy));
     d.sort((a,b)=>a-b);
     return [sel,{median:d[Math.floor(.5*d.length)],high:d[Math.floor(.85*d.length)]}];
    }));
   },{pixels,boxes,panels});
   for(const sel of panels){
    const {median,high}=contrast[sel];
    const target=sel==='#poiMiniMap'?65:100;
    assert.ok(median>=target&&high>=target+5,`mobile ${width}: ${sel} effective transmission too dark: ${JSON.stringify(contrast[sel])}`);
   }
   assert.match(await page.locator('#poiClockValue').innerText(),/^\d\d:\d\d$/);
   console.log(JSON.stringify({width,contrast}));
  }finally{await context.close();}
 }
}finally{await browser.close();await new Promise(r=>server.close(r));}
