const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync('world-editor.html','utf8');
test('real pickup geometry is emphasized, not a tall separate beacon',()=>{
 assert.doesNotMatch(h,/poiLootMarksDraw\(|function poiLootMark\(|poiLootMarksMesh/);
 assert.match(h,/poiDrawLootMesh\(poiEconomyMesh,vp,now\)/);
 assert.match(h,/poiDrawLootMesh\(poiInventoryMesh,vp,now\)/);
 assert.match(h,/uniform vec4 uLootHighlight/);
 assert.match(h,/smoothstep\(9\.0,12\.0/);
 assert.match(h,/gl_FragColor\s*=\s*vec4\(.*?,1\.0\)/);
});
test('draw-only highlight pulses gently, resets even on draw error, and does not change depth',()=>{
 const a=h.indexOf('function poiDrawLootMesh('),b=h.indexOf('const poiLootContentIcons',a);
 assert.ok(a>=0&&b>a);
 const calls=[],c={poiWalkX:103,poiWalkZ:60,loc:{lootHighlight:{}},gl:{uniform4f(...args){calls.push(args.slice(1))}},draw(){if(c.fail)throw Error('draw failed');calls.push('draw')}};
 vm.createContext(c);vm.runInContext(h.slice(a,b),c);
 c.poiDrawLootMesh({},null,600);c.poiDrawLootMesh({},null,1800);
 assert.deepEqual(calls[0].slice(0,2),[103.5,60.5]);assert.equal(calls[0][3],1);
 assert.ok(Math.abs(calls[0][2]-calls[3][2])>.4);
 assert.deepEqual(calls[2],[0,0,0,0]);assert.deepEqual(calls[5],[0,0,0,0]);
 c.fail=true;assert.throws(()=>c.poiDrawLootMesh({},null,2400),/failed/);
 assert.deepEqual(calls.at(-1),[0,0,0,0]);
});
