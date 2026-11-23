const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)};
const a={obj:{type:'monsterSkelMage',y:-1},start:0,hit:850,sx:4,sz:4,x:4,z:5,dx:0,dz:1,y:-1,pending:true};
function get(extra={}){
 return vm.runInNewContext('const POI_AIM_EPS=1e-8;function mesh(){return {p:[],n:[],c:[]}};'+
  slice('function tri(m,','function cube(m,')+slice('function poiAimWallLimit(','function poiAimChooseLock(')+
  slice('// BEGIN NORTH AXE FOOTPRINT','// END NORTH AXE FOOTPRINT')+
  ';({opacity:poiEnemyCueOpacity,tiles:poiEnemyCueTiles,mesh:poiEnemyCueTilesGeometry,footprint:poiEnemyCueFootprint})',
  {poiAimWall:()=>()=>true,terrainY:()=>0,
   facilitySite:{northFort:{boss:{room:{minX:0,maxX:15,minZ:0,maxZ:15}}},mine:{bounds:{x1:0,x2:15,z1:0,z2:15}}},
   POI_NORTH_MINOTAUR_ATTACKS:{axe:{range:4},horn:{range:3.7,width:.48}},
   POI_MINE_TRIAL_FORWARD:2.3,POI_MINE_TRIAL_HALF_WIDTH:.65,poiNorthMinotaurMatch:()=>({room:{minX:0,maxX:15,minZ:0,maxZ:15}}),
   ...extra});
}
test('ordinary, archer and mage use actual committed occupancy and smooth joined red geometry',()=>{
 const f=get(),t=[{x:4,z:5},{x:4,z:6},{x:4,z:7}];
 assert.equal(f.tiles(a,{})[0],a);
 assert.deepEqual(f.tiles({...a,tiles:t},{}),t);
 assert.deepEqual(f.tiles({...a,tiles:t,mageTiles:t.slice(0,2)},{}),t.slice(0,2));
 const m=f.mesh(a,t);
 assert(m.p.length>100&&m.p.length<1000);
 assert(m.c.every((v,i)=>i%3===0?v>.7:v<.38));
 for(let i=0;i<m.p.length;i+=3){
  assert(m.p[i]>=4-1e-7&&m.p[i]<=5+1e-7&&m.p[i+2]>=5-1e-7&&m.p[i+2]<=8+1e-7);
  assert(Math.abs(m.p[i+1]+1.348)<1e-7);
 }
 assert(m.p.some((v,i)=>i%3===0&&v>4+1e-7&&v<4.19),'corners are rounded');
 assert(m.p.some((v,i)=>i%3===2&&Math.abs(v-6)<1e-7),'joined tiles share their boundary without a gap or outline');
});
test('continuous lanes and fan share exact profile dimensions and floor raycasts',()=>{
 const f=get(),horn=f.footprint({...a,northAttack:'horn'});
 assert(horn.every(v=>Math.abs(v.sx-4)<=.48+1e-7&&v.sz>=4-1e-7&&v.sz<=7.7+1e-7));
 assert(horn.some(v=>Math.abs(v.sz-7.7)<1e-7));
 const g=get({poiAimWall:()=>((x,z)=>!(z>=6))}),guard=g.footprint({...a,guardTrial:true});
 assert(guard.every(v=>v.sz<=5.5+1e-7&&Math.abs(v.sx-4)<=.65+1e-7));
 assert(guard.some(v=>Math.abs(v.sz-5.5)<1e-7));
 const axe=f.footprint({...a,northAttack:'axe'});
 assert(axe.some(v=>Math.abs(v.sz-8)<1e-7));assert(axe.every(v=>v.sz>=4-1e-7&&v.d<=4+1e-7));
});
test('warning never strobes or fully disappears and reduced motion is steady',()=>{
 const f=get();
 assert.equal(f.opacity(a,-1,false),0);assert.equal(f.opacity(a,20,true),f.opacity(a,600,true));
 const levels=Array.from({length:81},(_,i)=>f.opacity(a,i*10,false));
 assert(Math.min(...levels)>=.15&&Math.max(...levels)<=.38);
 assert(levels.some((v,i)=>i>20&&v<levels[i-1]));
 assert(levels.some((v,i)=>i>20&&v>levels[i-1]));
 assert.equal(f.opacity({...a,pending:false},900,true),0);
});
