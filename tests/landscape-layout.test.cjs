const {readFileSync}=require('node:fs');
const assert=require('node:assert/strict');
const {test}=require('node:test');
const html=readFileSync(process.env.HTML||'world-editor.html','utf8');
test('landscape HUD is scoped to active touch play, not portrait/editor',()=>{
 const start=html.indexOf('/* Workshop landscape touch HUD */');
 assert(start>=0,'landscape touch HUD stylesheet exists');
 const css=html.slice(start,html.indexOf('</style>',start));
 assert.match(css,/@media\s*\(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 assert.match(css,/#viewWrap\[data-analog-play\] #poiWalkAction\{[^}]*right:/);
 assert.match(css,/#poiAnalogPad\[hidden\]/);
 assert.match(css,/#viewWrap\[data-analog-play\] #poiChestPanel\{[^}]*left:calc\(100%/);
});
