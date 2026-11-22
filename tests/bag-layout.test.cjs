const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('inventory title names the panel and square cells share one responsive track size',()=>{
 assert.match(html,/<section id="poiBagPanel" aria-labelledby="poiBagHeading" hidden>\s*<div class="poiChestHeader"><div id="poiBagHeading">インベントリ<\/div>/);
 assert.match(html,/#poiBagPanel\{[^}]*--poi-bag-cell:min\([^;]*editor-visible-height[^;]*;[^}]*width:calc\(9 \* var\(--poi-bag-cell\) \+ 38px\)/);
 assert.match(html,/#poiBagGrid\{[^}]*height:calc\(5 \* var\(--poi-bag-cell\) \+ 12px\)/);
});
test('single bag button is outside the upper left of the unchanged movement controls',()=>{
 assert.match(html,/#poiBagToggle\{position:absolute;right:calc\(100% \+ 3px\);top:-1px;/);
 assert.match(html,/<\/section>\s*<button id="poiBagToggle"[^>]*>[\s\S]*?<\/button>\s*<div class="poiWalkDpad"><span><\/span>/);
 assert.equal((html.match(/id="poiBagToggle"/g)||[]).length,1);
});
