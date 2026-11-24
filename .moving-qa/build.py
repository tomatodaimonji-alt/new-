from pathlib import Path
import sys
src,out=map(Path,sys.argv[1:3]);s=src.read_text()
old="""  const type=poiInventorySlot(poiHotbarRead(),slot);
  return type===POI_FIRE_WAND||!!poiHotbarWeaponForType(type)||type==='healingHerb'||type==='cannedFood'?{slot,type}:null;"""
new="""  const kit=poiHotbarRead();
  if(slot===poiGoldHotbarSlot(kit))return null;
  const type=poiInventorySlot(kit,slot);
  // The normal shortcut for bare hands is a truly empty slot.
  return type===null||type===POI_FIRE_WAND||!!poiHotbarWeaponForType(type)||type==='healingHerb'||type==='cannedFood'?{slot,type}:null;"""
assert s.count(old)==1
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s.replace(old,new,1))
