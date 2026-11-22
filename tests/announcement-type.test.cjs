const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('announcement heading and messages have matching type with a restrained accent',()=>{
 const css=selector=>html.match(new RegExp(selector+'\\{([^}]+)\\}'))?.[1];
 assert.match(css('#poiMessageHeading'),/font-size:inherit;line-height:inherit;font-weight:750;color:#decba5/);
 assert.doesNotMatch(css('#poiMessageHeading'),/font-family:/);
 assert.doesNotMatch(css('\\.poiMessageLine'),/font-size:|line-height:|font-family:/);
 assert.match(css('\\.poiMessageLine:last-child'),/-webkit-line-clamp:2/);
 assert.match(css('#poiMessageStack'),/height:230%/);
 assert.equal(html.includes('.poiMessageLine[data-kind="gold"]{color:'),false,'only the heading has accent text');
});
