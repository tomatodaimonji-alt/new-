const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
test('bag no longer opts out either live HUD; unrelated NPC contexts and inactive ally hide still apply',()=>{
 const i=h.indexOf('/* BEGIN STORAGE PARTY LANE */'),j=h.indexOf('/* END STORAGE PARTY LANE */');
 a.ok(i>=0&&j>i,'landscape storage HUD override exists');
 const css=h.slice(i,j);
 a.match(css,/#viewWrap\[data-analog-play\][^\n]*#poiBagPanel:not\(\[hidden\]\)[^\n]*#poiPartyCards/);
 a.match(css,/\.poiPartyCard:not\(\[hidden\]\)\{visibility:visible;pointer-events:none\}/);
 a.match(css,/--poi-land-inventory-room:[^;]+var\(--poi-party-storage-reserve\)/);
 a.match(h,/#poiWalkPad:has\(#poiNpcTradePanel:not\(\[hidden\]\)\) \.poiPartyCard\[data-party-slot="0"\]\{visibility:hidden/);
 a.match(h,/#poiPartyHud #poiCompanionHud\[hidden\]\{display:none!important\}/);
 a.match(h,/#poiMiniHud,#poiPartyHud\{pointer-events:none/);
});
