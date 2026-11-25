import a from 'node:assert/strict';import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';import {createServer} from 'node:http';
const h=readFileSync('world-editor.html','utf8'),anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(h.split(anchor).length,2);
const html=h.replace(anchor,anchor+`
 frontageQA:()=>{
  const k=poiKingdomData(facilitySite);
  const g=poiTownNpcActors.filter(a=>a.role.id?.startsWith('vald-guard-south-outer-')).map(a=>({x:a.x,z:a.z,facing:a.facing,inside:poiKingdomContains(facilitySite,a.x,a.z,a.y)}));
  return {pos:[poiWalkX,poiWalkZ],guards:g,south:k.enclosureGates.south,
   natural:!k.solid.has('231,128')&&k.floors.has('227,139'),inside:poiKingdomContains(facilitySite,poiWalkX,poiWalkZ,0),
   north:['Up','Down','Left','Right'].find((_,i)=>poiCameraRelativeStep(['n','s','w','e'][i]).join()==='0,-1'),gl:gl.getError()};
 },
`);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const u='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 mkdirSync('frontage-shots',{recursive:true});
 const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.86});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(u+'/seed');
 await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
  position:{x:231,z:128,y:0,facing:0},townLayout:5,townMapHeight:182,templeDepth:1,
  view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:Math.PI,orbitPitch:.34,orbitDistance:5.2}})));
 await p.goto(u+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 const get=()=>p.evaluate(()=>window.__editorTest.frontageQA());
 await p.waitForFunction(()=>window.__editorTest.frontageQA().guards.length===2);
 const st=await get();console.log(st);
 a.deepEqual(st.pos,[231,128]);a.equal(st.inside,false);a.equal(st.natural,true);a.equal(st.gl,0);
 a.deepEqual(st.guards,[{x:229,z:125,facing:2,inside:false},{x:233,z:125,facing:2,inside:false}]);
 await p.screenshot({path:'frontage-shots/south-outside.png'});
 for(let i=0;i<17&&(await get()).pos[1]>122;i++){await p.keyboard.press('Arrow'+st.north);await p.waitForTimeout(173)}
 const entry=await get();console.log('walk through guarded main gate',entry);
 a.deepEqual(entry.pos,[231,122]);a.equal(entry.inside,true);a.equal(entry.gl,0);
 await p.screenshot({path:'frontage-shots/south-inside.png'});
 a.deepEqual(errors,[]);await c.close();
}finally{await b?.close();await new Promise(r=>server.close(r))}
