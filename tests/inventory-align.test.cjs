const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('only standalone landscape bag shares actual shortcut footprint',()=>{
 const rule=html.split('/* BEGIN ALIGNED LANDSCAPE BAG */')[1]?.split('/* END ALIGNED LANDSCAPE BAG */')[0]||'';
 assert.match(rule,/@media \(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 assert.match(rule,/#app #viewWrap\[data-analog-play\] #poiBagPanel:not\(\[data-chest-open\]\)\s*\{/);
 assert.match(rule,/left:var\(--poi-land-control-center\);width:var\(--poi-inventory-width\)/);
 assert.match(rule,/:has\(\[data-bag-legacy\]\)/);
 assert.doesNotMatch(rule,/#poiNpcInventory|#poiChestPanel/);
});
