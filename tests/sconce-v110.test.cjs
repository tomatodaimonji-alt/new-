const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const init=h.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)[0];
const build=vm.runInNewContext(init+'\n;buildFacilitySite');
test('only the marked wardrobe-side 1F sconce moves to an empty side-wall location',()=>{
 for(const scope of ['lodging','base']){
  const {buildings:[b],map}=build(scope);
  const at=(x,z,y=0)=>map.world.filter(o=>o.x===b.x1+x&&o.z===b.z1+z&&o.y===y);
  assert(at(4,1).some(o=>o.type==='wardrobe'),'wardrobe must remain');
  assert(!at(4,0).some(o=>o.type==='poiWallSconce'),'old sconce faces the wardrobe');
  assert(at(6,1).some(o=>o.type==='woodwall'));
  assert(at(6,1).some(o=>o.type==='poiWallSconce'&&o.rot===1),'west face of the owner washroom partition');
  assert(at(5,1).length>0&&at(5,1).every(o=>o.type==='woodfloorLight'),'illumination opens into an unoccupied tile');
  assert(at(6,3).some(o=>o.type==='poiWallSconce'&&o.rot===3),'leave bathroom light unchanged');
 }
});
