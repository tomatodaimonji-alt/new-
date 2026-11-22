const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const take=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return h.slice(i,j)};
test('authored west/south windows and doors remain part of a continuous wall fade',()=>{
 const cells=new Set(['65,51','66,51','67,51','68,51','69,51','70,51','71,51','72,51']);
 const c=vm.createContext({facilitySite:{id:'base',townOffset:22,buildings:[{id:'artisan',x1:65,x2:72,z1:44,z2:51}]},
  facilityFloorMasks:[{floors:new Map([[0,cells]])}],isWallId:t=>t==='plasterwall'});
 vm.runInContext(take('const POI_ANGLED_RUIN_WALLS=','function poiAngledWallRecord('),c);
 for(const type of ['plasterwall','plasterwallWindow','plasterwallDoor'])
  assert(c.poiAngledWallSides({x:69,z:51,y:0,type}).some(p=>p.owner==='artisan'&&p.side==='south'),type);
 assert.equal(c.poiAngledWallSides({x:69,z:51,y:0,type:'counterWood'}).length,0);
});
test('visible roof uses real surface triangles and does not fade a rear roof or an empty corner',()=>{
 const c=vm.createContext({});
 vm.runInContext(take('// BEGIN ANGLED ROOF SURFACES','// END ANGLED ROOF SURFACES'),c);
 const shape=(p)=>c.poiAngledRoofPart({p},0,[{x:0,z:0,y:1}]);
 // A pitched roof in positive X blocks the east-facing camera; the second
 // ray enters the wide AABB but lives above the triangular hip at this slice.
 const pitch=shape([1,2,0,3,2,0,1,4,3]);
 const rear=shape([-3,2,0,-1,2,0,-1,4,3]);
 assert(c.poiAngledRoofHits(pitch,[[0,1,1]], [1,1,0]));
 assert(!c.poiAngledRoofHits(pitch,[[0,1,2.8]], [1,1,0]));
 assert(!c.poiAngledRoofHits(rear,[[0,1,1]], [1,1,0]));
});
