const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('the player portrait has a status row directly underneath without replacing the portrait or party HUD',()=>{
 assert.match(html,/<canvas id="poiAvatarPreview"[^>]*><\/canvas>\s*<div id="poiBagPlayerStats"/);
 assert.match(html,/#poiAvatarPreview\{grid-column:2;grid-row:1\/5;/);
 assert.match(html,/#poiBagPlayerStats\{grid-column:2;grid-row:5;/);
 assert.match(html,/#poiWalkPad:has\(#poiBagPanel:not\(\[hidden\]\)\) \.poiPartyCard\[data-party-slot="0"\]\{visibility:hidden\}/);
});
test('portrait HP follows real changes and attack follows the actual weapon',()=>{
 const hud={},hp={},bagHp={},value={},attack={},panel={hidden:false,querySelectorAll:()=>[]},view={};
 const dom={poiPartyHud:hud,poiPlayerHp:hp,poiPlayerHpValue:value,poiBagPlayerHpValue:bagHp,poiBagPlayerAttackValue:attack,poiBagPanel:panel,poiAvatarPreview:view};
 const c={poiPlayerHP:76,POI_PLAYER_MAX_HP:100,poiWalkActive:true,poiEquippedWeapon:()=>null,poiPlayerAttackDamage:w=>w==='kitchenKnife'?32:20,
  poiBuildPlayerMesh:()=>null,poiDrawPaperDoll:()=>true,POI_GEAR_LABELS:{},$:k=>dom[k]};
 const snippet=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
 vm.runInNewContext(snippet('let poiPaperDollKey=','function poiBagWalletLayout(')+snippet('function poiCombatHud(','function poiDamageNumber('),c);
 c.poiPlayerPaperDollRender();assert.equal(attack.textContent,'20');
 c.poiEquippedWeapon=()=> 'kitchenKnife';c.poiPlayerPaperDollRender();assert.equal(attack.textContent,'32');
 c.poiCombatHud();assert.equal(bagHp.textContent,'76/100');assert.equal(value.textContent,bagHp.textContent);
 c.poiPlayerHP=19;c.poiCombatHud();assert.equal(bagHp.textContent,'19/100');assert.equal(hud.hidden,false);
});
test('portrait stats fit both text rows within the smallest responsive bag cells',()=>{
 const css=html.match(/#poiBagPlayerStats\{([^}]+)\}/)[1];
 assert.match(css,/gap:1px;\s*padding:1px 5px;border:1px/);
 assert.match(css,/font-size:min\(clamp\(9px,2\.7vw,11px\),calc\(\(var\(--poi-bag-cell\) - 5px\) \/ 2\)\);line-height:1;/);
});
