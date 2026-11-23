const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
const take=(a,b)=>{a=html.indexOf(a);b=html.indexOf(b,a);assert(a>=0&&b>a);return html.slice(a,b)};
const model={
 p:[-.32,0,0, .18,0,.09, -.12,.9,.1, .18,0,.09, .36,.7,.26, -.12,.9,.1],
 n:[0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0],
 c:[.9,.23,.13,.9,.23,.13,.9,.23,.13,.16,.3,.9,.16,.3,.9,.16,.3,.9]
};
const area=rgba=>rgba.filter((p,i)=>i%4===3&&p>127).length;
test('a new yaw rotates geometry/depth rather than the final bitmap; zoom changes its actual coverage',()=>{
 const code=take('// BEGIN PAPER DOLL DEPTH RASTER','// END PAPER DOLL DEPTH RASTER');
 const paint=vm.runInNewContext(code+';poiPaperDollPixels');
 const neutral=paint(model,80,92),yaw=paint(model,80,92,{yaw:.8,zoom:1}),
  small=paint(model,80,92,{yaw:0,zoom:.62}),large=paint(model,80,92,{yaw:0,zoom:1.30});
 assert.notDeepEqual(yaw,neutral);
 assert(area(small)<area(neutral)*.62&&area(large)>area(neutral)*1.03);
 assert.deepEqual(neutral,paint(model,80,92,{yaw:0,zoom:1}));
 assert.deepEqual(yaw,paint(model,80,92,{yaw:.8,zoom:1}), 'same view is deterministically opaque where drawn');
 assert.match(code,/g\.putImageData\(image,0,0\)/);
});
test('only opted-in portrait canvases acquire touch/keyboard handlers; capture is released when a panel closes',()=>{
 const code=take('// BEGIN INVENTORY PORTRAIT INTERACTION','// END INVENTORY PORTRAIT INTERACTION');
 assert.match(code,/canvas\.setPointerCapture\(e\.pointerId\)/);
 assert.match(code,/canvas\.releasePointerCapture\(id\)/);
 assert.match(code,/requestAnimationFrame/);
 assert.match(code,/cancelAnimationFrame/);
 assert.doesNotMatch(code,/localStorage|sessionStorage|poiWalkStep|poiItemDetailOpen/);
 assert.match(html,/#poiAvatarPreview,#poiNpcPortrait\)\{touch-action:none/);
});
test('same-NPC inventory updates only changed sections, preserving portrait identity and unchanged selections',()=>{
 const code=take('function poiNpcInventorySync(', 'function poiNpcPrivateTradeMode(');
 assert.match(code,/prior\?\.actor!==actor/);
 assert.match(code,/prior\.bag!==keys\.bag/);
 assert.match(code,/prior\.gear!==keys\.gear/);
 assert.match(code,/prior\.status!==keys\.status/);
 assert.match(code,/const portrait=panel\.querySelector\('#poiNpcPortrait'\)/);
 assert.match(code,/if\(prior\.visual!==keys\.visual\)poiNpcPortraitModel\(portrait,actor\)/);
});
