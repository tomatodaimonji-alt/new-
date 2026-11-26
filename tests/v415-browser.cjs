const a=require('node:assert/strict'),{chromium}=require('playwright'),fs=require('node:fs'),{createServer}=require('node:http');
const mark="if(facilityParams.get('test')==='1')window.__editorTest={";
let h=fs.readFileSync('world-editor.html','utf8');a.equal(h.split(mark).length,2);

h=h.replace(mark,mark+`
 qa413:()=>{
  if(facilitySite?.id!=='frontier'||!poiWalkActive)return null;
  const blade=id=>{const m=mesh();deco(m,id,0,0,0);return {vertices:m.p.length/3,width:Math.max(...m.p.filter((_,i)=>i%3===0))-Math.min(...m.p.filter((_,i)=>i%3===0))}};
  const held=id=>{const m=mesh();const p=poiBuildWorldSpear(m,null,{x:.28,y:.52,z:.06},(x,z)=>[x,z],0,0,0,id);return {vertices:m.p.length/3,len:Math.hypot(...p.tip.map((n,i)=>n-p.rear[i]))}};
  return {wood:blade('equipWoodSpear'),iron:blade('equipIronSpear'),woodHeld:held('equipWoodSpear'),ironHeld:held('equipIronSpear'),error:gl.getError()};
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
 a.ok(r.iron.width>r.wood.width*1.75);a.ok(r.ironHeld.vertices>r.woodHeld.vertices);a.ok(Math.abs(r.woodHeld.len-2.67)<1e-9&&Math.abs(r.ironHeld.len-2.67)<1e-9);a.equal(r.error,0);a.deepEqual(errors,[]);
}finally{await b?.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
