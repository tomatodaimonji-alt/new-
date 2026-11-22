const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
test('eight native slots sit between numeric HP and the unchanged D-pad',()=>{
 const markup=html.slice(html.indexOf('<div id="poiWalkPad">'),html.indexOf('<div class="poiWalkDpad">'));
 assert.match(markup,/<span id="poiPlayerHpValue">100\/100<\/span>[\s\S]*<div id="poiHotbar"/);
 assert.deepEqual([...markup.matchAll(/<button type="button" data-hotbar-slot="(\d)"[^>]*><span class="hotbar-icon"[^>]*><\/span><span class="hotbar-count"[^>]*><\/span><\/button>/g)].map(m=>m[1]),['0','1','2','3','4','5','6','7']);
 assert.match(html,/#poiHotbar\s*\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\)\)[^}]*grid-template-columns:repeat\(8,minmax\(0,1fr\)\)/);
 assert.match(html,/#poiPartyHud\s*\{[^}]*bottom:calc\(100% \+ var\(--poi-hud-gap\) \* 2 \+ var\(--poi-hotbar-size\)\)/);
 assert.match(html,/#viewWrap:has\(#pineAIMode:not\(\[hidden\]\)\) #poiHotbar/);
});
test('resting panels share the exact original D-pad surface without replacing selection colors',()=>{
 assert.match(html,/--workshop-panel-surface:rgba\(22,46,39,\.54\)/);
 const start=html.indexOf('/* Matching resting panel surfaces');
 assert(start>=0);
 const css=html.slice(start,html.indexOf('</style>',start));
 for(const id of ['poiWalkPad','poiGameTools','quickTools','poiSoundPanel','poiLocationPanel','poiMiniMap','palette','inspector','mobileTabs','pineCheckToolbar'])assert(css.includes('#'+id),id);
 assert.match(css,/background-color:var\(--workshop-panel-surface\)!important/);
 assert.match(html,/#poiHotbar button\[aria-pressed="true"\][^{]*\{[^}]*background:/);
});
test('hotbar uses the canvas width while preserving the D-pad and split desktop editor',()=>{
 assert.match(html,/--poi-hotbar-size:clamp\(34px,12\.6vw,46px\)/);
 assert.match(html,/#app:not\(\.gameWorldMode\) #viewWrap\{--poi-hotbar-size:clamp\(42px,calc\(\(100vw - 550px\) \/ 6\),46px\);--poi-inventory-width:calc\(100vw - 528px\)\}/);
});
