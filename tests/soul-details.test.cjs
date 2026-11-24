const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(i,j){
 const s=h.indexOf(i),e=h.indexOf(j,s+1);a.ok(s>=0&&e>s,'missing '+i);return h.slice(s,e);
}
function fixture(tweak=''){
 const ui=cut('// BEGIN SOUL ITEM DETAIL STATS','// END SOUL ITEM DETAIL STATS');
 const stats=cut('const POI_COMPANION_SPEC=','const POI_COMPANION_FLIGHT_MS=');
 const patterns=cut('const POI_DAVID_PATTERNS=','let poiDavidActive=');
 const beam=cut('const POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE=','const POI_ORVAS_ALLY_NOTICE=');
 const leap=h.match(/POI_DAVID_LEAP_DAMAGE=(\d+)/)?.[1];
 a.ok(leap);
 const nodes=Object.fromEntries(['SoulStats','SoulAttack','SoulDefense','SoulHP'].map(k=>['poiItemDetail'+k,{textContent:'',hidden:true}]));
 const c=vm.createContext({$:k=>nodes[k]});
 vm.runInContext(stats+patterns+beam+'const POI_DAVID_LEAP_DAMAGE='+leap+';'+
  'function poiCompanionType(id){return POI_COMPANION_SPEC[id]??null}'+tweak+ui,c);
 return {c,nodes};
}
test('soul stats read the selected item current/max HP and actual move output; no invented defense',()=>{
 const {c}=fixture(),value=expr=>JSON.parse(JSON.stringify(vm.runInContext(expr,c)));
 a.deepEqual(value("poiItemDetailSoulStats({type:'slimeSoul',durability:17})"),{attack:'6',defense:'なし（ダメージ軽減なし）',hp:'17／36'});
 a.deepEqual(value("poiItemDetailSoulStats({type:'orvasSoul',durability:417})"),{attack:'28〜47（技による）',defense:'なし（ダメージ軽減なし）',hp:'417／1050'});
 a.equal(value("poiItemDetailSoulStats({type:'orvasSoul'})").hp,'1050／1050');
 a.equal(value("poiItemDetailSoulStats({type:'equipWoodSword',durability:17})"),null);
 const changed=fixture("POI_DAVID_PATTERNS.double.damage[0]=12;POI_DAVID_PATTERNS.stomp.damage[0]=54;").c;
 a.equal(vm.runInContext("poiItemDetailSoulStats({type:'orvasSoul',durability:417}).attack",changed),'12〜54（技による）');
});
test('companion rows are in vertical semantic reading order and clear on switching to an ordinary item',()=>{
 const {c,nodes}=fixture();
 vm.runInContext("poiItemDetailRenderSoulStats({type:'orvasSoul',durability:417})",c);
 a.equal(nodes.poiItemDetailSoulStats.hidden,false);a.equal(nodes.poiItemDetailSoulHP.textContent,'417／1050');
 vm.runInContext("poiItemDetailRenderSoulStats({type:'orvasSoul',durability:401})",c);
 a.equal(nodes.poiItemDetailSoulHP.textContent,'401／1050');
 vm.runInContext("poiItemDetailRenderSoulStats({type:'healingHerb',count:1})",c);
 a.equal(nodes.poiItemDetailSoulStats.hidden,true);
 a.equal(nodes.poiItemDetailSoulHP.textContent,'');
 const section=cut('<dl id="poiItemDetailSoulStats"','<p id="poiItemDetailFeedback"');
 a.deepEqual([...section.matchAll(/<dt>([^<]+)<\/dt>/g)].map(v=>v[1]),['攻撃','防御','HP']);
 a.ok(h.includes('poiOrvasAllyHits(a,q,now,POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE,'));
});
