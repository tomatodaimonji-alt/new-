const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);

h=h.replace(mark,mark+`
 qa413:()=>{
  if(facilitySite?.id!=='frontier'||!poiWalkActive)return null;
  const r=poiTownNpcActors.find(a=>a.role.id==='frontierren');if(!r)return null;
  const x=FRONTIER_BRIDGE.west-1,z=FRONTIER_BRIDGE.south;
  return {post:[r.x,r.z,r.facing],home:[r.role.home.x,r.role.home.z],bank:frontierRiver(x+.5,z+.5),
    clear:poiTownNpcStance(r.role.public),main:[29,30,31].every(z=>poiWalkCanStep(x,z,x-1,z,null,false,true,false)),
    deck:facilitySite.decks.has(x+','+z)}
 },
`);
const server=createServer((_,r)=>{r.setHeader('Content-Type','text/html;charset=utf-8');r.end(h)});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const p=await b.newPage({viewport:{width:844,height:390},isMobile:true,hasTouch:true}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
 await p.goto('http://127.0.0.1:'+server.address().port+'/?test=1',{waitUntil:'domcontentloaded'});
 await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:40000});
 await p.waitForFunction(()=>window.__editorTest?.qa413?.(),null,{timeout:30000});
 const r=await p.evaluate(()=>window.__editorTest.qa413());console.log(r);
 a.deepEqual(r.post,[122,32,0]);a.deepEqual(r.home,[106,36]);a.ok(r.bank>0&&r.clear&&r.main&&!r.deck);a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
