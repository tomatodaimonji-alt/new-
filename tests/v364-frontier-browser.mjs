import a from 'node:assert/strict';import {chromium} from 'playwright';
import {readFileSync,mkdirSync} from 'node:fs';import {createServer} from 'node:http';
let html=readFileSync('world-editor.html','utf8'),hook="if(facilityParams.get('test')==='1')window.__editorTest={";
a.equal(html.split(hook).length,2);
html=html.replace(hook,hook+`
 frontierQA:{state:()=>({id:facilitySite.id,x:poiWalkX,z:poiWalkZ,active:poiWalkActive,view:$('poiThirdView').textContent,
   ground:sceneMesh?.ground?.count,height:poiCreekPlayerHeight(performance.now()),water:frontierWaterMesh?.count, fence:frontierVillageMesh?.count,inside:facilityHiddenRoof(),gl:gl.getError(),haze:poiFieldHazeFrame?.id??null,
   ui:!$('poiAnalogPad').hidden&&!$('poiBagToggle').hidden, kit:poiHotbarHasKit(),
   min:poiMiniSnapshot()?.local?.known||0,playArea:[MAP_W,MAP_H],
   old:window.localStorage.getItem('world-workshop-resume-v1'),new:localStorage.getItem(WORKSHOP_RESUME_KEY)}),
  step:poiWalkStep,turn:a=>{yaw=a;poiCameraYaw=a;poiWalkCamera();},
  walkable:poiWalkCanStep, stand:(x,z,facing=1)=>workshopResumeRestorePosition({x,z,y:0,facing}),
  outerView:()=>{zoom=.18;yaw=.31;}, stepSlope:(x,z)=>frontierSampleHeight(x+.5,z+.5), npc:()=>poiTownDialogueSnapshot(),
  doorRoof:()=>{const b=facilitySite.buildings[0];return [poiValdiaHomeGeometry({...b,h:3.248},0).p.length,poiValdiaHomeGeometry({...b,h:3.248},1).p.length,poiValdiaHomeGeometry({...b,h:3.248,cutToFloor:false},1).p.length]} },
`.replace("$('poiBagToggle')","$('poiBagToggle')"));
const s=createServer((req,res)=>{res.setHeader('Content-Type','text/html;charset=utf-8');res.end(req.url==='/seed'?'<title>Seed</title>':html)});
await new Promise(r=>s.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+s.address().port;let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 mkdirSync('frontier-shots',{recursive:true});
 const c=await b.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const p=await c.newPage(),errors=[];p.on('pageerror',e=>{console.log(e.stack);errors.push(e.message)});
 await p.goto(url+'/seed');await p.evaluate(()=>localStorage.setItem('world-workshop-resume-v1','old-saved-world'));
 await p.goto(url+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 const q=()=>p.evaluate(()=>window.__editorTest.frontierQA.state());
 const state=await q();console.log('start',state);
 a.equal(state.id,'frontier');a.deepEqual(state.playArea,[128,64]);a.equal(state.view,'視点：俯瞰');
 a(state.active && state.ground>49152&&state.ground<220000 && state.kit && state.ui && state.min>0);
 a.equal(state.old,'old-saved-world');a.equal(state.gl,0);a(state.water>3000&&state.water<85000);a(state.fence>1000&&state.fence<32000);
 const roofs=await p.evaluate(()=>window.__editorTest.frontierQA.doorRoof());
 a(roofs[0]>roofs[2]&&roofs[2]>roofs[1],'house builds a full exterior and fully cut walls from indoors');
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(49,28,3));
 console.log('resident interaction',await p.evaluate(()=>({label:document.getElementById('poiWalkAction').textContent,actors:window.__editorTest.townResidents().actors.map(a=>[a.id,a.x,a.z]),pos:window.__editorTest.frontierQA.state().x})));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent.includes('話す'));
 await p.locator('#poiWalkAction').tap();
 await p.locator('#poiNpcMenu [data-npc-action=talk]').tap();
 await p.waitForFunction(()=>window.__editorTest.frontierQA.npc()?.text.includes('東の丘'));
 await p.evaluate(()=>window.__editorTest.frontierQA.step(1,0));
 await p.waitForFunction(()=>!window.__editorTest.frontierQA.npc());
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(74,32,1));
 await p.waitForFunction(()=>document.getElementById('poiWalkAction').textContent.includes('話す'));
 await p.locator('#poiWalkAction').tap();
 await p.locator('#poiNpcMenu [data-npc-action=talk]').tap();
 await p.waitForFunction(()=>window.__editorTest.frontierQA.npc()?.text.includes('南北の湖'));
 await p.evaluate(()=>window.__editorTest.frontierQA.step(-1,0));
 await p.waitForFunction(()=>!window.__editorTest.frontierQA.npc());
 await p.evaluate(()=>{
  const qa=window.__editorTest.frontierQA;
  for(let z=12;z<=20;z++)for(let x=25;x<=30;x++)if(qa.walkable(x,z)&&qa.stepSlope(x,z)>1.4){qa.stand(x,z);return}
 });
 await p.waitForFunction(()=>window.__editorTest.frontierQA.state().height>1.4);
 await p.screenshot({path:'frontier-shots/hill.png'});
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(51,30));

 a.equal(await p.evaluate(()=>window.__editorTest.canStep(63,24)),false);
 a.equal(await p.evaluate(()=>window.__editorTest.canStep(64,30)),true);
 a.equal(await p.evaluate(()=>window.__editorTest.canStep(-1,30)),false);
 await p.screenshot({path:'frontier-shots/spawn.png'});
 await p.evaluate(()=>window.__editorTest.frontierQA.outerView());
 await p.screenshot({path:'frontier-shots/background-overview.png'});
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(30,30));
 const walkBy=async(dx,dz,count)=>{
  for(let i=0;i<count;i++){await p.evaluate(([dx,dz])=>window.__editorTest.frontierQA.step(dx,dz),[dx,dz]);await p.waitForTimeout(220)}
 };
 await walkBy(1,0,6);
 a.equal((await q()).x,36,'western entrance connects to the road');
 await walkBy(-1,0,6);a.equal((await q()).x,30,'western entrance also exits');
 a.equal(await p.evaluate(()=>window.__editorTest.canStep(44,18)),false,'north fence blocks walking');
 a.equal(await p.evaluate(()=>window.__editorTest.canStep(44,42)),false,'south fence blocks walking');
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(53,30));
 await walkBy(1,0,6);
 a.equal((await q()).x,59,'eastern entrance connects to bridge');
 await walkBy(-1,0,6);a.equal((await q()).x,53,'eastern entrance also enters');
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(41,38,0));
 await walkBy(0,-1,2);
 a.equal((await q()).z,36);a.equal((await q()).inside,2,'workshop uses indoor cutaway');
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(47,30));
 await p.screenshot({path:'frontier-shots/village.png'});
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(59,30));
 const cross=async dir=>{
   for(let i=0;i<9;i++){
    await p.evaluate(dir=>window.__editorTest.frontierQA.step(dir,0),dir);
    await p.waitForTimeout(215);
   }
 };
 await cross(1);
 const east=await q();console.log('east',east);
 a.equal(east.x,68);a.equal(east.z,30);a.equal(east.ground,state.ground);a.equal(east.id,state.id);
 await p.screenshot({path:'frontier-shots/bridge-overview.png'});
 await p.locator('#poiLandscapeMenuToggle').click();
 await p.locator('#poiLandscapeMenu [data-landscape-action=view]').click();
 await p.locator('#poiLandscapeMenuToggle').click();
 await p.waitForFunction(()=>window.__editorTest.frontierQA.state().haze==='frontier');
 a.equal((await q()).view,'視点：三人称');
 for(const [i,angle] of [0,Math.PI/2,Math.PI,Math.PI*1.5].entries()){
  await p.evaluate(angle=>window.__editorTest.frontierQA.turn(angle),angle);
  await p.screenshot({path:'frontier-shots/bridge-third-'+i+'.png'});
 }
 await cross(-1);
 a.equal((await q()).x,59);
 await p.evaluate(()=>window.__editorTest.frontierQA.stand(46,27));
 for(let i=0;i<3;i++){await p.evaluate(()=>window.__editorTest.frontierQA.step(0,-1));await p.waitForTimeout(250)}
 const home=await q();a.equal(home.z,24);a.notEqual(home.inside,null);
 await p.screenshot({path:'frontier-shots/house.png'});
 await p.reload({waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:30000});
 const restored=await q();console.log('restored',restored);
 a.equal(restored.old,'old-saved-world');a.equal(restored.x,46);a.equal(restored.z,24);
 a.equal(restored.view,'視点：三人称');a.equal(restored.gl,0);
 a.deepEqual(errors,[]);
}finally{await b?.close();await new Promise(r=>s.close(r))}
