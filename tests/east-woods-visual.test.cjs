const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const block=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return h.slice(i,j)};
test('forest floor has continuous seeded moss, worn earth and leaf tones but preserves west and non-natural floors',()=>{
 const scope={};
 vm.createContext(scope);
 vm.runInContext(block('function surfaceNoise(','function roadConnections(')+block('function pineBaseNatureTint(','function addFloorTile('),scope);
 const empty=new Map();
 assert.deepEqual(scope.pineEastGroundColor(65,40,empty),scope.pineBaseGrassCorner(65,40));
 const sample=scope.pineEastGroundColor(85,28,empty),base=scope.pineBaseGrassCorner(85,28);
 assert.notDeepEqual(sample,base);assert(sample[1]<base[1]);
 assert.deepEqual(sample,scope.pineEastGroundColor(85,28,empty));
 assert.deepEqual(sample,scope.pineEastGroundColor(85,28,new Map([['84,27','woodfloor']])));
 const path=scope.pineEastGroundColor(85,28,new Map([['84,27','earth'],['85,27','earth']]));
 assert(path[0]>sample[0]&&path[1]<sample[1]);
 for(let z=0;z<56;z++)for(let x=67;x<=96;x++){
  const col=scope.pineEastGroundColor(x,z,empty),adj=scope.pineEastGroundColor(x-1,z,empty);
  assert(col.every((c,i)=>c>=.19&&c<=.7&&Math.abs(c-adj[i])<.13));
 }
});
test('only existing outdoor east foliage and rocks change silhouette without adding vertices or floating',()=>{
 const x={facilitySite:{id:'base'},mesh:()=>({p:[],n:[],c:[]}),terrainY:()=>.3,
  deco(m,t,x,y,z){m.p.push(x-.21,y+.13,z,x+.21,y+.6,z);m.n.push(0,1,0,0,1,1);m.c.push(.4,.5,.4,.4,.5,.4)}};
 vm.createContext(x);
 vm.runInContext(block('function surfaceNoise(','function roadConnections(')+block('function pineDrawEastNature(','function makeScene('),x);
 const obj={type:'treeBirch',x:85,y:0,z:28,rot:0};
 const m=x.mesh();assert(x.pineDrawEastNature(m,obj));assert.equal(m.p.length,6);
 assert.equal(m.p[1],.3);assert.notEqual(m.p[4],.9);
 const rock=x.mesh();assert(x.pineDrawEastNature(rock,{...obj,type:'rockMossy'}));
 assert.equal(rock.p.length,6);assert.equal(rock.p[1],.3);
 for(const o of [{...obj,x:71},{...obj,y:1},{...obj,type:'woodwall'}])
  assert(!x.pineDrawEastNature(x.mesh(),o));
 x.facilitySite={id:'workshop'};assert(!x.pineDrawEastNature(x.mesh(),obj));
});
