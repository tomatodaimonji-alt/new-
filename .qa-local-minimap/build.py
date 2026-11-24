from pathlib import Path
from sys import argv
s=Path(argv[1]).read_text();lane=Path(__file__).parent
def repl(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
def block(a,b,replacement=''):
 i=s.index(a);j=s.index(b,i+len(a))
 repl(s[i:j],replacement)
opening='<canvas id="poiMiniMap" width="144" height="144" aria-label="周辺ミニマップ"></canvas>'
repl(opening,'<button id="poiMiniOpen" type="button" aria-label="周辺地図を拡大" aria-haspopup="dialog" aria-controls="poiLocalMapDialog">'+opening+'</button>')
repl('</aside><div id="poiEnemyHud"></div>','''</aside><dialog id="poiLocalMapDialog" aria-labelledby="poiLocalMapTitle"><div id="poiLocalMapCard">
 <div id="poiLocalMapHeader"><strong id="poiLocalMapTitle">周辺地図</strong><button id="poiLocalMapClose" type="button" aria-label="地図を閉じる" autofocus>閉じる</button></div>
 <canvas id="poiLocalMapLarge" width="492" height="492" aria-label="拡大した周辺地図"></canvas>
 <div id="poiLocalMapControls" role="group" aria-label="地図のズーム"><button id="poiLocalMapZoomOut" type="button" aria-label="縮小">−</button><output id="poiLocalMapScale">100%</output><button id="poiLocalMapZoomIn" type="button" aria-label="拡大">＋</button></div>
 </div></dialog><div id="poiEnemyHud"></div>''')
repl('#poiMiniMap{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:6px}', '#poiMiniMap{display:block;width:100%;height:auto;aspect-ratio:1;border-radius:6px}\n'+(lane/'minimap.css').read_text())
block('const poiMiniStatic=new Map();','function poiMiniQuestMark(', (lane/'local-map.js').read_text()+(lane/'overlay.js').read_text()+'''
let poiMiniLast=null,poiMiniBuilds=0;
function poiMiniInvalidate(){poiLocalInvalidate();poiMiniLast=null}
function poiMiniSnapshot(){
 const overlay=poiLocalOverlay,f=poiLocalFrame;
 return poiMiniLast?{...poiMiniLast,topologyBuilds:poiMiniBuilds,local:f?{crop:f.crop,known:f.cells.reduce((n,c)=>n+!!c,0),scope:f.scope}:null,
  overlay:overlay?{crop:overlay.frame.crop,view:overlay.view,visible:poiLocalProject(overlay.frame.crop,overlay.view)}:null}:null;
}
''')
repl('function poiMiniUpdate(){\n const hud=', 'function poiMiniUpdate(){\n const hud=')
repl('if(!active){poiMiniLast=null;poiLocationMotion(panel,null);return}', 'if(!active){poiMiniLast=null;poiLocalFrame=null;poiLocalClose();poiLocationMotion(panel,null);return}')
repl(" const g=cv.getContext('2d');if(!g)return;\n const floor=poiWalkLevel,{width,height}=cv;",' const floor=poiWalkLevel;')
block(' const realm=dungeon?facilitySite[dungeon].bounds:null,cacheKey=', ' const geo=poiRegionAt(facilitySite,poiWalkX,poiWalkZ,pineGameActive,floor);',''' const realm=dungeon?facilitySite[dungeon].bounds:null;
 const concealed=typeof poiSacredMiniConcealed==='function'&&poiSacredMiniConcealed(facilitySite,poiWalkX,poiWalkZ,floor);
 if(poiMiniLast&&(poiLocalTopology?.world!==world||poiLocalTopology.site!==facilitySite||poiLocalTopology.concealed!==concealed))poiMiniLast=null;
''')
block(' const {layer,scale,ox,oy}=map;',' poiMiniLast={location:area.name,stars:area.stars,',''' poiLocalFrame=poiLocalCapture(poiWalkX,poiWalkZ,floor,facilitySite,dungeon,realm,concealed,quests);
 poiLocalPaint(cv,poiLocalFrame);
 // Preserve the public location/badge reporting seam; quest pins only draw
 // on tiles the player has seen inside this local frame.
''')
guard="if(typeof poiLocalModalOpen==='function'&&poiLocalModalOpen())return;"
for p in ('function poiWalkStepWithFallback(dx,dz,alternate=null){','function poiWalkAction(){',
          "document.addEventListener('keydown',e=>{\n if(!poiWalkActive||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;"):
 repl(p,p+'\n '+guard)
p="window.addEventListener('pagehide',()=>poiCompanionUiClose);"
if s.count(p)==1: repl(p,p+'\npoiLocalBind();')
else:
 p="window.addEventListener('pagehide',poiCompanionUiClose);"
 repl(p,p+'\npoiLocalBind();')
# Older archives omit the optional key. Old isolated VM reset fixtures omit
# the new constant, so type-guard this narrow integration boundary.
p='!always.includes(k)&&k!==WORKSHOP_RESUME_KEY'
repl(p,p+"&&(typeof POI_LOCAL_MAP_KEY==='undefined'||k!==POI_LOCAL_MAP_KEY)")
p='  const resume=storage.getItem(WORKSHOP_RESUME_KEY);\n  if(poiGameResetBaseResume(resume))'
repl(p,"  if(typeof POI_LOCAL_MAP_KEY!=='undefined'){\n   const survey=storage.getItem(POI_LOCAL_MAP_KEY);if(survey!==null)before[POI_LOCAL_MAP_KEY]=survey;\n  }\n"+p)
Path(argv[2]).write_text(s)
