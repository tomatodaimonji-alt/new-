from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:])
s=src.read_text()
def replace(a,b):
 global s
 if s.count(a)!=1: raise ValueError((s.count(a),a[:180]))
 s=s.replace(a,b,1)
replace('const POI_WILD_MAX=3;', '''const POI_WILD_MAX=3;
const POI_FIELD_NOTICE=6.5,POI_FIELD_ARCHER_NOTICE=8;
const POI_WILD_BIRTH_MARGIN=.20;
function poiWildBirthPlayer(now){
 const p=typeof poiAimOrigin==='function'?poiAimOrigin(now):null;
 return {x:poiWalkX,z:poiWalkZ,pose:p?.y===0&&Number.isFinite(p.x)&&Number.isFinite(p.z)?p:null};
}
function poiWildBeyondNotice(x,z,player,type){
 const d=(type==='monsterSkelArcher'?POI_FIELD_ARCHER_NOTICE:POI_FIELD_NOTICE)+POI_WILD_BIRTH_MARGIN;
 return Math.hypot(x-player.x,z-player.z)>d&&
  (!player.pose||Math.hypot(x-player.pose.x,z-player.pose.z)>d);
}''')
replace('Math.hypot(x-player.x,z-player.z)>=3&&canSpawn(x,z)','poiWildBeyondNotice(x,z,player,home.type)&&canSpawn(x,z)')
replace('const p={x:poiWalkX,z:poiWalkZ};\n const home=line.filter','const p=poiWildBirthPlayer(now);\n const home=line.filter')
replace('function poiWildGatePick(rng,gate=poiWildGateApproach()){','function poiWildGatePick(rng,gate=poiWildGateApproach(),player=poiWildBirthPlayer(typeof performance==="undefined"?0:performance.now())){')
replace('if(d>=4.5&&d<=10&&(dx*fx+dz*fz)/d<=.38&&poiWildZone','if(d>0&&d<=10&&(dx*fx+dz*fz)/d<=.38&&poiWildBeyondNotice(x,z,player,\'monsterSlime\')&&poiWildZone')
replace('function poiWildPick(rng){','function poiWildPick(rng){\n const player=poiWildBirthPlayer(typeof performance==="undefined"?0:performance.now());')
replace('if(gate)return poiWildGatePick(rng,gate);','if(gate)return poiWildGatePick(rng,gate,player);')
replace('if(!poiWildExterior(x,z,3)||blocked.has(key)||facilityCreekIndex?.water.has(key)||','if(!poiWildBeyondNotice(x,z,player,\'monsterSlime\')||!poiWildExterior(x,z,3)||blocked.has(key)||facilityCreekIndex?.water.has(key)||')
replace("obj.type==='monsterSkelArcher'&&dist<=8&&(dist>6.5||!poiArmedBound","obj.type==='monsterSkelArcher'&&dist<=POI_FIELD_ARCHER_NOTICE&&(dist>POI_FIELD_NOTICE||!poiArmedBound")
replace('if(state.wildSpawn&&(dist>6.5||state.regionalWild','if(state.wildSpawn&&(dist>POI_FIELD_NOTICE||state.regionalWild')
dst.write_text(s)
