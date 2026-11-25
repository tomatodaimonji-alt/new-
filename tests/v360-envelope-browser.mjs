import a from 'node:assert/strict';import {chromium} from 'playwright';import {readFileSync,mkdirSync} from 'node:fs';import {createServer} from 'node:http';
const h=readFileSync(process.argv[2]||'world-editor.html','utf8'),anchor="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(h.split(anchor).length,2);
const html=h.replace(anchor,anchor+`
 envelopeZoom:()=>{zoom=.155;cursorDirty=true;},
 envelopeQA:()=>{
  const yaw=poiCameraYaw,arrows=['Up','Down','Left','Right'],k=poiKingdomData(facilitySite);
  return {pos:[poiWalkX,poiWalkZ],top:cameraTopDown,zoom,geometry:poiKingdomGPU?.count??0,
   bounds:k.bounds,wards:k.sectors.length,kingdom:poiKingdomContains(facilitySite,poiWalkX,poiWalkZ,0),gates:k.enclosureGates,
   apron:poiWalkCanStep(246,116),wall:poiWalkCanStep(242,109),
   east:arrows.find((_,i)=>poiCameraRelativeStep(['n','s','w','e'][i]).join()==='1,0'),
   west:arrows.find((_,i)=>poiCameraRelativeStep(['n','s','w','e'][i]).join()==='-1,0'),gl:gl.getError()};
 },
 `);
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,...(process.env.CI_CHROME?{executablePath:process.env.CI_CHROME}:{}),
  args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 mkdirSync('envelope-shots',{recursive:true});
 for(const [name,x,z,yaw,pitch,distance] of [['east',239,112,-Math.PI/2,.33,6.5],['overview',207,89,0,.42,5.4]]){
  const ctx=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:.88});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(url+'/seed');
  await page.evaluate(({x,z,yaw,pitch,distance,top})=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x,z,y:0,facing:1},
    townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:top?.155:1.05,panX:0,panZ:0,level:0,hideUpper:false,top,third:!top,orbitYaw:yaw,orbitPitch:pitch,orbitDistance:distance}})),{x,z,yaw,pitch,distance,top:name==='overview'});
  await page.goto(url+'/?resume=1&test=1',{waitUntil:'domcontentloaded'});
  await page.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
  if(name==='overview')await page.evaluate(()=>window.__editorTest.envelopeZoom());
  const get=()=>page.evaluate(()=>window.__editorTest.envelopeQA());const st=await get();console.log(name,st);
  a.deepEqual(st.pos,[x,z]);a.equal(st.kingdom,true);a.equal(st.apron,true);a.equal(st.wall,false);a.equal(st.gl,0);
  a.equal(st.wards,4);a(st.geometry>100);if(name==='overview'){a.equal(st.top,true);a(st.zoom<.2);await page.waitForTimeout(800)}
  await page.screenshot({path:'envelope-shots/'+name+'.png'});
  if(name==='east'){
   const walk=async (dir,x)=>{for(let n=0;n<30;n++){
    const q=await get();if(q.pos[0]===x)return q;
    await page.keyboard.press('Arrow'+dir);await page.waitForTimeout(180);
   }throw Error(JSON.stringify(await get()));};
   const exit=await walk(st.east,246);a.deepEqual(exit.pos,[246,z]);a.equal(exit.kingdom,false);
   await page.screenshot({path:'envelope-shots/east-outside.png'});
   const back=await walk(st.west,240);a.deepEqual(back.pos,[240,z]);a.equal(back.kingdom,true);
  }
  a.deepEqual(errors,[]);await ctx.close();
 }
}finally{await b?.close();await new Promise(r=>server.close(r));}
