const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('world-editor.html','utf8');
const slice=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return html.slice(i,j)};
test('chest sits above inventory and has eighteen addressable cells in a 9x2 grid',()=>{
 const chest=slice('<section id="poiChestPanel"','<button id="poiBagToggle"');
 assert.deepEqual([...chest.matchAll(/data-chest-slot="(\d+)"/g)].map(m=>Number(m[1])),Array.from({length:18},(_,i)=>i));
 assert.match(html,/#poiChestGrid\{[^}]*repeat\(9,minmax\(0,1fr\)\)[^}]*repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/#poiChestPanel\{[^}]*bottom:calc\(100%/);
});
test('interaction requires same basement, exact object and the tile in front',()=>{
 const context={poiWalkActive:true,pineAIActive:false,facilitySite:{id:'base'},poiWalkLevel:-1,poiWalkFacing:0,
 poiWalkX:27,poiWalkZ:33,world:[{type:'kitchenChest',x:27,z:32,y:-1}]};
 vm.runInNewContext(slice('function poiKitchenChestReachable(){','function poiChestIsOpen(){'),context);
 assert.equal(context.poiKitchenChestReachable(),true);
 context.poiWalkFacing=1;assert.equal(context.poiKitchenChestReachable(),false);
 context.poiWalkFacing=0;context.poiWalkLevel=0;assert.equal(context.poiKitchenChestReachable(),false);
 context.poiWalkLevel=-1;context.poiWalkX=28;context.world.push({type:'kitchenChest',x:28,z:32,y:-1});assert.equal(context.poiKitchenChestReachable(),false);
 context.poiWalkX=27;context.facilitySite.id='dining';assert.equal(context.poiKitchenChestReachable(),false);
});
