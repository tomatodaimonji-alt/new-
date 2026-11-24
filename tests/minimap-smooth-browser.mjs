import assert from 'node:assert/strict';import {createServer} from 'node:http';import {createRequire} from 'node:module';import {readFileSync} from 'node:fs';import {Script} from 'node:vm';
let html=readFileSync(process.argv[2]??'world-editor.html','utf8');
function inject(a,b){assert.equal(html.split(a).length,2,a);html=html.replace(a,b)}
const seam="if(facilityParams.get('test')==='1')window.__editorTest={";
inject(seam,seam+`
 minimapSmoothQA:()=>{
  const f=poiLocalFrame,c=$('poiMiniMap'),last=poiLocalHudLast,layer=poiLocalHudLayer,pt=f&&poiLocalMotionPoint(f),old=poiMiniSnapshot();
  return {pose:[poiWalkViewX,poiWalkViewZ],cell:[poiWalkX,poiWalkZ],held:!!poiAnalogContact,
   drawn:last&&[last.x,last.z,last.angle],project:f&&poiLocalHudProjection(f,{scale:c.height/POI_LOCAL_SIDE},pt),
   raster:window.__miniSmoothRaster??0,crop:f?.crop,topology:old?.topologyBuilds,overlay:old?.overlay,marker:poiLocalOverlay?.frame.marker};
 },
`);
inject(" return poiLocalHudLayer={layer,frame,cv,w:hud.width,h:hud.height,pad};"," window.__miniSmoothRaster=(window.__miniSmoothRaster??0)+1;\n return poiLocalHudLayer={layer,frame,cv,w:hud.width,h:hud.height,pad};");
for(const [,s] of html.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(s);
if(process.env.MINIMAP_PARSE)process.exit(0);
const {chromium}=createRequire(import.meta.url)('playwright');
const svc=createServer((r,s)=>{s.setHeader('Content-Type','text/html; charset=utf-8');s.end(r.url==='/seed'?'<title>seed</title>':html)});
await new Promise(r=>svc.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+svc.address().port;
let b,track=[];
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await b.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true});
 const p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(url+'/seed');
 await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:49,z:119,y:0,facing:2},
  townLayout:5,townMapHeight:182,templeDepth:1,view:{yaw:0,zoom:1.05,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:0,orbitPitch:.13,orbitDistance:6}})));
 await p.goto(url+'/?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:45000});
 await p.waitForFunction(()=>window.__editorTest?.minimapSmoothQA?.()?.drawn,null,{timeout:12000});
 const read=()=>p.evaluate(()=>window.__editorTest.minimapSmoothQA()),start=await read();
 assert.deepEqual(start.cell,[49,119]);
 const pad=await p.locator('#poiAnalogPad').boundingBox();assert(pad);
 const x=pad.x+pad.width*.5,y=pad.y+pad.height*.5,input=await c.newCDPSession(p);
 const contact=(type,touchPoints)=>input.send('Input.dispatchTouchEvent',{type,touchPoints});
 await contact('touchStart',[{x,y,id:8}]);await contact('touchMove',[{x:x+21,y:y-37,id:8}]);
 for(let i=0;i<45;i++){await p.waitForTimeout(24);track.push(await read());if(track.at(-1).cell[1]>=121)break;}
 await contact('touchEnd',[]);
 assert(track.some(q=>q.cell[1]>=120));assert(track.some(q=>Math.abs(q.pose[0]-49)>.06&&Math.abs(q.pose[1]-119)>.06));
 assert(track.every(q=>q.drawn?.slice(0,2).every((v,i)=>Math.abs(v-q.pose[i])<1e-8)));
 assert(track.some((q,i)=>i>0&&q.cell.every((v,k)=>v===track[i-1].cell[k])&&q.raster===track[i-1].raster&&q.project.z1!==track[i-1].project.z1));
 for(const q of track){assert.equal(q.topology,start.topology);assert(Math.abs(q.project.x1-(q.pose[0]-20))<1e-8);assert(Math.abs(q.project.z1-(q.pose[1]-20))<1e-8);}
 await p.locator('#poiMiniOpen').tap();const frozen=await read();assert(frozen.overlay&&frozen.marker);
 await p.locator('#poiLocalMapZoomIn').tap();const zoom=await read();
 assert.equal(zoom.overlay.view.zoom,2);assert.deepEqual(zoom.marker,frozen.marker);assert.deepEqual(zoom.overlay.crop,frozen.overlay.crop);
 assert.deepEqual(errors,[]);console.log('PASS actual diagonal thumb & subcell map across a committed boundary, same surveyed topology, no terrain reraster within a cell, overlay faithfully frozen and zoomable',JSON.stringify(track.slice(-3)));
}catch(e){console.error(JSON.stringify(track));throw e;}finally{await b?.close();await new Promise(r=>svc.close(r))}
