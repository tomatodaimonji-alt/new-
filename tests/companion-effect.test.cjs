const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+1);a(i>=0&&j>i,x);return s.slice(i,j)};
function fixture(){
 const base={id:'base'},parts=[],uploads=[],draws=[],e={x:2.55,y:0,z:3.58,floor:0,start:100,parts:[{}]},
  item={type:'slimeSoul',x:3,z:3,y:0,durability:36};
 const c=vm.createContext({POI_MONSTER_FLIGHT_MS:760,facilitySite:base,world:[],poiWalkLevel:0,poiWalkActive:true,pineAIActive:false,
  poiMonsterMeshDirty:false,poiWalkViewX:20,poiWalkViewZ:20,poiWalkX:3,poiWalkZ:2,poiCompanionPlace:()=>({travel:0}),
  poiHotbarHasKit:()=>true,poiHotbarRead:()=>({soulDrops:[item]}),poiDungeonVisualVisible:()=>true,validPos:()=>true,
  poiLootFloorTop:()=>0,terrainY:()=>0,mesh:()=>({p:[],n:[],c:[]}),tri:(m,...t)=>m.p.push(...t[0],...t[1],...t[2]),
  quad(m,...v){m.p.push(...v[0],...v[1],...v[2])},
  poiMonsterAppendDebris(m,actual,t){parts.push({actual,t});m.p.push(0,0,0)},
  upload(m,old){uploads.push(old);return {buf:old??{},count:m.p.length/3}},
  poiDrawLootMesh(m){draws.push(m)},gl:{DYNAMIC_DRAW:1,deleteBuffer(){}}
 });
 const r=code=>vm.runInContext(code,c);r(cut('const POI_SOUL_FLOOR_MAX=','function poiSoulFloorDecode(')+
  cut('// BEGIN SOUL FLOOR ART','// END SOUL FLOOR ART')+";this.motion=poiSoulFloorMotion;");
 c.poiSoulFloorWorld=()=>true;
 c.poiSoulFloorPiece=(m,type,x,y,z)=>m.p.push(x,y,z);
 c.poiSoulFloorAttach(item,e,100);return {r,c,e,item,parts,uploads,draws};
}
test('actual fracture reverses continuously from real settled debris into a miniature that rolls to a fixed ground coordinate, not the player',()=>{
 const f=fixture(),rec=f.c.motion.get('slimeSoul');
 for(const [t,phase,q] of [[100,'fracture',0],[860,'gather',1],[1350,'form',0],[1610,'roll',undefined],[2340,'rest',undefined]]){
  const v=f.c.poiSoulFloorFrame(rec,t);a.equal(v.phase,phase);if(q!==undefined)a.equal(v.debris,q);
 }
 a(f.c.poiSoulFloorFrame(rec,950).debris>f.c.poiSoulFloorFrame(rec,1220).debris);
 f.c.poiWalkViewX=99;const q=f.c.poiSoulFloorFrame(rec,2340);
 a.deepEqual([q.x,q.z,q.y],[3.5,3.5,.02]);a.equal(q.tilt,Math.PI*2);
});
test('present geometric debris feeds one moving buffer and stale world loses effect without storing extra loot',()=>{
 const f=fixture();a(f.e.soulFx&&f.c.poiMonsterMeshDirty);
 for(const t of [500,860,1100,1450,2200])f.c.poiSoulFloorDraw(t,{});
 a(f.parts.every(p=>p.actual===f.e));a.equal(f.parts[1].t,1);a(f.parts[2].t<1);
 a.equal(f.uploads.length,5);a.equal(new Set(f.uploads.slice(1)).size,1);
 f.c.world=[];f.c.poiSoulFloorDraw(2250,{});a.equal(f.c.motion.size,0);
 a.match(s,/if\(effect\.soulFx\|\|/);
});
