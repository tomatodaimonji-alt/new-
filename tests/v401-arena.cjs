const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);
h=h.replace(mark,mark+`
 qa398:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  enter:()=>{
   if(!workshopResumeRestorePosition({x:19,z:35,y:0,facing:0}))throw Error('approach not walkable');
   const before=[...poiMonsterStates].filter(([o])=>FRONTIER_RUINS.ARENA_MOBS.some(p=>o.x===p.x&&o.z===p.z)).map(([o,s])=>[o.x,o.z,o.type,s.hp,s.frontierRuins]);
   poiCameraYaw=0;poiCameraPitch=.23;poiWalkNextReady=0;poiWalkStep(0,1);
   return {before,entered:[poiWalkX,poiWalkZ],surface:frontierWalkSurface(19.5,36.5)};
  },
  foes:()=>[...poiMonsterStates].filter(([o])=>FRONTIER_RUINS.ARENA_MOBS.some(p=>o.x===p.x&&o.z===p.z)).map(([o,s])=>[o.x,o.z,s.x,s.z,Boolean(s.playerAttack?.pending)]),
  gl:()=>gl.getError()
 } ,
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.on('pageerror',e=>{errors.push(String(e.stack));console.error(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa398.ready(),null,{timeout:25000});
 fs.mkdirSync('screenshots',{recursive:true});
 const e=await p.evaluate(()=>window.__editorTest.qa398.enter());
 a.deepEqual(e.entered,[19,36]);a(e.surface<-4);
 a.equal(e.before.length,6);a(e.before.every(x=>x[3]>0&&x[4]));
 console.log('Room actors',e.before);
 await p.waitForTimeout(2200);
 const moves=await p.evaluate(()=>window.__editorTest.qa398.foes());
 console.log('Room combat',moves);
 a(moves.some(([x,z,u,v,atk])=>u!==x||v!==z||atk),'placed mobs must act in live room');
 a.equal(await p.evaluate(()=>window.__editorTest.qa398.gl()),0);
 await p.screenshot({path:'screenshots/combat-room.jpg',type:'jpeg',quality:91});
 console.log('PASS entered room without loading, found six enemies and observed active combat');
 a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
