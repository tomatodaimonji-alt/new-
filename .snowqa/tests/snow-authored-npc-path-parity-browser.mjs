import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
const source=readFileSync(process.argv[2]??'world-editor.html','utf8');
const anchor='  overlandStream:()=>poiOverlandInspect(),';assert.equal(source.split(anchor).length,2);
let html=source.replace(anchor,anchor+`
  seamPathParity:()=>{
   const pairs=[['resadventurer',58,40,45,72],['guestadventurer',54,40,88,67]];
   const g=poiTownNpcGraph(),engaged=poiOverlandEngaged,edited=facilitySurfaceEdited,
    count=window.__pathSteps,base=facilitySite?.id;
   return {engaged,base,results:pairs.map(([role,x,z,tx,tz])=>{
    const from={x,z,y:0,role:{id:role}},to={x:tx,z:tz,y:0};
    const guard=poiOverlandTownCertified(from,to,null),fallback=poiOverlandTownCertified(from,to,()=>false);
    facilitySurfaceEdited=true;
    const editGuard=poiOverlandTownCertified(from,to,null);
    facilitySurfaceEdited=edited;
    const initial=count.value,actual=poiOverlandTownOrderedPath(from,to,g),after=count.value;
    poiOverlandEngaged=false;
    let legacy;
    try{legacy=poiTownFindPath(from,to)}finally{poiOverlandEngaged=engaged}
    const coords=xs=>xs?.map(p=>[p.x,p.z,p.y]);
    return {role,guard,fallback,editGuard,actual:coords(actual),legacy:coords(legacy),checks:after-initial,baseChecks:count.value-after};
   })};
  },`);
const fn='function poiTownNpcNextTile(from,x,z,g){';assert.equal(html.split(fn).length,2);
html=html.replace(fn,fn+'window.__pathSteps.value++;');
for(const [,js] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
if(process.env.PATH_PARITY_PARSE_ONLY==='1'){console.log('exact real path parity instrumentation parses');process.exit(0)}
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(req.url==='/seed'?'<!doctype html><title>Local test seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await (await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.65})).newPage();
 await page.addInitScript(()=>{window.__pathSteps={value:0}});
 const root='http://127.0.0.1:'+server.address().port;
 await page.goto(root+'/seed');await page.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({
  version:1,route:'facility',id:'base',play:true,position:{x:49,z:119,y:0,facing:2},townLayout:5,townMapHeight:128
 })));
 await page.goto(root+'/?resume=1&test=1');
 await page.locator('#pineStartupCover').waitFor({state:'hidden'});
 await page.waitForFunction(()=>window.__editorTest?.overlandStream().drawing);
 const data=await page.evaluate(()=>window.__editorTest.seamPathParity());assert(data.engaged&&data.base==='base');
 for(const [i,r] of data.results.entries()){
  assert(r.guard&&!r.fallback&&!r.editGuard);
  assert.deepEqual(r.actual,r.legacy,'same exact shortest historical path and ordering through real authored terrain');
  assert.equal(r.legacy.length,[51,61][i]);
  assert(r.checks<r.baseChecks*.6,'avoid a substantial number of true edge evaluations');
  console.log('Path parity and actual edge counts',JSON.stringify({role:r.role,length:r.actual.length,checks:r.checks,prior:r.baseChecks}));
 }
}finally{await browser?.close();await new Promise(r=>server.close(r))}
