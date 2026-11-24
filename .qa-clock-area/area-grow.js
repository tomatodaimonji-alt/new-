// The card grows down at its current width. Leave a small real screen
// gap before any overlapping touch/control box, without moving that box.
function poiLocationGrowth(card,stage,controls){
 if(!card||!stage||!(card.height>0))return 1.27;
 let bottom=stage.bottom;
 for(const c of controls)if(c.width>0&&c.height>0&&c.bottom>card.bottom&&c.left<card.right&&c.right>card.left)
  bottom=Math.min(bottom,c.top);
 return 1+Math.min(.27,Math.max(0,(bottom-card.bottom-3)/card.height));
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
 const card=panel.getBoundingClientRect?.(),stage=view?.getBoundingClientRect?.(),peak='scaleY('+poiLocationGrowth(card,stage,controls)+')';
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
