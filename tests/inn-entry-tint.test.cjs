const assert=require('node:assert/strict'),{test}=require('node:test'),{execFileSync}=require('node:child_process'),{resolve}=require('node:path');
const bench=resolve(__dirname,'fixtures/inn-entry-scene-bench.cjs');
const html=resolve(process.env.HTML||'world-editor.html');
function profile(kind){
 return JSON.parse(execFileSync(process.execPath,[bench,html,kind],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:40000}));
}
test('main lodging crosses in a shared cut view: legacy exact geometry and no duplicate town VBO',()=>{
 const old=profile('legacy'),current=profile('stock');
 assert.equal(old.length,current.length);
 for(let i=0;i<old.length;i++){
  const a=old[i],b=current[i];
  assert.equal(a.name,b.name);
  for(const k of ['geometry','walls','storeys','signs'])
   assert.equal(b[k],a[k],b.name+' exact visible '+k);
 }
 const door=current.find(o=>o.name==='main-door'),oldDoor=old.find(o=>o.name==='main-door');
 assert.equal(door.building,'lodging');assert.equal(door.roof,'lodging');
 assert(oldDoor.bytes>20_000_000,'legacy opening scene actually duplicates large VBO');
 // The warm multi-floor fix deliberately no longer re-tints the
 // ground from the upper-storey lamp when the doorway owner changes.
 assert(door.bytes>0&&door.bytes<50_000,'initial cut uses only small transient scene metadata, never another full town VBO');
 assert.equal(door.partial+door.partialBytes,0,'no ground tint upload from an upper-storey lamp');
 for(const crossing of current.filter(row=>row.name==='main-exit'||row.name==='main-repeat')){
  assert.equal(crossing.uploads+crossing.bytes+crossing.partial+crossing.partialBytes,0,'cached doorway crossing never rebuilds or reuploads scene geometry');
 }
 assert.equal(door.spans,5,'only a few span cuts, no temporary large index buffer');
 const south=current.find(o=>o.name==='south-door');
 assert.equal(south.roof,'southInn');assert.equal(south.building,null);assert.equal(south.uploads+south.partial,0);
});
