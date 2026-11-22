const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('item details provide a separately labelled native dialog and vertically ordered actions',()=>{
 const dialog=html.match(/<dialog id="poiItemDetail"([^>]*)>([\s\S]*?)<\/dialog>/);
 assert(dialog,'item dialog missing');
 assert.match(dialog[1],/aria-labelledby="poiItemDetailName" aria-describedby="poiItemDetailDescription"/);
 const rows=[...dialog[2].matchAll(/<button type="button" data-item-detail-action="([^"]+)"([^>]*)>([^<]+)<\/button>/g)];
 assert.deepEqual(rows.map(r=>[r[1],r[3]]),[
  ['transfer','インベントリに入れる'],['split','分割する'],['equip','装備する'],['unequip','取り外す'],['use','使う'],['drop','捨てる'],['back','戻る']
 ]);
 assert(rows.slice(0,-1).every(r=>r[2].includes(' hidden')),'JS explicitly enables only valid actions');
 assert.match(rows.at(-1)[2],/autofocus/);
});
test('item details use shared glass, viewport-safe scroll and touch-size vertical buttons',()=>{
 assert.match(html,/#poiItemDetail\{[^}]*width:min\(286px,[^}]*max-height:calc\(100dvh - [^}]*overflow-y:auto[^}]*background:var\(--workshop-panel-surface\)/);
 assert.match(html,/#poiItemDetailActions\{[^}]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(html,/#poiItemDetailActions button\{[^}]*min-height:44px/);
 assert.match(html,/#poiItemDetailActions button\[hidden\]\{display:none\}/);
});
test('full HP closes item detail and emits a single announcement route; other errors stay inline',()=>{
 const a=html.indexOf('function poiItemDetailAction(action)'),b=html.indexOf('function poiBagGestureTarget',a);
 const handler=html.slice(a,b);
 assert.match(handler,/if\(result.reason==='healthy'\)\{poiItemDetailClose\(\);toast\(feedback\);return\}/);
 assert.match(handler,/\$\('poiItemDetailFeedback'\)\.textContent=feedback;return;/);
});
