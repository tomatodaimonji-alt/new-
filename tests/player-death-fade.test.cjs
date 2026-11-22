const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('death fade sits above the game stage, starts hidden, and uses real black without extra easing',()=>{
 assert.match(html,/<main id="viewWrap"><canvas id="view"><\/canvas><div id="poiDeathFade" aria-hidden="true" hidden><\/div>/);
 const css=html.match(/#poiDeathFade\{([^}]+)\}/)?.[1];
 assert(css);
 assert.match(css,/position:absolute;inset:0;z-index:100004;background:#000;opacity:0/);
 assert.doesNotMatch(css,/transition:/);
 assert.match(html,/#poiDeathFade\[hidden\]\{display:none\}/);
 assert.match(html,/@media\(prefers-reduced-motion:reduce\)\{[\s\S]*?#poiDeathFade\[data-stage="black"\]\{opacity:1!important\}/);
});
