from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1: raise SystemExit(f'expected one anchor ({s.count(a)}), {a[:120]}')
 s=s.replace(a,b,1)
rep(' const openEast=(x,z)=>z<82&&x>=29||z<86&&x>=38;',
''' // Lower foliage at the eastern bend screens the stone through long, tall
 // trunks. No tree touches either physical walking route or the close reveal.
 const undergrowth=[];
 for(const [x,z] of [[37,84],[39,86],[40,88],[37,90],[32,90],[34,91],[36,93],[32,95],[39,94],[36,96]]){
  if(!keepRoute(x,z)&&!keepGate(x,z)&&plant(P(x,z),'treeCedar',trees))undergrowth.push(P(x,z));
 }
 const openEast=(x,z)=>z<82&&x>=29||z<86&&x>=38;''')
rep('routes:paths,trees,canopy,reveal,authored:', 'routes:paths,trees,canopy,undergrowth,reveal,authored:')
rep(' const h=(pine?9.45:birch?7.9:8.8)+seed(0)*2.3,w=(pine?1.5:1.88)+seed(1)*.47;',
''' const closeNeedles=poiSacredForestOf(typeof facilitySite==='undefined'?null:facilitySite)?.undergrowth
  ?.some(p=>p.x===o.x&&p.z===o.z);
 const h=closeNeedles?4.5+seed(0)*1.4:(pine?9.45:birch?7.9:8.8)+seed(0)*2.3;
 const w=closeNeedles?2.35+seed(1)*.45:(pine?1.5:1.88)+seed(1)*.47;''')
rep(' const layers=pine?[[.39,.22,1], [.52,.22,.84],[.67,.21,.66],[.79,.21,.45]]:',
''' const layers=closeNeedles?[[.22,.31,1], [.39,.34,.88],[.58,.30,.62],[.77,.23,.39]]:
  pine?[[.39,.22,1], [.52,.22,.84],[.67,.21,.66],[.79,.21,.45]]:''')
rep('uniform vec3 uSacredFog;', '''uniform vec3 uSacredFog;
uniform vec4 uSacredEdge;''')
rep(' gl_FragColor=vec4(color,1.0);',
''' // Only rays entering the distant sacred parcel are veiled. No sky pixels,
 // near player/road geometry, or east/south town scenery use this branch.
 if(uSacredEdge.w>0.0){
  float distanceToPlayer=length(vLootXZ-uSacredFog.xy);
  float parcel=smoothstep(89.0,112.0,vLootXZ.y)*
    smoothstep(2.0,11.0,vLootXZ.x)*(1.0-smoothstep(43.0,49.0,vLootXZ.x));
  float veil=uSacredEdge.w*parcel*smoothstep(11.0,41.0,distanceToPlayer);
  color=mix(color,uSacredEdge.xyz,veil);
 }
 gl_FragColor=vec4(color,1.0);''')
rep("sacredFog:gl.getUniformLocation(program,'uSacredFog'),",
    "sacredFog:gl.getUniformLocation(program,'uSacredFog'),sacredEdge:gl.getUniformLocation(program,'uSacredEdge'),")
rep('function poiSacredApplyFog(now,light){',
'''function poiSacredEdgeFog(site,x,z,y){
 if(!poiSacredForestOf(site)||y!==0)return 0;
 const sm=(a,b,t)=>{const v=Math.max(0,Math.min(1,(t-a)/(b-a)));return v*v*(3-2*v)};
 // Start in the OUTSIDE segment past the meadow, not on crossing a HUD region.
 return .988*sm(24,37,x)*(1-sm(45,53,x))*sm(69,74,z)*(1-sm(96,116,z));
}
let poiSacredEdgeMinute=-1,poiSacredEdgeColor=null,poiSacredEdgeOn=false;
function poiSacredEdgeHorizon(minute){
 if(minute===poiSacredEdgeMinute)return poiSacredEdgeColor;
 let i=1;while(i<POI_SKY_COLOR.length-1&&minute>=POI_SKY_COLOR[i][0])i++;
 const [a,,from]=POI_SKY_COLOR[i-1],[b,,to]=POI_SKY_COLOR[i],t=(minute-a)/(b-a);
 poiSacredEdgeMinute=minute;
 return poiSacredEdgeColor=from.map((v,j)=>(v+(to[j]-v)*t)*.90/255);
}
function poiSacredApplyFog(now,light){''')
rep(' const fog=p?poiSacredFogStrength(facilitySite,p.x,p.z,p.y):0;\n if(fog>0.001){',
''' const fog=p?poiSacredFogStrength(facilitySite,p.x,p.z,p.y):0;
 const edge=p?poiSacredEdgeFog(facilitySite,p.x,p.z,p.y):0;
 if(edge>0.001){
  const minute=Math.floor(poiTownClockGameMs/POI_TOWN_MINUTE_MS%1440);
  gl.uniform4f(loc.sacredEdge,...poiSacredEdgeHorizon(minute),edge);
  if(fog<=0.001)gl.uniform3f(loc.sacredFog,p.x+.5,p.z+.5,0);
  poiSacredEdgeOn=true;
 }else if(poiSacredEdgeOn){
  gl.uniform4f(loc.sacredEdge,0,0,0,0);
  poiSacredEdgeOn=false;
 }
 if(fog>0.001){''')
rep('  gl.uniform3f(loc.sacredFog,0,0,0);\n  gl.clearColor(0,0,0,0);',
    '  if(edge<=0.001)gl.uniform3f(loc.sacredFog,0,0,0);\n  gl.clearColor(0,0,0,0);')
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
