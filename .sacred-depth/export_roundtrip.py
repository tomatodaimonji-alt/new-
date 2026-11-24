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
q.write_text(s)
# Runtime validPos is already authoritative for editor and shared movement.
# Do not preserve a second facility-only collision branch with identical effect.
swap(' if(!validPos(x,z)||poiSacredDepthVoid(facilitySite,x,z))return false;', ' if(!validPos(x,z))return false;')
q.write_text(s)
