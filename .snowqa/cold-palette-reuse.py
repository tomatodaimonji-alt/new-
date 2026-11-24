from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def patch(a,b):
 global s
 assert s.count(a)==1,a
 s=s.replace(a,b,1)
patch('function refreshPalette(){\n renderRoadList();',"""let poiOverlandPalettePresentation=null;
function poiOverlandPaletteCanReuse(p,site,objects,mapModels,mapPrefabs,selection,continuous){
 return !!(continuous&&p&&p.site===site&&p.objects===objects&&p.models===mapModels&&p.prefabs===mapPrefabs&&p.selected===selection);
}
function refreshPalette(){
 renderRoadList();""")
patch(' renderObjectList();\n updateSelected();\n}\nfunction numeric(',''' renderObjectList();
 updateSelected();
 poiOverlandPalettePresentation={site:facilitySite,objects:world,models,prefabs,selected};
}
function numeric(''')
patch(" facilityUpdateCellarOption(saved.hasCellar);refreshPalette();", """ facilityUpdateCellarOption(saved.hasCellar);
 // Snow's quiet map loader preserves the exact base palette. Reuse it
 // only during a held traverse and only if no other UI repainted it.
 if(poiOverlandPaletteCanReuse(poiOverlandPalettePresentation,facilitySite,world,models,prefabs,selected,poiOverlandKeepAnalog))updateSelected();
 else refreshPalette();""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
