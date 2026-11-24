const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function run(){
 const i=html.indexOf('// BEGIN DAVID RAISED STONE'),j=html.indexOf('// END DAVID RAISED STONE',i);
 const deps=html.slice(html.indexOf('const ROAD_BASES='),html.indexOf('function pineBaseNatureTint('));
 const terrain=[],allowed='roadAncientFull',world=[];
 for(let z=-8;z<9;z++)for(let x=-8;x<9;x++)world.push({x,z,y:0,type:x<0?'roadRoyalFull':allowed});
 const ctx={world,MAP_W:128,MAP_H:128,terrainY:()=>0,mesh:()=>({p:[],c:[]}),isFloor:()=>true,surfaceNoise:()=>.51,
  tri(m,p,q,r,c){m.p.push(...p,...q,...r);m.c.push(...c,...c,...c)},
  quad(m,p,q,r,s,c){ctx.tri(m,p,q,r,c);ctx.tri(m,p,r,s,c)},
  poiAimWall:()=>()=>true,poiDavidArena:()=>null,poiDavidIn:()=>true,
  poiDavidRoomRay:(o,b,d,r)=>ctx.wall&&d.x>0?Math.min(r,.88):r};
 const api=vm.runInNewContext(deps+html.slice(i,j)+';({geometry:poiDavidRaisedStoneGeometry,road:roadTile})',ctx);
 const effect=leap=>({x:.28,z:.49,y:0,sx:0,sz:0,leap,radius:leap?7:6});
 return {api,effect,ctx};
}
test('cracked broad tile plates and tiny rubble use exact local road paint and vary visibly between seismic attacks',()=>{
 const {api,effect,ctx}=run(),s=api.geometry(effect(false),{}),l=api.geometry(effect(true),{});
 const source=ctx.mesh();api.road(source,-1,0,'roadRoyalFull',0,128*128);api.road(source,0,0,'roadAncientFull',0,128*128);
 const rgb=m=>new Set(m.c.reduce((a,_,i)=>i%3?a:a.concat(m.c.slice(i,i+3).join(',')),[]));
 const paint=rgb(source),found=rgb(l);
 a(l.broken.slabs>=s.broken.slabs+1&&l.broken.chips>s.broken.chips);
 a(s.broken.width>.95&&l.broken.width>s.broken.width+.25&&l.broken.height<.78,'slabs visibly wide, not tall conical caps');
 a([...paint].filter(c=>found.has(c)).length>=4,'road tile top paint and trim colors survive exact clipping');
 ctx.wall=true;const clipped=api.geometry(effect(true),{});
 a(clipped.p.length<l.p.length);for(let j=0;j<clipped.p.length;j+=3){
  const x=clipped.p[j]-.5,z=clipped.p[j+2]-.5,r=Math.hypot(x,z);a(r<=7+1e-8);a(x<=1e-8||r<=.88+1e-8);
 }
});
test('only the exact lethal leap has persistent fissure geometry until the black relocation frame',()=>{
 const i=html.indexOf('function poiDavidPinFatalFracture('),j=html.indexOf('function poiDavidImpactVisible(',i);
 a(i>0&&j>i,'exact lethal leap VFX persistence path absent');
 const e={start:100,leap:true},d={start:100,phase:'pause',relocated:false};
 const c={poiDavidFissure:e,poiPlayerDeath:d};
 const {pin,keep}=vm.runInNewContext(html.slice(i,j)+';({pin:poiDavidPinFatalFracture,keep:poiDavidKeepFatalFracture})',c);
 pin(99);a.equal(keep(e),false);
 pin(100);a.equal(keep(e),true);
 d.phase='out';a.equal(keep(e),true);
 c.poiPlayerDeath={start:100,phase:'pause',relocated:false};a.equal(keep(e),false,'an unrelated replacement cannot revive the packet');
 c.poiPlayerDeath=d;d.phase='black';d.relocated=true;a.equal(keep(e),false);
 d.phase='in';a.equal(keep(e),false);
 e.leap=false;d.phase='pause';d.relocated=false;e.fatalDeath=null;pin(100);a.equal(keep(e),false);
});
