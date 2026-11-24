  // Flash the card's inner edge without ever crossing the fixed party lane.
  const rest='0 1px 4px #07191045',pulse=rest+', inset 0 0 0 1px rgba(255,221,145,.72)';
  const clear=rest+', inset 0 0 0 1px rgba(255,221,145,0)';
  poiLocationAnimation=panel.animate([
   {boxShadow:clear,offset:0,easing:'ease-out'},
   {boxShadow:pulse,offset:.19},
   {boxShadow:pulse,offset:.37,easing:'ease-in-out'},
   {boxShadow:clear,offset:1}
  ],{duration:1750,fill:'none'});
