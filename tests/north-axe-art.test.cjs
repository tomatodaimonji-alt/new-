const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.argv[2]||process.env.HTML||'world-editor.html','utf8');
const slice=(l,r)=>{const i=h.indexOf(l),j=h.indexOf(r,i+l.length);a(i>=0&&j>i,l);return h.slice(i,j)};
function get(edge=()=>true){
 const c={POI_NORTH_MINOTAUR_ATTACKS:{axe:{range:4}},poiNorthMinotaurMatch:()=>({y:-1,room:{minX:55,maxX:73,minZ:8,maxZ:22}}),
  poiAimWall:()=>edge,terrainY:()=>0};
 const src='function mesh(){return {p:[],n:[],c:[]}};'+slice('function tri(m,','function cube(m,')+
  slice('function poiNorthMinotaurArtPose(','function poiNorthMinotaurGeometry(')+
  slice('function poiAimWallLimit(','function poiAimChooseLock(')+slice('// BEGIN NORTH AXE FOOTPRINT','// END NORTH AXE FOOTPRINT');
 return vm.runInNewContext('const POI_AIM_EPS=1e-8;'+src+';({shape:poiNorthAxeFootprint,pose:poiNorthMinotaurArtPose,opacity:poiNorthAxeOpacity,geometry:poiNorthAxeCueGeometry})',c);
}
const attack={northAttack:'axe',sx:64,sz:13,dx:0,dz:1,y:-1,start:1000,hit:1850,pending:true};
test('continuous smooth 180-degree boundary reaches exactly four tiles and never includes the rear',()=>{
 const {shape}=get(),p=shape(attack);
 a(p.length>=33&&p.length<=240);
 a(p.every(v=>v.sz>=13-1e-7&&Math.hypot(v.sx-64,v.sz-13)<=4+1e-7));
 a(Math.abs(p[0].sx-68)<1e-6&&Math.abs(p.at(-1).sx-60)<1e-6);
 a(p.some(v=>Math.abs(v.sx-64)<1e-7&&Math.abs(v.sz-17)<1e-7));
 a.equal(shape({...attack,northAttack:'horn'}).length,0);
});
test('both fan edge and visible lobes stop against the same tile walls instead of painting beyond them',()=>{
 const {shape}=get((x,z)=>!(z>=15&&x>=63&&x<=65)),p=shape(attack);
 a(p.some(v=>Math.abs(v.sx-64)<1e-7&&Math.abs(v.sz-14.5)<1e-5),'committed forward ray stops at the real tile boundary');
 a(p.every(v=>!(v.sx>62.501&&v.sx<65.499&&v.sz>14.501)));
 a(p.some(v=>v.sx>66&&v.sz>15),'unobstructed neighboring lobe remains');
});
test('axe pulls to one side, crosses front at floor-readable level, then recovers; flash exceeds warning',()=>{
 const {pose,opacity}=get(),w=pose(attack,1550),mid=pose({...attack,pending:false,visualHitAt:1850},1850),
 end=pose({...attack,pending:false,visualHitAt:1850},1965);
 a(w.end[0]>.8&&w.end[2]<-.35);a(mid.end[2]>.85);a(end.end[0]<-.65);
 a(Math.max(w.end[1],mid.end[1],end.end[1])-Math.min(w.end[1],mid.end[1],end.end[1])<.34,'release remains horizontal');
 a(opacity(attack,1830)<opacity({...attack,pending:false,visualHitAt:1850},1850));
 a.equal(opacity({...attack,pending:false,visualHitAt:1850},2350),0);
 a.match(h,/poiDrawNorthAxeCue\(now,p\.vp\)/);
});

test('submitted mesh stays on the B1 floor in front of the exact committed origin',()=>{
 const {geometry}=get(),m=geometry(attack),n=m.p.length/3;
 a(n>=300&&n<=2600);a.equal(m.p.length,m.c.length);a.equal(m.p.length,m.n.length);
 const colors=new Set();
 for(let i=0;i<m.p.length;i+=3){
  const [x,y,z]=m.p.slice(i,i+3);
  a(Math.abs(y+1.247)<1e-6,'world-space floor, not viewport pixels');
  a(z>=13.5-1e-6&&Math.hypot(x-64.5,z-13.5)<=4+1e-6);
  a(m.n[i+1]>=-1e-6,'upward or degenerate triangles face the light');
  colors.add(m.c.slice(i,i+3).join());
 }
 a(colors.size>=3,'fill/rim/side accent are separate warm colors');
 a.equal(geometry({...attack,northAttack:'horn'}).p.length,0);
});
