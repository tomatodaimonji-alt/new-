from pathlib import Path
import sys
root=Path(__file__).parent
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1:raise SystemExit(f'expected one anchor ({s.count(a)}), {a[:160]}')
 s=s.replace(a,b,1)
rep('base:{x:49,z:127},snow:{x:12,z:0}','base:{x:60,z:138},snow:{x:12,z:0}')
rep('function poiSnowPassLink(region,x,z,y,nx,nz){','''function poiSnowSleeveOwn(x,z){
 return x>=48&&x<64&&z>=128&&z<139;
}
function poiSnowSleeveRoute(){
 const knots=[[49,128],[49,130],[52,130],[52,132],[57,132],[57,135],[60,135],[60,138]],out=[];
 let [x,z]=knots[0];out.push({x,z,y:0});
 for(const [tx,tz] of knots.slice(1))while(x!==tx||z!==tz){
  x+=Math.sign(tx-x);z+=Math.sign(tz-z);out.push({x,z,y:0});
 }
 return out;
}
function poiSnowPassLink(region,x,z,y,nx,nz){''')
rep(" return world.some(o=>o.x===49&&o.z===127&&o.y===0&&o.type==='roadGravelFull');",
''' // Shape the uphill approach on the empty east side of the sacred lobe.
 // A separate region is not created; the original road remains traversable.
 const lane=new Set(poiSnowSleeveRoute().map(p=>p.x+','+p.z));
 for(let z=128;z<=138;z++)for(let x=48;x<64;x++){
  const key=x+','+z;
  if(own.has(key))continue;
  const type=lane.has(key)?'roadGravelFull':z>=136?'poiSnowGround':(x*7+z*17)%9<3?'grassPebbles':'grass';
  world.push({x,z,y:0,type,rot:0});own.add(key);
 }
 return world.some(o=>o.x===60&&o.z===138&&o.y===0&&o.type==='roadGravelFull');''')
rep('(MAP_W!==128||MAP_H!==182||z<128||x<48);',
    "(MAP_W!==128||MAP_H!==182||z<128||x<48||typeof poiSnowSleeveOwn==='function'&&poiSnowSleeveOwn(x,z));")
rep('return !!lobe&&z>=lobe.oldH&&x>=lobe.w;',
    "return !!lobe&&z>=lobe.oldH&&x>=lobe.w&&!(typeof poiSnowSleeveOwn==='function'&&poiSnowSleeveOwn(x,z));")
rep('for(let x=0,cols=MAP_W===128&&MAP_H===182&&z>=128?48:MAP_W;x<cols;x++){',
    'for(let x=0,cols=MAP_W===128&&MAP_H===182&&z>=128?(z<139?64:48):MAP_W;x<cols;x++){')
rep('const outsideLobe=p=>p?.z>=128&&p.x>=POI_SACRED_DEPTH_W;',
    "const outsideLobe=p=>p?.z>=128&&p.x>=POI_SACRED_DEPTH_W&&!(typeof poiSnowSleeveOwn==='function'&&poiSnowSleeveOwn(p.x,p.z));")
rep('p.x<POI_SACRED_DEPTH_W&&p.z<POI_SACRED_DEPTH_H',
    "(p.x<POI_SACRED_DEPTH_W||typeof poiSnowSleeveOwn==='function'&&poiSnowSleeveOwn(p.x,p.z))&&p.z<POI_SACRED_DEPTH_H")
rep("p.x>=0&&p.x<48&&p.z>=128&&p.z<182;",
    "p.x>=0&&p.z>=128&&p.z<182&&(p.x<48||typeof poiSnowSleeveOwn==='function'&&poiSnowSleeveOwn(p.x,p.z));")
rep("poiSnowPassChange({region:'base',x:49,z:127,facing:0},performance.now())",
    "poiSnowPassChange({region:'base',...POI_SNOW_PASS.base,facing:0},performance.now())")
# Keep the new world's template marker on durable direct seam writes too.
rep("  ...(dest.region==='snowpass'?{region:'snowpass',regionHp:poiPlayerHP}:{})};",
    "  ...(dest.region==='snowpass'?{region:'snowpass',regionHp:poiPlayerHP}:{templeDepth:1})};")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
