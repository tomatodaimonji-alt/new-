const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let html=fs.readFileSync('world-editor.html','utf8');
a.equal(html.split(mark).length,2);
html=html.replace(mark,mark+`
 qa396:{
  ready:()=>facilitySite?.id==='frontier'&&poiWalkActive&&poiTownNpcActors.some(a=>a.role.id===POI_FRONTIER_SHOP_ID),
  position:()=>({x:poiWalkX,z:poiWalkZ,y:poiWalkLevel,hp:poiPlayerHP,name:$('poiLocationName').textContent}),
  bridge:()=>{
   poiMonsterStates.clear();
   const b=FRONTIER_BRIDGE,w=Math.ceil(frontierRiverCenter(27));
   return {b,dry:[poiWalkCanStep(b.west-1,30),poiWalkCanStep(b.east,30)],wet:poiWalkCanStep(w,27),
    crossing:Array.from({length:b.east-b.west},(_,i)=>poiWalkCanStep(b.west+i,30)),
    start:workshopResumeRestorePosition({x:b.west-1,z:30,y:0,facing:1})};
  },
  water:()=>{
   const m=mesh();frontierWaterSurface(m);
   const ranges=[[0,19],[22,43],[48,64]].map(([lo,hi])=>m.p.filter((_,i)=>i%3===2&&m.p[i]>=lo&&m.p[i]<=hi).length);
   return {ranges,n:m.p.length,uniform:!!loc.frontierWater,error:gl.getError()};
  },
  recruitRoute:()=>{
   const n=poiTownNpcActors.find(a=>a.role.id==='frontiersera');
   return n?{x:n.x,z:n.z,facing:n.facing}:null;
  }
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(html)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true});const errors=[];
 p.setDefaultTimeout(12000);p.on('pageerror',e=>{errors.push(e.message);console.log(e.stack)});
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:35000});
 await p.waitForFunction(()=>window.__editorTest?.qa396.ready());
 const run=name=>p.evaluate(name=>window.__editorTest.qa396[name](),name);
 const start=await run('position');console.log('AT START',start);
 a.equal(start.hp,100);a.equal(start.name,'リネア村');
 await p.locator('#poiBagToggle').tap();
 await p.locator('#poiBagPanel').waitFor({state:'visible'});
 a.equal(await p.locator('#poiBagPlayerSpeedValue').textContent(),'★★★★★☆☆☆☆☆');
 await p.locator('#poiBagToggle').tap();
 await p.locator('#poiBagPanel').waitFor({state:'hidden'});
 const surface=await run('water');a(surface.ranges.every(n=>n>150)&&surface.uniform&&surface.error===0,JSON.stringify(surface));
 const route=await run('bridge');console.log('BRIDGE',route);a(route.dry.every(Boolean)&&route.crossing.every(Boolean)&&!route.wet&&route.start);
 await p.keyboard.down('ArrowRight');
 try{await p.waitForFunction(x=>window.__editorTest.qa396.position().x>=x,route.b.east,{timeout:15000});}
 finally{await p.keyboard.up('ArrowRight')}
 const finish=await run('position');console.log('AT EAST BANK',finish);
 a(finish.x>=route.b.east&&finish.z===30&&finish.hp===100);
 await p.locator('#poiMiniOpen').tap();
 await p.locator('#poiLocalMapDialog').waitFor({state:'visible'});
 await p.locator('#poiLocalMapClose').tap();
 await p.locator('#poiLocalMapDialog').waitFor({state:'hidden'});
 a.deepEqual(errors,[]);
 console.log('PASS landscape playtest: village start, inventory, river mesh and shader, walked bridge, opened and closed map');
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
