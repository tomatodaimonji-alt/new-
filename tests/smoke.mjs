import { chromium } from 'playwright';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {PNG} from 'pngjs';
const html=readFileSync('index.html','utf8');
if(!html.includes('森の遺跡')||!html.includes('function drawWall'))throw Error('Wrong rebuild source');
const server=createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text())});
 await page.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'load'});
 await page.waitForTimeout(350);
 const valid=await page.locator('#scene').evaluate(c=>!!c.getContext('2d')&&c.width>100&&c.height>100);
 if(!valid)throw Error('Canvas is not drawing');
 const world=await page.evaluate(()=>window.__test.state());
 if(world.buildings.length<5)throw Error('Expected multiple buildings');
 // Four wall corners must remain solid and be present in the collision map.
 const walls=new Set(world.walls),doors=new Set(world.doors);
 for(const b of world.buildings){
  const corners=[[b.x,b.y],[b.x+b.w-1,b.y],[b.x,b.y+b.h-1],[b.x+b.w-1,b.y+b.h-1]];
  for(const [x,y] of corners){if(!walls.has(x+','+y))throw Error('Missing building corner at '+x+','+y)}
  if(!doors.has(b.door.x+','+b.door.y))throw Error('Missing door');
  if(walls.has(b.door.x+','+b.door.y))throw Error('Door was blocked');
 }
 console.log('PASS',world.buildings.length,'buildings, four solid wall corners and accessible door');
 await page.screenshot({path:'smoke-before.png'});
 const up=page.locator('[data-dir="up"]'),box=await up.boundingBox();
 if(!box||box.height<60||box.width<60)throw Error('Large portrait controls not found');
 const before=await page.evaluate(()=>window.__test.state());
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(900);await page.mouse.up();
 const after=await page.evaluate(()=>window.__test.state());
 if(Math.hypot(after.x-before.x,after.y-before.y)<1)throw Error('Held movement did not move: '+JSON.stringify([before,after]));
 console.log('PASS held portrait direction',before.x,before.y,'→',after.x,after.y);
 await page.screenshot({path:'smoke-after.png'});
 const a=PNG.sync.read(readFileSync('smoke-before.png')),b=PNG.sync.read(readFileSync('smoke-after.png'));let d=0,n=0;
 for(let y=190;y<a.height-270;y+=13)for(let x=16;x<a.width-16;x+=13){const i=(y*a.width+x)*4;d+=Math.abs(a.data[i]-b.data[i])+Math.abs(a.data[i+1]-b.data[i+1]);n+=2}
 if(d/n<2)throw Error('World did not visually change');
 await page.locator('#inventory').click();
 if(!(await page.locator('#items').isVisible()))throw Error('Inventory did not open');
 await page.locator('#closeItems').click();
 await page.locator('#action').click();
 await page.locator('#newWorld').click();
 const regenerated=await page.evaluate(()=>window.__test.state());
 if(regenerated.buildings.length!==world.buildings.length)throw Error('World regeneration lost buildings');
 if(errors.length)throw Error('Javascript browser errors: '+errors.join(' | '));
 console.log('PASS new-world regeneration, inventory, action and Canvas. All smoke tests completed.');
}finally{await browser?.close();server.close()}
