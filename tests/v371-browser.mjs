import a from 'node:assert/strict';
import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8');
const marker="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(marker).length,2);
html=html.replace(marker,marker+`
 feetQA:{
  sample:(x,z,facing=1)=>{
   workshopResumeRestorePosition({x,z,y:0,facing});
   poiWalkAvatar(performance.now());
   return {p:[poiWalkX,poiWalkZ],kind:frontierTileKind(x,z),height:poiCreekPlayerHeight(performance.now()),
    raw:frontierSampleHeight(x+.5,z+.5),feet:window.__groundedFeet.at(-1),gl:gl.getError()};
  },
  step:()=>poiWalkStep(1,0),
  playerX:()=>poiWalkX, viewX:()=>poiWalkViewX
 },
`);
const point='  frontierFitSoles(m,body.townParts.soles,y,.90);';
a.equal(html.split(point).length,2);
html=html.replace(point,`  {frontierFitSoles(m,body.townParts.soles,y,.90);
   if(facilityParams.get('test')==='1'){
    const report=body.townParts.soles.map(([s,b])=>{
     let low=Infinity,edge=Infinity;
     for(let k=s;k<b;k+=3){
      const fy=m.p[k+1],ty=frontierSurfaceHeight(m.p[k],m.p[k+2]);
      low=Math.min(low,fy-ty);edge=Math.min(edge,fy);
     }
     return {low,edge};
    });
    const traces=window.__groundedFeet??=[];
    traces.push({x,z,report});if(traces.length>110)traces.shift();
   }
  }`);
const srv=createServer((req,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.stack));
 await page.goto('http://127.0.0.1:'+srv.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.screenshot({path:'v371-village.png'});
 const coordinates=[[47,30,'earth'],[38,25,'woodfloorLight'],[41,32,'earth'],[64,30,'river'],[160,26,'roadRoyalFull']];
 for(const [x,z,kind] of coordinates){
  const s=await page.evaluate(([x,z])=>window.__editorTest.feetQA.sample(x,z),[x,z]);
  console.log('foot contact',s);
  a.deepEqual(s.p,[x,z]);a.equal(s.kind,kind);a.equal(s.gl,0);a.equal(s.feet?.report?.length,2);
  for(const foot of s.feet.report)a(foot.low>=.011&&foot.low<.033,'sole must clear the visible tile without floating');
  if(kind!=='river')a(Math.abs(s.height-s.raw-(kind==='earth'?.005:.135))<.00001);
 }
 await page.evaluate(()=>{const qa=window.__editorTest.feetQA;qa.sample(46,30);window.__groundedFeet.length=0;qa.step()});
 await page.waitForFunction(()=>window.__groundedFeet.some(f=>f.x>46.54&&f.x<47.46),{},{timeout:8000});
 const walk=await page.evaluate(()=>window.__groundedFeet.filter(f=>f.x>46.54&&f.x<47.46));
 a(walk.every(f=>f.report.every(foot=>foot.low>=.011)));
 a.deepEqual(errors,[]);
 console.log('Mobile landscape: soles grounded when standing and stepping.');
}finally{await browser?.close();srv.close();}
