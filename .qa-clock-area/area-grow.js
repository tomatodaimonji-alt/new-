// Favor growing down. On especially short phones, borrow only the
// existing few pixels above, leaving both real touch/clock gaps intact.
function poiLocationGrowth(card,stage,controls,ceiling=null){
 if(!card||!stage||!(card.height>0))return {scale:1.27,up:0};
 let bottom=stage.bottom;
 for(const c of controls)if(c.width>0&&c.height>0&&c.bottom>card.bottom&&c.left<card.right&&c.right>card.left)
  bottom=Math.min(bottom,c.top);
 const max=card.height*.27,down=Math.min(max,Math.max(0,bottom-card.bottom-1.5));
 const safeUp=Number.isFinite(ceiling)?Math.max(0,card.top-ceiling-1.5):0;
 const up=Math.min(safeUp,Math.max(0,card.height*.13-down));
 return {scale:1+(down+up)/card.height,up};
}
let poiLocationLastArea=null,poiLocationAnimation=null;
function poiLocationMotion(panel,area){
 if(!area||!panel){
  poiLocationLastArea=null;poiLocationAnimation?.cancel();poiLocationAnimation=null;return;
 }
 const prior=poiLocationLastArea;
 if(prior?.name===area.name&&prior.stars===area.stars)return;
 poiLocationLastArea={name:area.name,stars:area.stars};
 // The first visible state and a hidden Resume placement do not animate.
 if(!prior||window.pineStartup?.loading)return;
 poiLocationAnimation?.cancel();poiLocationAnimation=null;
 if(typeof panel.animate!=='function'||(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))return;
 const view=panel.closest?.('#viewWrap'),wide=!!view?.hasAttribute('data-analog-play');
 const blockers=wide?'#poiAnalogPad,#poiHotbar,#poiBagPanel,#poiChestPanel,#poiNpcInventory,#poiNpcTradePanel':
  '#poiWalkPad,#poiBagPanel,#poiChestPanel,#poiNpcInventory,#poiNpcTradePanel';
 const controls=Array.from(view?.querySelectorAll?.(blockers)??[]).filter(el=>!el.hidden).map(el=>el.getBoundingClientRect());
 let above=panel.previousElementSibling;
 while(above?.hidden)above=above.previousElementSibling;
 const card=panel.getBoundingClientRect?.(),stage=view?.getBoundingClientRect?.();
 const grow=poiLocationGrowth(card,stage,controls,above?.getBoundingClientRect?.().bottom);
 const peak=(grow.up>0?'translateY('+(-grow.up)+'px) ':'')+'scaleY('+grow.scale+')';
 const rest='0 1px 4px #07191045',pulse=rest+', inset 0 0 0 1px rgba(255,221,145,.56)';
 const clear=rest+', inset 0 0 0 1px rgba(255,221,145,0)';
 poiLocationAnimation=panel.animate([
  {transform:'scaleY(1)',boxShadow:clear,offset:0,easing:'ease-out'},
  {transform:peak,boxShadow:pulse,offset:.19},
  {transform:peak,boxShadow:pulse,offset:.36,easing:'cubic-bezier(.25,.62,.33,1)'},
  {transform:'scaleY(1)',boxShadow:clear,offset:1}
 ],{duration:wide?1750:1050,fill:'none'});
 const current=poiLocationAnimation;
 current.onfinish=()=>{if(poiLocationAnimation===current)poiLocationAnimation=null};
}
