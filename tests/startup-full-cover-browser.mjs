import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_PACKAGE||'playwright');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
const hook='progress.value=step;message.textContent=label;';
assert.equal(html.split(hook).length,2,'unique startup checkpoint');
const gated=html.replace(hook,hook+`
  if((step===2||step===4)&&window.__holdBoot)
   await new Promise(resolve=>{window.__resumeBoot=resolve});
`);
const server=createServer((req,res)=>{
 res.setHeader('Content-Type','text/html; charset=utf-8');
 res.setHeader('Cache-Control','no-store');res.end(gated);
});
const output=process.env.STARTUP_SCREENSHOTS||process.env.FACILITY_SCREENSHOTS;
if(output)mkdirSync(output,{recursive:true});
let browser;
try{
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',resolve).once('error',reject));
 const root='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const [name,viewport,route] of [
  ['portrait',{width:390,height:844},'?startup-editor=1&test=1'],
  ['landscape',{width:844,height:390},'?facility=base&test=1'],
 ]){
  const ctx=await browser.newContext({viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await ctx.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.__holdBoot=true});
  await page.goto(root+'/'+route);
  const screenshot=async stage=>{
   const png=await page.screenshot(output?{path:output+'/'+name+'-'+stage+'.png'}:{});
   return page.evaluate(async encoded=>{
    const im=new Image();im.src='data:image/png;base64,'+encoded;await im.decode();
    const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(im,0,0);
    return [[10,10],[canvas.width-11,10],[10,canvas.height-11],[canvas.width-11,canvas.height-11]]
     .map(([x,y])=>[...ctx.getImageData(x,y,1,1).data]);
   },png.toString('base64'));
  };
  for(const stage of [2,4]){
   await page.waitForFunction(n=>document.querySelector('#pineStartupProgress')?.value===n&&typeof window.__resumeBoot==='function',stage);
   const css=await page.evaluate(()=>({opacity:getComputedStyle(document.getElementById('app')).opacity,
    size:[document.getElementById('view').clientWidth,document.getElementById('view').clientHeight],
    state:document.getElementById('pineStartupCover').dataset.state}));
   assert.equal(css.opacity,'0');
   assert(css.size.every(v=>v>0),'renderable canvas even when app is hidden');
   assert.equal(css.state,'loading');
   for(const pixel of await screenshot(stage))
    assert.deepEqual(pixel,[8,20,26,255],'edge contains only the opaque cover, no game pixels');
   await page.evaluate(()=>{const fn=window.__resumeBoot;window.__resumeBoot=null;fn()});
  }
  await page.waitForFunction(()=>document.getElementById('pineStartupCover').hidden);
  const ready=await screenshot('ready');
  assert(ready.some(pixel=>pixel.some((v,i)=>v!==[8,20,26,255][i])),
   'visible game is different from the cover');
  assert.equal(await page.locator('#app').evaluate(el=>el.inert),false);
  assert.deepEqual(errors,[]);
  await ctx.close();
 }
 console.log('PASS actual portrait and landscape WebGL first frame, opaque screenshots at delayed milestones, then interactive game');
}finally{await browser?.close();if(server.listening) await new Promise(r=>server.close(r))}
