import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';

const html = readFileSync('index.html','utf8');
if (!html.includes('灰緑の境界') || !html.includes('drawBuilding')) throw Error('Wrong game build');
const server = createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:926,height:428},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'load'});
 await page.waitForTimeout(200);
 const canvas=page.locator('#view');
 const ctx=await canvas.evaluate(c=>({valid:!!c.getContext('2d'),w:c.width,h:c.height}));
 if(!ctx.valid||!ctx.w||!ctx.h)throw Error('No Canvas rendering context');
 await page.locator('#start').click();
 if(await page.locator('#panel').isVisible())throw Error('Start screen still shown');
 const startPlace=await page.locator('#place').textContent();
 const before=await page.screenshot({path:'smoke-before.png'});
 // Validate on-screen d-pad press-and-hold actually moves the game.
 const up=page.locator('[data-d="up"]'),box=await up.boundingBox();
 if(!box||box.width<48||box.height<48)throw Error('D-pad too small for Android');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 await page.waitForTimeout(1100);
 await page.mouse.up();
 await page.waitForTimeout(200);
 const moved=await page.screenshot({path:'smoke-after.png'});
 const a=PNG.sync.read(before),b=PNG.sync.read(moved);
 let delta=0,samples=0;
 for(let y=75;y<a.height-80;y+=11)for(let x=200;x<a.width-170;x+=11){
   const i=(y*a.width+x)*4;
   for(let k=0;k<3;k++)delta+=Math.abs(a.data[i+k]-b.data[i+k]);
   samples+=3;
 }
 const avg=delta/samples;
 console.log('Gameplay pixel change after D-pad hold:',avg,'starting area:',startPlace);
 if(avg<4)throw Error('Movement not reflected in rendered world');
 const map=page.locator('#map');
 await map.click();
 await page.waitForTimeout(150);
 await page.screenshot({path:'smoke-map.png'});
 await map.click();
 await page.locator('#action').click();
 const note=await page.locator('#note').textContent();
 if(!note)throw Error('Action button did not produce feedback');
 if(errors.length)throw Error('Browser errors: '+errors.join(' | '));
 console.log('PASS: start, landscape Canvas, touch D-pad, map, interaction, no exceptions');
}finally{await browser?.close();server.close()}
