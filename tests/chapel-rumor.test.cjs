const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('the innkeeper may mention the downstream chapel without a quest or map marker',()=>{
 const a=html.indexOf('const POI_NPC_EXTRA_SPEECH='),b=html.indexOf('const POI_NPC_MENU_LABELS=',a);
 assert(a>=0&&b>a);
 const menu=vm.runInNewContext(html.slice(a,b)+';POI_NPC_EXTRA_SPEECH');
 assert.equal(menu.innkeeper.length,3);
 assert(menu.innkeeper.some(line=>line.includes('川下')&&line.includes('礼拝堂')&&line.includes('水')));
 assert(!menu.guildkeeper.some(line=>line.includes('礼拝堂')));
});
