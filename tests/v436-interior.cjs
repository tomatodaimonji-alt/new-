const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const oldPath=path.join(__dirname,'../workshop-frontier-v434/candidate.html'),base=fs.existsSync(oldPath)?fs.readFileSync(oldPath,'utf8'):null;
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'interior-candidate.html'),'utf8');
for(const m of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
function layout(s,ready=false){
 const i=s.indexOf('// BEGIN FRONTIER SOUTH RUINS'),j=s.indexOf('let frontierSouthStairGpu=',i);
 const c=vm.createContext({terrainY:()=>999,mesh:()=>({p:[],n:[],c:[]}),quad:(m,...x)=>m.p.push(...x.slice(0,4).flat()),cube:()=>{throw Error('no all-face cubes for interior scenery')}});
 vm.runInContext(s.slice(i,j)+';globalThis.f={cells:frontierSouthCells,populate:frontierSouthPopulate,mesh:frontierSouthCeilingMesh,wet:frontierSouthRampCell'+(ready?',cap:frontierSouthCeilingHeight,rooms:frontierSouthRoomCells':'')+'};',c);
 return c.f;
}
a.ok(h.includes('function frontierSouthCeilingHeight('),'no room-height ceilings yet');
const v=layout(h,true);
if(base)for(const key of layout(base).cells)a.ok(v.cells.has(key),'keeps old route, floor and anchors: '+key);
for(const key of v.cells){const [x,z]=key.split(',').map(Number);a.ok(x>=128&&x<192&&z>=79&&z<=126)}
assertWidth(153,82);
assertWidth(167,94);
function assertWidth(x,z){a.equal(v.rooms.has(x+','+z),false);a.ok(v.cells.has(x+','+z));a.ok(v.cap(x+.5,z+.5)>.79&&v.cap(x+.5,z+.5)<.83);}
a.ok(v.rooms.has('132,90'));a.ok(v.rooms.has('140,98'));a.ok(v.rooms.has('153,116'));a.ok(v.rooms.has('167,126'));
a.ok(Math.abs(v.cap(136.5,94.5)-v.cap(153.5,82.5)-2.8)<1e-8);
a.ok(v.cap(160.5,78.5)<2);
const pts=v.mesh().p;a.ok(pts.length>0&&pts.every(Number.isFinite));
a.ok(pts.filter((_,i)=>i%3===1).every(y=>y<4&&y>=-1.41));
const floors=[];v.populate((x,z,type,r,y)=>{if(y===-1&&!/monster|lantern|rock|wall/.test(type))floors.push(type)});
a.deepEqual([...new Set(floors)],['stone']);
console.log('PASS expanded room envelope, retained major hallway width and height, stable floor elevations and unified stone surfaces');
