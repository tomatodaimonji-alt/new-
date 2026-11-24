const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('the two genuine party cards share label, value, then styled progress order without changing their IDs',()=>{
 const hud=html.slice(html.indexOf('<section id="poiPartyHud"'),html.indexOf('<div id="poiMessageStack">'));
 for(const [name,value,bar] of [['プレイヤー','poiPlayerHpValue','poiPlayerHp'],['poiCompanionHudName','poiCompanionHudHpValue','poiCompanionHudHp']]){
  const title=hud.indexOf(name),number=hud.indexOf('id="'+value+'"'),rail=hud.indexOf('id="'+bar+'"');
  a(title>=0&&title<number&&number<rail,'name then value then progress: '+bar);
  a.match(hud,new RegExp('<span id="'+value+'" class="poiHpValue">'));
  a.match(hud,new RegExp('<progress id="'+bar+'"'));
 }
 a.match(html,/\.poiPartyCard \.poiHpMetric progress::-webkit-progress-value\{background:linear-gradient\(90deg,#4f8f62,#9ec685\)/);
 a.doesNotMatch(html,/#poiCompanionHud \.poiHpMetric progress\{/);
 a.match(html,/setAttribute\('aria-label',label\+'のHP'\)/);
});
