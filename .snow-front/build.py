from pathlib import Path
import sys
root=Path(__file__).parent;src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1:raise SystemExit(f'expected one anchor ({s.count(a)}): {a[:130]}')
 s=s.replace(a,b,1)
def section(a,b,value):
 i=s.index(a);j=s.index(b,i+len(a));rep(s[i:j],value)
section('// BEGIN SOUTH SNOW HORIZON','// END SOUTH SNOW HORIZON','')
rep('// END SOUTH SNOW HORIZON\n','')
rep(" if(typeof facilityDrawSnowHorizon==='function')\n  facilityDrawSnowHorizon(p);\n",'')
rep(' return x>=48&&x<64&&z>=128&&z<139;',
    ' return x>=48&&x<72&&z>=128&&z<139;')
section('function poiSnowPassLink(','function poiSnowPassDecode(', (root/'topology.js').read_text())
rep('for(let x=48;x<64;x++){','for(let x=48;x<72;x++){')
rep("const type=lane.has(key)?'roadGravelFull':z>=136?'poiSnowGround':(x*7+z*17)%9<3?'grassPebbles':'grass';",
    "const type=lane.has(key)?'roadGravelFull':(x*7+z*17)%9<3?'grassPebbles':'grass';")
rep(" return world.some(o=>o.x===60&&o.z===138&&o.y===0&&o.type==='roadGravelFull');",
''' // A real authored walkable lip on the sacred map's eastern ground.
 // Its previously empty natural-grade cells retain the same legal positions.
 for(let z=139;z<168;z++)if(!own.has('47,'+z))world.push({x:47,z,y:0,type:'grass',rot:0});
 return world.some(o=>o.x===60&&o.z===138&&o.y===0&&o.type==='roadGravelFull');''')
rep('z>=128?(z<139?64:48):MAP_W','z>=128?(z<139?72:48):MAP_W')
rep(" if(!link||!world.some(o=>o.x===fx&&o.z===fz&&o.y===0&&o.type==='roadGravelFull'))return null;\n return link;",
''' if(!link||!poiSnowEdgeWalkable(world,fx,fz))return null;
 const other=link.region==='base'?poiSnowPassBase?.world:(poiOverlandSnow??=poiSnowPassMap()).map.world;
 return other&&poiSnowEdgeWalkable(other,link.x,link.z)?link:null;''')
rep(" const cells=(onBase?map.world:base.world).filter(o=>o.x===dest.x&&o.z===dest.z&&o.y===0);\n if(!cells.some(o=>o.type==='roadGravelFull')||cells.some(o=>isWallId(o.type)))return null;",
''' if(!poiSnowEdgeWalkable(onBase?map.world:base.world,dest.x,dest.z))return null;''')
rep('function commit(){poiWildInvalidate();','function commit(){poiSnowEdgeFloorCache.delete(world);poiWildInvalidate();')
rep('function poiTownSceneLight(){', (root/'atmosphere.js').read_text()+'''function poiTownSceneLight(){''')
rep(" if(facilitySite?.id!=='base'||!poiWalkActive||pineAIActive||poiWalkLevel<0)return POI_TOWN_LIGHT_NEUTRAL;",
''' const snow=facilitySite?.id==='snowpass'&&typeof poiSnowBiomeLightWeight==='function';
 if(facilitySite?.id!=='base'&&!snow||!poiWalkActive||pineAIActive||poiWalkLevel<0)return POI_TOWN_LIGHT_NEUTRAL;
 const white=snow?poiSnowBiomeLightWeight(poiWalkViewX,poiWalkViewZ):0;
 const field=v=>white>0?v.map(c=>c+(1-c)*white):v;''')
rep('const [start,a]=POI_TOWN_LIGHT[i-1];if(a===b)return a;',
    'const [start,a]=POI_TOWN_LIGHT[i-1];if(a===b)return field(a);')
rep('  return a.map((v,j)=>v+(b[j]-v)*t);\n }\n return POI_TOWN_LIGHT_NIGHT;',
    '  return field(a.map((v,j)=>v+(b[j]-v)*t));\n }\n return field(POI_TOWN_LIGHT_NIGHT);')
rep("  facilitySite?.id==='base'&&poiWalkLevel===0&&!poiWalkIndoor();",
    "  (facilitySite?.id==='base'||facilitySite?.id==='snowpass')&&poiWalkLevel===0&&!poiWalkIndoor();")
rep('const a=ambientTint(x0,z0),b=ambientTint(x0,z1),d=ambientTint(x1,z0),e=ambientTint(x1,z1);',
    'const a=ambientTint(x0,z0,c),b=ambientTint(x0,z1,c),d=ambientTint(x1,z0,c),e=ambientTint(x1,z1,c);')
rep('ambientTint||eastBlend,pinePlayJoinedNaturalGrade(kind,facilitySite,poiWalkActive));',
    "(typeof poiSnowGroundEdgeTint==='function'?poiSnowGroundEdgeTint(facilitySite?.id,x,z,kind,ambientTint||eastBlend):ambientTint||eastBlend),pinePlayJoinedNaturalGrade(kind,facilitySite,poiWalkActive));")
tint="   const tint=ambient&&(!floors.has(key)||x-offset>=72&&Object.hasOwn(PINE_EAST_NATURE_TONES,tile))?ambient:null;"
modern=tint.replace("(!floors.has(key)","(tile!==original||!floors.has(key)")
source=modern if modern in s else tint
rep(source,source.replace("const tint=","const oldTint=")+
    "\n   const tint=poiSnowGroundEdgeTint(region.id,x,z,tile,oldTint);")
rep(" return id==='snowpass'&&(z<=17+pad||hasMilda&&z>=17-pad)||",
    " return id==='snowpass'&&(z<=17+pad||x<=12+pad||hasMilda&&z>=17-pad)||")
rep("  id==='base'&&x>=45-pad&&x<=74+pad&&z>=119-pad;",
    "  id==='base'&&x>=42-pad&&x<=77+pad&&z>=119-pad;")
rep('function poiOverlandPrimeMusic(site){',
'''function poiSnowNearFrontage(site,x,z,pad){
 return site==='snowpass'&&(x<=pad||z<=pad)||
  site==='base'&&(x>=48-pad&&x<72+pad&&z>=138-pad&&z<139||
   x>=47-pad&&x<48&&z>=139-pad&&z<168+pad);
}
function poiOverlandPrimeMusic(site){''')
rep(" const target=site==='base'&&Math.abs(x-60)<=4&&z>=132?'snowpass':\n  site==='snowpass'&&Math.abs(x-12)<=3&&z<=6?'base':null;",
    " const target=poiSnowNearFrontage(site,x,z,7)?(site==='base'?'snowpass':'base'):null;")
rep("  const stillNear=region===target||region===site&&(target==='snowpass'?\n   Math.abs(currentX-60)<=4&&currentZ>=132:Math.abs(currentX-12)<=3&&currentZ<=6);",
    "  const stillNear=region===target||region===site&&poiSnowNearFrontage(site,currentX,currentZ,7);")
rep('function poiOverlandPreviewTick(){',
'''let poiSnowTempleNeighbor=[];
function poiSnowTempleNeighborTick(){
 const snow=poiOverlandSnow??=poiSnowPassMap(),map=snow.map;
 const area=poiOverlandSpecFor('snowpass',snow,map.world,map.width,map.height);
 const list=poiOverlandQueue([area],poiWalkViewX,poiWalkViewZ,17,9);
 poiOverlandClear(new Set(list.map(q=>q.key)));
 poiOverlandBakeFrame(list,[area],false);
 for(const q of list){const m=poiOverlandMeshes.get(q.key);if(m)poiSnowTempleNeighbor.push(m)}
}
function poiSnowTempleNeighborDraw(vp){
 if(!poiSnowTempleNeighbor.length)return;
 const view=poiOverlandNeighborVP(vp,'base','snowpass');
 const [x,z]=poiOverlandLocal('snowpass',poiWalkViewX,poiWalkViewZ),now=performance.now();
 for(const m of poiSnowTempleNeighbor)if(poiOverlandBoxVisible(view,m.bounds)){
  if(typeof poiStreamPropDraw==='function')poiStreamPropDraw(m,view,x+.5,z+.5,now);
  else draw(m,view);
 }
}
function poiOverlandPreviewTick(){''')
rep(' poiOverlandCommands=[];poiOverlandDrawn=[];poiOverlandDrawing=false;',
    ' poiOverlandCommands=[];poiOverlandDrawn=[];poiOverlandDrawing=false;poiSnowTempleNeighbor=[];')
rep(' const eligible=registered&&!templeGround&&poiWalkActive&&poiWalkLevel===0&&!cameraTopDown&&!pineAIActive&&facilityVisibilityOwner()===null;',
''' const outdoor=registered&&poiWalkActive&&poiWalkLevel===0&&!cameraTopDown&&!pineAIActive&&facilityVisibilityOwner()===null;
 if(outdoor&&templeGround&&poiSnowNearFrontage(site,poiWalkViewX,poiWalkViewZ,12)){
  poiOverlandPrimeMusic(site);poiSnowTempleNeighborTick();
  return null; // Ordinary temple renderer remains the only base-ground owner.
 }
 const eligible=outdoor&&!templeGround;''')
rep(' facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);}',
    " facilityDrawRoofs(p.vp);poiDrawGameRoofs(p.vp);if(typeof poiSnowTempleNeighborDraw==='function')poiSnowTempleNeighborDraw(p.vp);}")
# Last outlet predicate needs real ground, not a special road gate.
# Existing direct editor return still uses that old guaranteed road through POI_SNOW_PASS.base.
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
