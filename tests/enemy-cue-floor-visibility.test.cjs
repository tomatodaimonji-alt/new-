const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)};
function geometry(){
 const c=vm.createContext({poiAimWall:()=>()=>true,terrainY:()=>0,
  POI_NORTH_MINOTAUR_ATTACKS:{axe:{range:4},horn:{range:3.7,width:.48}},
  poiNorthMinotaurMatch:()=>({room:{minX:0,maxX:20,minZ:0,maxZ:20}}),
  POI_MINE_TRIAL_FORWARD:2.3,POI_MINE_TRIAL_HALF_WIDTH:.65,
  facilitySite:{mine:{bounds:{x1:0,x2:20,z1:0,z2:20}}}});
 return vm.runInContext('const POI_AIM_EPS=1e-8;function mesh(){return {p:[],n:[],c:[]}};'+
  cut('function tri(m,','function cube(m,')+'\nconst cube=()=>{},diamond=()=>{};\n'+
  'const ROAD_IDS=new Set(); const surfaceNoise=()=>.5,smoothSurfaceNoise=()=>.5;'+
  cut('function addFloorTile(','const SIGN_TYPES=')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+
  cut('// BEGIN NORTH AXE FOOTPRINT','// END NORTH AXE FOOTPRINT')+
  `;({point:poiEnemyCuePoint,tiles:poiEnemyCueTilesGeometry,lane:poiEnemyCueLaneGeometry,axe:poiNorthAxeCueGeometry,
    floor:k=>{const m=mesh();addFloorTile(m,0,0,k,16384);return m.p.filter((_,i)=>i%3===1);}})`,c);
}
test('real floor slab roofs are below every threat mesh for stone, moss and outdoor grass',()=>{
 const f=geometry();
 const base={obj:{type:'monsterMineGuard'},sx:6,sz:6,dx:0,dz:1,y:-1,guardTrial:true};
 const sample=kind=>Math.max(...f.floor(kind));
 assert.equal(sample('stone'),.13,'the stone slab crown is raised above its grouted base');
 assert.equal(sample('moss'),0);assert.equal(sample('grassDry'),0);
 const meshes=[f.lane(base),f.axe({...base,northAttack:'axe'}),f.tiles(base,[{x:6,z:7},{x:6,z:8}])];
 for(const mesh of meshes){
  const heights=mesh.p.filter((_,i)=>i%3===1).map(x=>x+1.4);
  assert(heights.length>0);
  assert(heights.every(y=>y>sample('stone')+.009&&y<.18),
   'warning fill is no longer buried under stone slabs, while remaining close to the walking surface');
 }
 assert(f.point(6,6,0)[1]>sample('grassDry')&&f.point(6,6,0)[1]<.18,'outdoor point stays near the ground');
});
