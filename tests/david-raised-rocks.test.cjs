const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function engine(){
 const i=h.indexOf('// BEGIN DAVID RAISED STONE'),j=h.indexOf('// END DAVID RAISED STONE');
 a(i>0&&j>i,'actual raised temporary stone feature missing');
 let calls=[];
 const owner={davidTemple:{boss:{}}},c={facilitySite:owner,poiDavidFissure:null,poiEnemyCueReduced:{matches:false},poiDavidImpactVisible:()=>c.visible,visible:true,blocked:false,
  mesh:()=>({p:[]}),tri:(m,...v)=>m.p.push(...v.slice(0,3).flat()),quad:(m,...v)=>{c.tri(m,v[0],v[1],v[2]);c.tri(m,v[0],v[2],v[3])},
  terrainY:()=>0,poiAimWall:()=>()=>false,poiDavidArena:()=>null,poiDavidIn:(_,p)=>p.z>=-10&&p.x>=-10,
  poiDavidRoomRay:(_,b,d,r)=>c.blocked&&d.x>0?Math.min(r,1):r,
  upload:(m,buf)=>{calls.push(['upload',m.p.length]);return {buf:buf??{},count:m.p.length/3}},
  draw:(g,v)=>calls.push(['draw',g.count,v[13]]),gl:{STATIC_DRAW:1,deleteBuffer:()=>calls.push(['delete'])},
  vp:Float32Array.from([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1])};
 Object.assign(c,{MAP_W:128,MAP_H:128,isFloor:()=>true,surfaceNoise:()=>.51,world:[]});
 for(let x=-8;x<=8;x++)for(let z=-8;z<=8;z++)c.world.push({x,z,y:0,type:'roadAncientFull'});
 const art=h.slice(h.indexOf('const ROAD_BASES='),h.indexOf('function pineBaseNatureTint('));
 const raw=c.mesh;c.mesh=()=>({...raw(),c:[]});
 const tri=c.tri;c.tri=(m,a,b,d,color)=>{tri(m,a,b,d);m.c.push(...color,...color,...color)};
 c.quad=(m,a,b,d,e,col)=>{c.tri(m,a,b,d,col);c.tri(m,a,d,e,col)};
 const m=vm.runInNewContext(art+h.slice(i,j)+';({geometry:poiDavidRaisedStoneGeometry,draw:poiDrawDavidRaisedStone})',c);
 const impact=(leap)=>({x:.63,z:.85,sx:0,sz:0,y:0,start:10,owner,leap,radius:leap?7:6,fissureMs:leap?1510:1200});
 return {m,c,calls,impact};
}
test('both impacts have real three dimensional stone, with a bigger leap packet; no rock vertices through walls or outside physical radius',()=>{
 const {m,c,impact}=engine();
 const normal=m.geometry(impact(false),{}).p,leap=m.geometry(impact(true),{}).p;
 const maxHeight=p=>Math.max(...p.filter((_,i)=>i%3===1));
 a(normal.length>500);a(leap.length>normal.length*1.45);a(maxHeight(normal)>.25);a(maxHeight(leap)>maxHeight(normal)+.12);
 c.blocked=true;const clipped=m.geometry(impact(true),{}).p;
 a(clipped.length>0&&clipped.length<leap.length);
 for(let i=0;i<clipped.length;i+=3){
  const x=clipped[i]-.5,z=clipped[i+2]-.5,r=Math.hypot(x,z);
  a(r<=7);a(x<=1e-6||r<=1+1e-6,'vertices must fit within same gameplay LOS');
 }
});
test('the temporary opaque packet rises and settles using one actual upload, rendering only within lifetime',()=>{
 const {m,c,calls,impact}=engine();const e=c.poiDavidFissure=impact(true);
 m.draw(9,c.vp);a.equal(calls.length,0);
 m.draw(70,c.vp);m.draw(340,c.vp);m.draw(1410,c.vp);
 const heights=calls.filter(x=>x[0]==='draw').map(x=>x[2]);
 a.equal(heights.length,3);a(heights[0]<heights[1]&&heights[2]<heights[1]);
 a.equal(calls.filter(x=>x[0]==='upload').length,1);
 c.visible=false;m.draw(1450,c.vp);
 a.equal(calls.filter(x=>x[0]==='draw').length,3);
 c.poiDavidFissure=null;m.draw(10+e.fissureMs,c.vp);
 a.equal(calls.at(-1)[0],'delete');
 a.equal(c.vp[13],0,'shared view matrix remains unmodified');
});
