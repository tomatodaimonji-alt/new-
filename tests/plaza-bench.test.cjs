const {test}=require('node:test'),assert=require('node:assert/strict'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
const builder=vm.runInNewContext(html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)[0]+'\nbuildFacilitySite');
test('both original plaza benches sit on their paved ground tiles, with the west bench facing into the square',()=>{
 const base=builder('base');
 for(const [x,z,rot] of [[38,39,1],[45,40,0]]){
  const benches=Array.from(base.map.world.filter(o=>o.x===x&&o.z===z&&o.type==='benchWood'),o=>[o.y,o.rot]);
  assert.deepEqual(benches,[[0,rot]]);
  assert(base.map.world.some(o=>o.x===x&&o.z===z&&o.y===0&&o.type==='roadCutStoneFull'));
 }
});
