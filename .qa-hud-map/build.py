from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);text=src.read_text();local=Path(__file__).parent
def p(src,dst):
 global text
 assert text.count(src)==1,(src,text.count(src));text=text.replace(src,dst)
p('/* END FIXED AREA CARD */','/* END FIXED AREA CARD */\n'+(local/'minimap-hud.css').read_text())
p('function poiLocalPaint(cv,frame,v=poiLocalView()){',(local/'hud-metrics.js').read_text()+'function poiLocalPaint(cv,frame,v=poiLocalView(),hud=null){')
p('''  if(!access(tx,tz)||(temple&&poiSacredMiniEntrance(temple,tx,tz)))continue;
  if((tx===x&&tz===z)||poiLocalKnown(bits,tx,tz))cells[i]=1+(row?.cats[poiLocalBit(tx,tz)]??0);
 }
 return {cells,crop,marks,x,z,y,scope,realm:realmKey,concealed,facing:poiWalkFacing};''','''  cells[i]=tile(tx,tz);
 }
 return {cells,crop,marks,x,z,y,scope,realm:realmKey,concealed,facing:poiWalkFacing,tile};''')
p(' const cells=new Uint8Array(POI_LOCAL_SIDE**2);',''' // Both cropped views read the same already surveyed cells. The wider
 // HUD wings do not call poiLocalMark or change the discovery radius.
 const tile=(tx,tz)=>{
  if(!access(tx,tz)||(temple&&poiSacredMiniEntrance(temple,tx,tz)))return 0;
  return ((tx===x&&tz===z)||poiLocalKnown(bits,tx,tz))?1+(row?.cats[poiLocalBit(tx,tz)]??0):0;
 };
 const cells=new Uint8Array(POI_LOCAL_SIDE**2);''')
p('''const {width,height}=cv,{cells,crop,marks,x,z,y}=frame,{x1,z1}=poiLocalProject(crop,v),scale=width/POI_LOCAL_SIDE*v.zoom;''','''const {width,height}=cv,{cells,crop,marks,x,z,y}=frame,{x1,z1}=poiLocalProject(crop,v),
  scale=(hud?.scale??width/POI_LOCAL_SIDE)*v.zoom,shift=hud?.shift??0;''')
p('''  const l=Math.round(cx*scale),t=Math.round(cz*scale);
  g.fillStyle=poiLocalTones[cells[i]-1];g.fillRect(l,t,Math.round((cx+1)*scale)-l,Math.round((cz+1)*scale)-t);
 }
 for(const q of marks)poiMiniQuestMark(g,(q.x+.5-x1)*scale,(q.z+.5-z1)*scale);
 const px=(x+.5-x1)*scale,pz=(''','''  const l=Math.round(shift+cx*scale),t=Math.round(cz*scale);
  g.fillStyle=poiLocalTones[cells[i]-1];g.fillRect(l,t,Math.round(shift+(cx+1)*scale)-l,Math.round((cz+1)*scale)-t);
 }
 if(hud?.wing&&frame.tile){
  // Paint only exposed neighboring columns. Partial outer tiles are
  // clipped by the canvas rather than stretched to fill its width.
  for(let j=0;j<POI_LOCAL_SIDE;j++)for(let i=1;i<=hud.wing;i++)for(const cx of [-i,POI_LOCAL_SIDE+i-1]){
   const tone=frame.tile(crop.x1+cx,crop.z1+j);if(!tone)continue;
   const l=Math.round(shift+cx*scale),t=Math.round(j*scale);
   g.fillStyle=poiLocalTones[tone-1];g.fillRect(l,t,Math.round(shift+(cx+1)*scale)-l,Math.round((j+1)*scale)-t);
  }
 }
 for(const q of marks)poiMiniQuestMark(g,shift+(q.x+.5-x1)*scale,(q.z+.5-z1)*scale);
 const px=shift+(x+.5-x1)*scale,pz=(''')
p(' poiLocalPaint(cv,poiLocalFrame);',' poiLocalPaintHud(cv,poiLocalFrame);')
p(" open.addEventListener('click',poiLocalOpen);",""" open.addEventListener('click',poiLocalOpen);
 if(typeof ResizeObserver==='function'){
  const hud=$('poiMiniMap');
  const observer=new ResizeObserver(()=>{if(poiLocalFrame&&hud.clientWidth>0)poiLocalPaintHud(hud,poiLocalFrame)});
  observer.observe(hud);
 }""")
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(text)
