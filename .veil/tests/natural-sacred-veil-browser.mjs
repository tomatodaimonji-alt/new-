import a from 'node:assert/strict';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {Script} from 'node:vm';
function instrument(f){
 let h=readFileSync(f,'utf8');
 const put=(s,t)=>{a.equal(h.split(s).length,2,s);h=h.replace(s,t)};
 const api="if(facilityParams.get('test')==='1')window.__editorTest={";
 put(api,api+`
 naturalVeilQA:()=>{window.__naturalMeasure=true;render();window.__naturalMeasure=false;return window.__naturalData},
 `);
 put('function render(){',`
 let poiNaturalQA=null;
 function poiNaturalQADraw(p){
  const id=facilitySite?.id,base=id==='snowpass'?poiSnowPassBase:null;
  const source=base?.world??world,site=base?.site??facilitySite,t=site?.davidTemple;
  if(!t)return;
  if(poiNaturalQA?.source!==source){
   if(poiNaturalQA?.mesh)gl.deleteBuffer(poiNaturalQA.mesh.buf);
   const m=mesh();
   for(const o of source){
    if(!poiSacredTempleVisualMember(site,o)||!/^poiDavid(?:Wall|GatePier|TunnelRoof|SacredRoof)/.test(o.type))continue;
    const x=o.x+.5,z=o.z+.5,type=o.type,r=o.rot||0,at=m.c.length;
    if(type==='poiDavidSacredRoof')poiDavidSacredRoofGeometry(m,x,z);
    else if(type==='poiDavidTunnelRoof'||type==='poiDavidWallHeader')poiDavidTunnelArt(m,type,x,0,z,r);
    else deco(m,type,x,o.y*1.4,z,r);
    for(let i=at;i<m.c.length;i+=3){m.c[i]=1;m.c[i+1]=type==='poiDavidSacredRoof'?.04:1;m.c[i+2]=type==='poiDavidSacredRoof'?1:.04}
   }
   poiNaturalQA={source,mesh:upload(m)};
  }
  // QA-only bypass of directional visibility: identical real stock geometry
  // projected to either active coordinate space, tested against actual depth.
  gl.uniform3f(loc.sacredFog,0,0,0);gl.uniform4f(loc.sacredEdge,0,0,0,0);
  gl.uniform1f(loc.sacredTempleHide,0);
  gl.uniform3f(loc.daylight,1,1,1);
  gl.depthFunc(gl.LEQUAL);
  try{draw(poiNaturalQA.mesh,poiOverlandNeighborVP(p.vp,id,'base'))}
  finally{gl.depthFunc(gl.LESS)}
  const w=gl.drawingBufferWidth,h=gl.drawingBufferHeight,buf=new Uint8Array(w*h*4);
  gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,buf);
  let roof=0,wall=0;
  for(let k=0;k<buf.length;k+=4){
   if(buf[k]<120||buf[k+3]<250)continue;
   if(buf[k+1]<80&&buf[k+2]>120)roof++;
   if(buf[k+1]>120&&buf[k+2]<80)wall++;
  }
  window.__naturalData={roof,wall,w,h,err:gl.getError(),x:poiWalkViewX,z:poiWalkViewZ,eye:p.eye,stream:poiOverlandDrawing,
   sameGeometry:poiNaturalQA.mesh.count,orchard:site.sacredForest.concealment?.trees.length||0};
 }
 function render(){`);
 const target=" if(typeof poiOutdoorLate==='function')poiOutdoorLate(p.vp,stream);";
 put(target,target+"\n if(window.__naturalMeasure)poiNaturalQADraw(p);");
 for(const[,js] of h.matchAll(/<script(?: [^>]*)?>([\s\S]*?)<\/script>/g))new Script(js);
 return h;
}
const cases=[
 {key:'snow',x:2,z:19,yaw:-Math.PI/2,realm:'snowpass'},
 {key:'northeast',x:59,z:126,yaw:-.79},
 {key:'forest-north',x:24,z:114,yaw:0},
 {key:'west',x:1,z:155,yaw:Math.PI/2},
 {key:'south',x:24,z:180,yaw:Math.PI},
 {key:'actual-entry',x:24,z:125,yaw:0}
];
const variants=Object.fromEntries([['stock',instrument(process.argv[2])],['preview',instrument(process.argv[3])]]);
if(process.env.NATURAL_VEIL_SYNTAX_ONLY)process.exit(0);
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_PACKAGE??'playwright');
const server=createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end(variants[req.url.split('?')[0].slice(1)]||'<title>seed</title>')});
await new Promise((r,j)=>server.listen(0,'127.0.0.1',r).once('error',j));const origin='http://127.0.0.1:'+server.address().port;
let b;
try{
 b=await chromium.launch({headless:true,args:['--enable-webgl','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 for(const t of cases){
  const results={};
  for(const mode of ['stock','preview']){
   const ctx=await b.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:.65});
   try{
    const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
    await p.goto(origin+'/seed');await p.evaluate(({x,z,yaw,realm})=>{
     localStorage.setItem('world-workshop-town-clock-v1','{"version":1,"gameMs":390000}');
     localStorage.setItem('world-workshop-resume-v1',JSON.stringify({version:1,route:'facility',id:'base',play:true,
      ...(realm?{region:realm,regionHp:100}:{}),position:{x,z,y:0,facing:2},townLayout:5,townMapHeight:182,templeDepth:1,
      view:{yaw:0,zoom:1,panX:0,panZ:0,level:0,hideUpper:false,top:false,third:true,orbitYaw:yaw,orbitPitch:.14,orbitDistance:5.6}}));
    },t);
    await p.goto(origin+'/'+mode+'?resume=1&test=1');await p.locator('#pineStartupCover').waitFor({state:'hidden',timeout:25000});
    await p.waitForTimeout(1250);
    const frame=await p.evaluate(()=>window.__editorTest.naturalVeilQA());
    a(frame.sameGeometry>1000&&frame.err===0&&Math.abs(frame.x-t.x)<.1&&Math.abs(frame.z-t.z)<.1,JSON.stringify(frame));
    results[mode]=frame;
    if(process.env.FACILITY_SCREENSHOTS){
     mkdirSync(process.env.FACILITY_SCREENSHOTS,{recursive:true});await p.screenshot({path:process.env.FACILITY_SCREENSHOTS+'/'+mode+'-'+t.key+'.png'});
    }
    a.deepEqual(errors,[]);
   }finally{await ctx.close()}
  }
  const {stock,preview}=results;
  const reduction=(x,y)=>x?Math.round(100*(x-y)/x):null;
  a.equal(stock.sameGeometry,preview.sameGeometry);
  a(preview.orchard>20&&stock.orchard===0);
  console.log('Authored temple physical coverage (no visibility gates)',JSON.stringify({case:t.key,...results,roofDrop:reduction(stock.roof,preview.roof),wallDrop:reduction(stock.wall,preview.wall)}));
 }
}finally{await b?.close();await new Promise(r=>server.close(r))}
