const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('drag art is a pointer-transparent overlay and never becomes a drop target',()=>{
 assert.match(html,/<div id="poiItemDragPreview" aria-hidden="true" hidden>/);
 assert.match(html,/#poiItemDragPreview\{[^}]*position:fixed[^}]*pointer-events:none/);
 assert.match(html,/#poiItemDragPreview\[hidden\]\{display:none/);
});
test('drag position follows the pointer, offset for touch, and stays inside the viewport',()=>{
 const from=html.indexOf('function poiItemDragPosition('),to=html.indexOf('function poiItemDragRender(',from);
 assert(from>=0&&to>from);
 const ctx=vm.createContext({});vm.runInContext(html.slice(from,to),ctx);
 const pos=(...a)=>Array.from(ctx.poiItemDragPosition(...a));
 assert.deepEqual(pos(120,190,40,320,568,'touch'),[100,138]);
 assert.deepEqual(pos(150,211,40,320,568,'touch'),[130,159]);
 assert.deepEqual(pos(0,3,40,320,568,'touch'),[4,15]);
 assert.deepEqual(pos(319,560,40,320,568,'mouse'),[276,524]);
});
