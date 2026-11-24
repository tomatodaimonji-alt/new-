from pathlib import Path
import sys
p=Path(__file__).parent;src,dst=map(Path,sys.argv[1:3]);default='--default' in sys.argv[3:];s=src.read_text()
def sub(a,b):
 global s
 assert s.count(a)==1,(s.count(a),a)
 s=s.replace(a,b,1)
runtime=(p/'surface.js').read_text()
if default:
 runtime=runtime.replace("const POI_OVERLAND_SPIKE=new URLSearchParams(location.search).get('overland-stream')==='1';","const POI_OVERLAND_SPIKE=true;")
sub('// BEGIN SNOW PASS PROTOTYPE',(p/'core.js').read_text()+'\n'+runtime+'\n// BEGIN SNOW PASS PROTOTYPE')
if not default:sub("if(params.get('resume')==='1')return [...params.keys()].every(k=>k==='resume'||k==='test');",
    "if(params.get('resume')==='1')return [...params.keys()].every(k=>k==='resume'||k==='test'||k==='overland-stream'&&params.get('test')==='1');")
sub("function buildSignOverlay(){\n const groups=new Map(SIGN_TYPES.map(id=>[id,[]]));\n for(const o of world){",
    "function buildSignOverlay(){\n const groups=new Map(SIGN_TYPES.map(id=>[id,[]]));\n const nearby=typeof poiOverlandSignInput!=='undefined'?poiOverlandSignInput:null;\n for(const o of nearby||world){")
sub(" const guild=guildBounds();\n if(guild&&world.some(o=>o.y===0&&o.type==='counterWood'",
    " const guild=nearby?null:guildBounds();\n if(guild&&world.some(o=>o.y===0&&o.type==='counterWood'")
sub(" if(facilitySite&&poiWalkActive){\n  if(facilitySite.id!=='snowpass'&&!facilityRoofMeshes.length)facilityBuildRoofs();",
    " const stream=typeof poiOverlandPreviewTick==='function'?poiOverlandPreviewTick():null;\n if(stream){sceneMesh=stream;signOverlays=poiOverlandSignOverlay();dirty=false}\n else if(facilitySite&&poiWalkActive){\n  if(facilitySite.id!=='snowpass'&&!facilityRoofMeshes.length)facilityBuildRoofs();")
sub(" const nearActors=poiTownNpcActors.filter(a=>!a.recessed&&!a.death&&poiTownNpcMotionNear(a));",
    " const actors=typeof poiOverlandActorVisible==='function'?poiTownNpcActors.filter(a=>poiOverlandActorVisible(vp,a.x,a.z,a.y)):poiTownNpcActors;\n const nearActors=actors.filter(a=>!a.recessed&&!a.death&&poiTownNpcMotionNear(a));")
sub(" const outfits=poiTownNpcActors.filter(a=>!a.recessed&&!a.death&&a.y===poiWalkLevel)",
    " const outfits=actors.filter(a=>!a.recessed&&!a.death&&a.y===poiWalkLevel)")
sub("  for(const a of poiTownNpcActors){\n   if(a.recessed||a.death||a.y!==poiWalkLevel)continue;\n   const sleeping=",
    "  for(const a of actors){\n   if(a.recessed||a.death||a.y!==poiWalkLevel)continue;\n   const sleeping=")
monster_start=s.index('function poiMonsterRender(now,vp){')
monster_end=s.index('\nfunction ',monster_start+1)
monster=s[monster_start:monster_end]
assert monster.count('const onSlice=(o)=>')==1
monster=monster.replace("const onSlice=(o)=>!(facilitySite&&o.y!==poiWalkLevel)&&","const onSlice=(o,state)=>!(facilitySite&&o.y!==poiWalkLevel)&&\n  (typeof poiOverlandActorVisible!=='function'||poiOverlandActorVisible(vp,state?.x??o.x,state?.z??o.z,o.y))&&")
monster=monster.replace('onSlice(o)', 'onSlice(o,s)').replace('onSlice(obj)', 'onSlice(obj,s)')
monster="let poiOverlandMonsterSlice=null;\n"+monster.replace(" const animate=poiMonsterBreaks.some", """ const clip=typeof poiOverlandDrawing!=='undefined'&&poiOverlandDrawing;
 const slice=clip?[...poiMonsterStates].map(([o,s])=>s.hp>0&&onSlice(o,s)?'1':'0').join(''):null;
 if(typeof poiOverlandMonsterSlice!=='undefined'&&slice!==poiOverlandMonsterSlice){poiOverlandMonsterSlice=slice;poiMonsterMeshDirty=true}
 const animate=poiMonsterBreaks.some""")
s=s[:monster_start]+monster+s[monster_end:]
sub(" draw(sceneMesh?.ground,p.vp);poiDrawSceneOcclusion(sceneMesh,p.vp);",
    " if(stream)poiOverlandPresent(p.vp);else{draw(sceneMesh?.ground,p.vp);poiDrawSceneOcclusion(sceneMesh,p.vp);")
sub(" facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);",
    " facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);}")
sub(" facilityBuildRoofs();poiMiniInvalidate();",
    " if(!POI_OVERLAND_SPIKE||!poiOverlandScope(dest.region,dest.x,dest.z))facilityBuildRoofs();poiMiniInvalidate();")
sub(" const incoming=onBase?poiSnowPassMap():base.site,map=onBase?incoming.map:null;",
    " const incoming=onBase?(POI_OVERLAND_SPIKE?(poiOverlandSnow??=poiSnowPassMap()):poiSnowPassMap()):base.site,map=onBase?incoming.map:null;")
sub(" width:MAP_W,height:MAP_H,terrainHeights,models,prefabs,checks:pineCheckMarks,maxLevel:worldMaxLevel,hasCellar:facilityHasCellar}:poiSnowPassBase;",
    " width:MAP_W,height:MAP_H,terrainHeights,models,prefabs,checks:pineCheckMarks,maxLevel:worldMaxLevel,hasCellar:facilityHasCellar,\n  ...(POI_OVERLAND_SPIKE?{overlandStatic:{floors:facilityFloorMasks,stairs:facilityStairOpenings,doors:facilityDoorTiles,creek:facilityCreekIndex,nav:poiTownNpcNav,mini:new Map(poiMiniStatic)}}:{})}:poiSnowPassBase;")
sub(" const incoming=onBase?(POI_OVERLAND_SPIKE?",
    " if(onBase&&cold&&base.overlandStatic&&!base.overlandStatic.mini.has(0)){\n  const canvas=$('poiMiniMap'),topology=canvas&&poiMiniDrawTopology(canvas.width,canvas.height,0,facilitySite);\n  if(topology)base.overlandStatic.mini.set(0,topology);\n }\n const incoming=onBase?(POI_OVERLAND_SPIKE?")
sub(" facilityPrepareFloorMasks();facilitySurfaceEdited=onBase?false:base.edited;",
    " const staticBase=!onBase?base.overlandStatic:null;\n if(staticBase){facilityFloorMasks=staticBase.floors;facilityStairOpenings=staticBase.stairs;facilityDoorTiles=staticBase.doors;facilityCreekIndex=staticBase.creek;poiTownNpcNav=staticBase.nav}\n else facilityPrepareFloorMasks();\n facilitySurfaceEdited=onBase?false:base.edited;\n poiMiniInvalidate();if(staticBase)for(const [key,value] of staticBase.mini)poiMiniStatic.set(key,value);")
sub("if(!POI_OVERLAND_SPIKE||!poiOverlandScope(dest.region,dest.x,dest.z))facilityBuildRoofs();poiMiniInvalidate();",
    "if(!POI_OVERLAND_SPIKE||!poiOverlandScope(dest.region,dest.x,dest.z))facilityBuildRoofs();")
sub(" const cells=new Map();\n for(const o of world){\n  const k=poiTownNpcKey(o.x,o.z,o.y);",
    " const warm=typeof poiOverlandIndexCache!=='undefined'?poiOverlandIndexCache.get(world)?.townCells:null;\n const cells=warm||new Map();\n for(const o of warm?[]:world){\n  const k=poiTownNpcKey(o.x,o.z,o.y);")
sub("function loadData(o){const {newW", "function loadData(o,quietPresentation=false){const {newW")
sub("cursorDirty=true;refreshPalette();}\nfunction displayJSON", "cursorDirty=true;if(!quietPresentation)refreshPalette();}\nfunction displayJSON")
sub("function facilityLoadMap(map){","function facilityLoadMap(map,quietPresentation=false){")
sub(" loadData(normalized);\n const floorOffset=", " loadData(normalized,quietPresentation);\n const floorOffset=")
sub(" if(onBase)facilityLoadMap(map);",
    " if(onBase)facilityLoadMap(map,POI_OVERLAND_SPIKE&&dest.region==='snowpass');")
sub("function poiWalkReset(x,z){","function poiWalkReset(x,z,quietPresentation=false){")
sub("if(poiWalkActive){poiCreekAudioSync();poiWalkRoof();poiWalkAvatar();poiWalkCamera();poiWalkStatus()}",
    "if(poiWalkActive){poiCreekAudioSync();if(!quietPresentation){poiWalkRoof();poiWalkAvatar();poiWalkCamera();poiWalkStatus()}}")
sub(" poiWalkReset(dest.x,dest.z);poiWalkFacing=dest.facing;",
    " poiWalkReset(dest.x,dest.z,POI_OVERLAND_SPIKE&&poiOverlandScope(dest.region,dest.x,dest.z));poiWalkFacing=dest.facing;")
sub(" if(poiWalkActive){poiWalkAvatar(now);poiWalkCamera();poiWalkStatus();poiCombatHud();poiHotbarRender()}",
    " if(poiWalkActive){if(!poiOverlandKeepAnalog)poiWalkAvatar(now);poiWalkCamera();poiWalkStatus();poiCombatHud();poiHotbarRender()}")
sub(" if(dest.region!=='base')return poiSnowPassChange(dest,now);",
    " if(dest.region!=='base'||POI_OVERLAND_SPIKE&&poiOverlandCommands.some(q=>q.id==='base'))return poiSnowPassChange(dest,now);")
sub("  snowPassRegion:()=>","  overlandStream:()=>poiOverlandInspect(),\n  snowPassRegion:()=>")
sub("function poiFreeAdvance(x,z,dx,dz,radius,canStep,enter,clipBody){",
 "function poiFreeAdvance(x,z,dx,dz,radius,canStep,enter,clipBody,passContact=false){")
sub("if(!(swap?enter(row,from+dir,row,from):enter(from+dir,row,from,row))){",
"""const accepted=passContact?(swap?enter(row,from+dir,row,from,q,next):enter(from+dir,row,from,row,next,q)):
    (swap?enter(row,from+dir,row,from):enter(from+dir,row,from,row));
   if(!accepted){""")
sub(" const dest=poiSnowPassEdge(nx,nz,poiWalkX,poiWalkZ);\n if(!dest)return false;",
""" const dest=poiSnowPassEdge(nx,nz,poiWalkX,poiWalkZ);
 if(!dest)return false;
 const continuous=poiOverlandTransfer(dest,now);
 if(continuous!==null)return continuous;""")
sub("POI_FREE_RADIUS,canStep,(x,z,fromX,fromZ)=>{", "POI_FREE_RADIUS,canStep,(x,z,fromX,fromZ,px,pz)=>{")
sub("  const transition=poiWalkEnterCell(x-fromX,z-fromZ,now,true,onDoorCue);",
"""  if(streaming)poiOverlandAnalogOffer={x:px,z:pz,angle,contact:c};
  let transition;
  try{transition=poiWalkEnterCell(x-fromX,z-fromZ,now,true,onDoorCue)}
  finally{if(streaming)poiOverlandAnalogOffer=null}""")
sub(" const result=poiFreeAdvance(old.x,old.z,",
 " const streaming=typeof POI_OVERLAND_SPIKE!=='undefined'&&POI_OVERLAND_SPIKE;\n const result=poiFreeAdvance(old.x,old.z,")
sub(" },clipBody);\n if(result.stopped", " },clipBody,streaming);\n if(streaming&&poiOverlandResumeAnalog(c,old,now))return;\n if(result.stopped")
sub("function poiWalkFrameNoRegionRemote(){\n poiStopRepeat();",
 "function poiWalkFrameNoRegionRemote(){\n poiStopRepeat(typeof poiOverlandKeepAnalog!=='undefined'&&poiOverlandKeepAnalog);")
sub("""function poiStopRepeat(){
 if(poiWalkRepeat!==null){clearInterval(poiWalkRepeat);poiWalkRepeat=null}
 if(typeof poiAnalogStop==='function')poiAnalogStop();""",
"""function poiStopRepeat(preserveAnalog=false){
 if(poiWalkRepeat!==null){clearInterval(poiWalkRepeat);poiWalkRepeat=null}
 if(preserveAnalog!==true&&typeof poiAnalogStop==='function')poiAnalogStop();""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
