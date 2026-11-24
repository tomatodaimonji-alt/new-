// BEGIN SOUL ITEM DETAIL STATS
function poiItemDetailSoulStats(cell){
 const spec=typeof poiCompanionType==='function'?poiCompanionType(cell?.type):null;
 if(!spec)return null;
 let attack=String(spec.attack);
 if(cell.type==='orvasSoul'&&typeof POI_DAVID_ORDER!=='undefined'&&typeof POI_DAVID_PATTERNS!=='undefined'&&
    typeof POI_DAVID_LEAP_DAMAGE==='number'&&typeof POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE==='number'){
  // Match the summoned actor's actual damage per contact, before the
  // target's own guard; a double strike counts as two distinct hits.
  const damage=POI_DAVID_ORDER.flatMap(k=>POI_DAVID_PATTERNS[k].damage);
  damage.push(POI_DAVID_LEAP_DAMAGE,POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE);
  attack=Math.min(...damage)+'〜'+Math.max(...damage)+'（技による）';
 }
 const current=cell.durability??spec.hp;
 // poiCompanionHurt always subtracts the incoming rounded damage directly.
 return {attack,defense:'なし（ダメージ軽減なし）',hp:current+'／'+spec.hp};
}
function poiItemDetailRenderSoulStats(cell){
 const panel=$('poiItemDetailSoulStats');
 if(!panel)return;
 const stats=poiItemDetailSoulStats(cell);
 panel.hidden=!stats;
 for(const [name,key] of [['Attack','attack'],['Defense','defense'],['HP','hp']]){
  const el=$('poiItemDetailSoul'+name),text=stats?.[key]??'';
  if(el&&el.textContent!==text)el.textContent=text;
 }
}
// END SOUL ITEM DETAIL STATS
