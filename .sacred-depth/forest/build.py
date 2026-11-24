from pathlib import Path
import sys
root=Path(__file__).parent
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1:raise SystemExit(f'expected one anchor ({s.count(a)}): {a[:100]}')
 s=s.replace(a,b,1)
def section(a,b,v):
 first=s.index(a);end=s.index(b,first+len(a))
 rep(s[first:end],v)
rep('const MIN_MAP=12,MAX_MAP=128,MAX_LEVEL=9,','const MIN_MAP=12,MAX_MAP=128,POI_SACRED_DEPTH_H=182,POI_SACRED_DEPTH_W=48,MAX_LEVEL=9,')
rep(' const davidTemple=extendTownWorldDavidTemple(expanded);',' const davidTemple=extendTownWorldDavidTemple(expanded);')
rep(' const southForest=extendTownWorldSouthForest(expanded.map.world,southPort);',
''' const southForest=extendTownWorldSouthForest(expanded.map.world,southPort);
 // Only the stock base appends the southwestern lobe. Legacy coordinates,
 // 128-wide editor maps and the original z=127 snow outlet stay fixed.
 expanded.map.height=182;
 expanded.sacredDepth={w:48,oldH:128,h:182};''')
section('// BEGIN SACRED FOREST MAP','// END SACRED FOREST MAP',(root/'forest-map.js').read_text().split('// END SACRED FOREST MAP')[0])
rep("function poiWalkCanStep(x,z,fromX,fromZ,exceptMonster,skipNpcTile=false){\n if(!validPos(x,z))return false;",
"""function poiSacredDepthVoid(site,x,z){
 const lobe=site?.id==='base'?site.sacredDepth:null;
 return !!lobe&&z>=lobe.oldH&&x>=lobe.w;
}
function poiWalkCanStep(x,z,fromX,fromZ,exceptMonster,skipNpcTile=false){
 if(!validPos(x,z)||poiSacredDepthVoid(facilitySite,x,z))return false;""")
rep("const validPos=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<MAP_W&&z<MAP_H;",
"""const validPos=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<MAP_W&&z<MAP_H&&
 (typeof poiSacredDepthVoid!=='function'||!poiSacredDepthVoid(facilitySite,x,z));""")
rep(' if(x<0||x>=MAP_W||z<0||z>=MAP_H)return false;\n if(g.walk.has(k))',
""" if(x<0||x>=MAP_W||z<0||z>=MAP_H||(typeof poiSacredDepthVoid==='function'&&poiSacredDepthVoid(facilitySite,x,z)))return false;
 if(g.walk.has(k))""")
rep(' if(!facilitySite||facilityViewLevel()>=0)for(let z=0;z<MAP_H;z++)for(let x=0;x<MAP_W;x++){',
""" if(!facilitySite||facilityViewLevel()>=0)for(let z=0;z<MAP_H;z++)
  for(let x=0,cols=facilitySite?.id==='base'&&facilitySite.sacredDepth&&z>=facilitySite.sacredDepth.oldH?
   facilitySite.sacredDepth.w:MAP_W;x<cols;x++){""")
rep('function pineValidateWorldData(o){','function pineValidateWorldData(o,stockDepth=false){')
rep("if(!Number.isInteger(newW)||!Number.isInteger(newH)||newW<MIN_MAP||newW>MAX_MAP||newH<MIN_MAP||newH>MAX_MAP)throw Error('マップの広さが不正です');",
"""const extended=stockDepth&&newW===MAX_MAP&&newH===POI_SACRED_DEPTH_H;
if(!Number.isInteger(newW)||!Number.isInteger(newH)||newW<MIN_MAP||newW>MAX_MAP||newH<MIN_MAP||newH>MAX_MAP&&!extended)throw Error('マップの広さが不正です');""")
rep("const blocks=o.prefabs||[];if(!Array.isArray(blocks)",
"""const outsideLobe=p=>p?.z>=128&&p.x>=POI_SACRED_DEPTH_W;
if(extended&&[o.world,o.terrainHeights,o.checks].some(rows=>Array.isArray(rows)&&rows.some(outsideLobe)))throw Error('マップの範囲外です');
const blocks=o.prefabs||[];if(!Array.isArray(blocks)""")
rep('function loadData(o){const {newW,newH,blocks,heights,incomingChecks}=pineValidateWorldData(o);',
    'function loadData(o,stockDepth=false){const {newW,newH,blocks,heights,incomingChecks}=pineValidateWorldData(o,stockDepth);')
rep(' loadData(normalized);\n const floorOffset=normalized.workshopFacility.floorOffset;',
""" loadData(normalized,facilitySite?.id==='base'&&facilitySite.sacredDepth?.h===normalized.height);
 const floorOffset=normalized.workshopFacility.floorOffset;""")
rep(' const p=d.position;\n const position=p&&Number.isInteger(p.x)&&p.x>=0&&p.x<MAX_MAP&&Number.isInteger(p.z)&&p.z>=0&&p.z<MAX_MAP&&',
""" const p=d.position;
 const deep=d.route==='facility'&&d.id==='base'&&d.townLayout===5&&typeof POI_SACRED_DEPTH_H==='number'&&d.townMapHeight===POI_SACRED_DEPTH_H;
 const position=p&&Number.isInteger(p.x)&&p.x>=0&&p.x<MAX_MAP&&Number.isInteger(p.z)&&p.z>=0&&
  (p.z<MAX_MAP||deep&&p.y>=0&&p.x<POI_SACRED_DEPTH_W&&p.z<POI_SACRED_DEPTH_H)&&""")
rep('d.townMapHeight>=96&&d.townMapHeight<=MAX_MAP?','d.townMapHeight>=96&&(d.townMapHeight<=MAX_MAP||deep)?')
rep('townLayout:5,townMapHeight:128,\n  position:{x:dest.x',
    'townLayout:5,townMapHeight:poiSnowPassBase?.height??(facilitySite?.id===\'base\'?facilitySite.map.height:128),\n  position:{x:dest.x')
rep("const h=(pine?5.4:birch?4.65:5.0)+seed(0)*1.35,w=(pine?1.20:1.48)+seed(1)*.38;",
    "const h=(pine?9.45:birch?7.9:8.8)+seed(0)*2.3,w=(pine?1.5:1.88)+seed(1)*.47;")
rep('[[.30,.24,1], [.47,.23,.84],[.64,.22,.66],[.78,.22,.45]]:', '[[.39,.22,1], [.52,.22,.84],[.67,.21,.66],[.79,.21,.45]]:')
rep('[[.40,.28,.76],[.51,.30,1],[.67,.29,.73]];', '[[.48,.25,.76],[.57,.27,1],[.69,.28,.73]];')
section('function poiSacredFogStrength(','function poiSacredApplyFog(','''function poiSacredFogStrength(site,x,z,y){
 const f=poiSacredForestOf(site);
 if(!f||y!==0)return 0;
 const smooth=(a,b,t)=>{const v=Math.max(0,Math.min(1,(t-a)/(b-a)));return v*v*(3-2*v)};
 const inside=Math.max(...f.coverage.map(b=>Math.min(x-b.x1,b.x2-x,z-b.z1,b.z2-z)));
 const progression=smooth(69,109,z);
 const close=smooth(2.2,10.5,Math.hypot(x-f.reveal.x,z-f.reveal.z));
 // Clear meadow, layered distance in the woods, then let the stone and
 // candlelight take over only at the actual path's final turn.
 return .96*progression*smooth(-1.25,3.2,inside)*close*(1-smooth(123,128,z));
}
''')
rep('smoothstep(2.65,9.7,length(vLootXZ-uSacredFog.xy))','smoothstep(5.1,25.5,length(vLootXZ-uSacredFog.xy))')
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
