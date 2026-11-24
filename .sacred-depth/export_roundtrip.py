from pathlib import Path
import sys
p,q=map(Path,sys.argv[1:3]);s=p.read_text()
def swap(a,b):
 global s
 if s.count(a)!=1:raise SystemExit(f'expected one anchor: {a[:180]}')
 s=s.replace(a,b,1)
swap('const extended=stockDepth&&newW===MAX_MAP&&newH===POI_SACRED_DEPTH_H;',
'''const exportMeta=o.workshopFacility;
const depthExport=exportMeta?.version===1&&exportMeta.stockDepth===1&&
 Number.isInteger(exportMeta.floorOffset)&&exportMeta.floorOffset>=0&&exportMeta.floorOffset<=1&&exportMeta.groundY===exportMeta.floorOffset;
const extended=(stockDepth||depthExport)&&newW===MAX_MAP&&newH===POI_SACRED_DEPTH_H;
if(exportMeta?.stockDepth!==undefined&&!extended)throw Error('深い地形データの形式が不正です');''')
swap('function data(){return{format:\'forest-world-v1\',version:1,size:MAP_W,width:MAP_W,height:MAP_H,terrainHeights:',
'''function data(){return{format:'forest-world-v1',version:1,size:MAP_W,width:MAP_W,height:MAP_H,
 ...(MAP_W===128&&MAP_H===182?{workshopFacility:{version:1,floorOffset:0,groundY:0,stockDepth:1}}:{}),terrainHeights:''')
swap('workshopFacility:{version:1,floorOffset,groundY:floorOffset}};',
'''workshopFacility:{version:1,floorOffset,groundY:floorOffset,
   ...(map.width===128&&map.height===182?{stockDepth:1}:{})}};''')
swap("(typeof poiSacredDepthVoid!=='function'||!poiSacredDepthVoid(facilitySite,x,z));","(MAP_W!==128||MAP_H!==182||z<128||x<48);")
swap("for(let x=0,cols=facilitySite?.id==='base'&&facilitySite.sacredDepth&&z>=facilitySite.sacredDepth.oldH?\n   facilitySite.sacredDepth.w:MAP_W;x<cols;x++){","for(let x=0,cols=MAP_W===128&&MAP_H===182&&z>=128?48:MAP_W;x<cols;x++){")
# Runtime validPos is already authoritative for editor and shared movement.
# Do not preserve a second facility-only collision branch with identical effect.
swap(' if(!validPos(x,z)||poiSacredDepthVoid(facilitySite,x,z))return false;', ' if(!validPos(x,z))return false;')
# v295 adds a fourth exact guaranteed-drop ID. Move its real authored spawn
# with the boss; the existing stable-ID migration accepts its previous z as well.
oldSoul="'orvas-soul':Object.freeze({id:'orvas-soul',type:'orvasSoul',x:24,z:105,y:0,bit:8})"
if oldSoul in s:swap(oldSoul,oldSoul.replace('z:105','z:159'))
# Preserve a deep export's floor translation when the generic editor re-exports
# it. A live facility continues using its own normalized physical floor data.
swap("function data(){return{format:'forest-world-v1',version:1,size:MAP_W,width:MAP_W,height:MAP_H,",
     "let pineStockDepthExportOffset=0;\nfunction data(){return{format:'forest-world-v1',version:1,size:MAP_W,width:MAP_W,height:MAP_H,")
swap("workshopFacility:{version:1,floorOffset:0,groundY:0,stockDepth:1}", 
     "workshopFacility:{version:1,floorOffset:pineStockDepthExportOffset,groundY:pineStockDepthExportOffset,stockDepth:1}")
swap("pineValidateWorldData(o,stockDepth);\npineObjectSelection=null;",
     "pineValidateWorldData(o,stockDepth);\npineStockDepthExportOffset=newW===128&&newH===182&&o.workshopFacility?.floorOffset===1?1:0;\npineObjectSelection=null;")
q.write_text(s)
