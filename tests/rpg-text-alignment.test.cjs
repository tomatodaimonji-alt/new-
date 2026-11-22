const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('speech and announcements read from the top left without changing their HUD anchors',()=>{
 const css=selector=>html.match(new RegExp(selector+'\\{([^}]+)\\}'))?.[1];
 const speech=css('#poiTownSpeech'),panel=css('#poiMessagePanel');
 for(const box of [speech,panel]){
  assert.match(box,/text-align:left/);
  assert.match(box,/background:var\(--workshop-panel-surface\)/);
 }
 assert.match(panel,/justify-content:flex-start/);
 assert.match(speech,/white-space:pre-line/);
 assert.match(css('#poiTownSpeech::after'),/border-top-color:var\(--workshop-panel-surface\)/);
});
