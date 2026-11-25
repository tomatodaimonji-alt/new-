import a from 'node:assert/strict';import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8'),hook="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(hook).length,2);
html=html.replace(hook,hook+`
 waterQA:()=>{
  const q=poiNaturalGroundPlan(world,facilitySite,poiEastNatureData(facilitySite)?.rows),
   near=poiOverlandAreas().find(x=>x.id==='base')?.natural;
  return {pos:[poiWalkX,poiWalkZ],port:facilitySite.southPort?.name,sea:poiNaturalGroundMode(q,'sea',71,118),
   nearSea:poiNaturalGroundMode(near,'sea',71,118),portTrack:poiNaturalGroundMode(q,'roadCutStoneFull',105,118),
   docks:poiNaturalGroundMode(q,'roadCutStoneFull',84,117),
   gateTrack:poiNaturalGroundMode(q,'roadGravelFull',227,139),
   peak:gl.getError()};
 },
`);
const srv=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>srv.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+srv.address().port;let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 mkdirSync('water-shots',{recursive:true});
 for(const [name,x,z,bearing,pitch] of [['cellnea',79,118,-Math.PI/2,.38],['port-bend',105,123,Math.PI,.46],['market-road',230,132,Math.PI,.36]]){
  const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:.85,isMobile:true,hasTouch:true});
  const page=await c.newPage(),err=[];page.on('pageerror',e=>err.push(e.message));
  await page.goto(url+'/seed');
  await page.evaluate(({x,z,bearing,pitch})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
   position:{x,z,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,
   level:0,hideUpper:false,top:false,third:true,orbitYaw:bearing,orbitPitch:pitch,orbitDistance:5.3}})),{x,z,bearing,pitch});
  await page.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  const q=await page.evaluate(()=>window.__editorTest.waterQA());console.log(name,q,err);
  a.deepEqual(q.pos,[x,z]);a.equal(q.port,'セルネア');a.equal(q.sea,4);a.equal(q.nearSea,4);
  a.equal(q.portTrack,5);a.equal(q.docks,0);a.equal(q.gateTrack,5);a.equal(q.peak,0);
  await page.screenshot({path:'water-shots/'+name+'.png'});
  a.deepEqual(err,[]);await c.close();
 }
}finally{await b?.close();await new Promise(r=>srv.close(r))}
