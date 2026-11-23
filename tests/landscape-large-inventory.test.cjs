const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const h=readFileSync(process.argv[2]??'world-editor.html','utf8');
function block(){
 const a=h.indexOf('/* Larger landscape inventory and shortcut targets */'),b=h.indexOf('</style>',a);
 assert.ok(a>=0&&b>a);
 return h.slice(a,b);
}
test('enlargement is scoped to coarse landscape play, not portrait/editor',()=>{
 const css=block();
 assert.match(css,/@media \(orientation: landscape\) and \(pointer: coarse\) and \(min-width: 520px\)/);
 for(const line of css.split('\n').filter(l=>l.trim().startsWith('#')))
  assert.ok(line.includes('#viewWrap[data-analog-play]'),line);
 assert.doesNotMatch(css,/#poiAnalogPad|#poiWalkAction|#poiBagToggle/);
});
test('roomy layout targets 1.5x square cells; compact 5+4 shortcut grid and panel share explicit available space',()=>{
 const css=block();
 assert.match(css,/--poi-inventory-width:min\(563px,var\(--poi-land-shortcut-room\)\)/);
 assert.match(css,/--poi-bag-cell:min\(54px/);
 assert.match(css,/grid-template-columns:repeat\(10,minmax\(0,1fr\)\)/);
 assert.match(css,/nth-child\(6\)\{grid-column:2\/span 2\}/);
 assert.match(css,/--poi-land-hotbar-height:calc\(2 \* var\(--poi-hotbar-size\)/);
 assert.match(css,/--poi-land-inventory-room:calc\(var\(--editor-visible-height,100dvh\).*var\(--poi-land-hotbar-height\)/);
 assert.match(css,/bottom:calc\(var\(--poi-land-bottom\) \+ var\(--poi-land-hotbar-height\) \+ 6px\)/);
});
test('announcements and speech get an 80px box and only choice layout compacts at short heights',()=>{
 const css=block();
 assert.match(css,/--poi-land-message-width:min\(518px,71\.4vw,/);
 assert.match(css,/#poiMessageStack\{[^}]*height:80px/);
 assert.match(css,/#poiNpcMenu:not\(\[data-quest-list\]\)\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
 assert.match(css,/#poiNpcMenu\{max-height:min\(40dvh,175px,var\(--poi-npc-menu-room,215px\)\)\}/);
});
