const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('only landscape play scales pad, knob and action and keeps bag/hotbar clearance variable',()=>{
 const rule=html.split('/* BEGIN LARGE LANDSCAPE THUMB CONTROLS */')[1]?.split('/* END LARGE LANDSCAPE THUMB CONTROLS */')[0]||'';
 assert.match(rule,/@media \(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 assert.match(rule,/--poi-v230-action-size:99px/);
 assert.match(rule,/--poi-v230-ring-size:117px/);
 assert.match(rule,/--poi-v230-knob-size:51px/);
 assert.match(rule,/--poi-v230-bag-right:calc\(var\(--poi-v230-action-right\) \+ var\(--poi-v230-action-size\) \+ 7px\)/);
 assert.match(rule,/--poi-shortcuts-right:/);
 assert.match(rule,/#poiAnalogPad::before/);
 assert.match(rule,/--poi-v230-extension:28px/);
 assert.match(rule,/inset:0 calc\(-1 \* var\(--poi-v230-extension\)\) 0 0;touch-action:none/);
 assert.match(rule,/--poi-v230-pad-top-reserve:calc\(var\(--poi-mini-size\) \+ 76px\)/);
 assert.doesNotMatch(rule,/#poiMessageStack|#poiNpcInventory/);
});
