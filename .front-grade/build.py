import sys
from pathlib import Path
src,dst=map(Path,sys.argv[1:3])
s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
rep('function poiSacredInteriorGrade(site,x,z,type,play){','''function poiSacredGroundLights(site,objects,play){
 if(!play||site?.id!=='base'||site?.davidTemple?.depth!==1)return pineFloorLightingSources(objects);
 // A hidden shell must not leave a visible ring in the baked outside grass.
 // Keep real shadows in editor, and independently computed interior light.
 return pineFloorLightingSources(objects.filter(o=>!(o.y===0&&/^poiDavidWall/.test(o.type)&&poiSacredTempleVisualMember(site,o))));
}
function poiSacredInteriorGrade(site,x,z,type,play){''')
rep(' const {blockers:pineShadows,lamps:pineWarmLamps}=pineFloorLightingSources(localGradeSources.length?visible.concat(localGradeSources):visible);',
''' const gradeObjects=localGradeSources.length?visible.concat(localGradeSources):visible;
 const {blockers:pineShadows,lamps:pineWarmLamps}=typeof poiSacredGroundLights==='function'?
  poiSacredGroundLights(facilitySite,gradeObjects,poiWalkActive):pineFloorLightingSources(gradeObjects);''')
rep("walls:wallExteriorLookup(statics),lights:pineFloorLightingSources(statics.filter(o=>!poiSacredInteriorSconce(layout,o)))};",
'''walls:wallExteriorLookup(statics),lights:poiSacredGroundLights(layout,statics.filter(o=>!poiSacredInteriorSconce(layout,o)),true)};''')
# Stock and streamed grade must agree on physical Base ownership.
rep('function poiSnowSleeveRoute(){',"""function poiOverlandBaseGroundOwn(x,z,width,height){
 return x>=0&&x<width&&z>=0&&z<height&&
  (width!==128||height!==182||z<128||x<48||poiSnowSleeveOwn(x,z));
}
function poiSnowSleeveRoute(){""")
rep("  for(let x=0,cols=MAP_W===128&&MAP_H===182&&z>=128?(z<139?72:48):MAP_W;x<cols;x++){",
    "  for(let x=0;x<MAP_W&&poiOverlandBaseGroundOwn(x,z,MAP_W,MAP_H);x++){")
rep("?(x,z)=>z<128||x<48||poiSnowSleeveOwn(x,z):null;",
    "?(x,z)=>poiOverlandBaseGroundOwn(x,z,width,height):null;")
visibility_start=s.index('function poiSacredTempleVisibleAmount(')
visibility_end=s.index('function poiSacredTempleViewAmount(',visibility_start)
rep(s[visibility_start:visibility_end],"""function poiSacredTempleVisibleAmount(site,x,z,y,inspect){
 const t=site?.id==='base'?site.davidTemple:null;
 if(!t?.interior||t.depth!==1||inspect||y!==0)return 1;
 if(poiDavidTempleEnclosedAt(site,x,z,y))return 1;
 const a=t.entrance,approach=a.z-z;
 if(approach<-.5)return 0;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
 // Real north passage only. Wall, roofs and their environment cannot
 // discover the room from east/west/south or a neighboring region.
 return (1-smooth((approach-4)/7))*(1-smooth((Math.abs(x-a.x)-3.2)/4.8));
}
""")
# Remove the no-longer-visible duplicate Snow-side architecture and its preparation.
a=s.index('// BEGIN NEIGHBOR SACRED EXTERIOR')
b=s.index('// END NEIGHBOR SACRED EXTERIOR',a)+len('// END NEIGHBOR SACRED EXTERIOR')
rep(s[a:b],"""function poiSnowTempleRim(x,z){
 return x>=43&&x<48.5&&z>=140&&z<171;
}""")
rep(" if(typeof poiSnowExteriorPrime==='function')poiSnowExteriorPrime();\n","")
rep(" if(typeof poiSnowExteriorDraw==='function')poiSnowExteriorDraw(p.vp);\n","")
rep("&&poiSnowExteriorReady(dest)","")
rep("if(typeof poiSnowExteriorClear==='function')poiSnowExteriorClear();","")
rep('!poiSnowExteriorBaseRim(', '!poiSnowTempleRim(')
# Treat only the real bounded Base grounds as sacred. Forest presentation
# uses existing art/fog, no extra geometry, no new obstructed routes.
rep('function poiSacredForestContains(site,x,z,y){',"""function poiSacredPerimeter(site,x,z,y){
 const t=site?.id==='base'?site.davidTemple:null,r=t?.ring;
 if(!r||!t.interior||t.depth!==1||y!==0||x<0||x>=48||z<128||z>=182||
    t.enclosure?.has(Math.floor(x+.5)+','+Math.floor(z+.5)))return 0;
 const smooth=(a,b,v)=>{const k=Math.max(0,Math.min(1,(v-a)/(b-a)));return k*k*(3-2*k)};
 const nearRoute=(1-smooth(3.2,8,Math.abs(x-t.entrance.x)))*(1-smooth(t.entrance.z+3,t.interior.exitZ,z));
 return (1-smooth(r.radius+4.5,r.radius+12,Math.hypot(x-r.x,z-r.z)))*(1-nearRoute);
}
function poiSacredForestContains(site,x,z,y){""")
rep('return !!f&&y===0&&f.coverage.some(b=>x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2);',
 'return !!f&&y===0&&(f.coverage.some(b=>x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2)||poiSacredPerimeter(site,x,z,y)>.12);')
rep('return .985*progression*smooth(-1.25,3.2,inside)*close*(1-smooth(123,128,z));',
 'return Math.max(.985*progression*smooth(-1.25,3.2,inside)*close*(1-smooth(123,128,z)),.57*poiSacredPerimeter(site,x,z,y));')
# Genuine perspective eye, double aperture, rendered only (not targeting/AI).
rep("return{...q,halfH,halfW,centerX,centerZ,elev,targetY,...sky,vp:","return{...q,halfH,halfW,centerX,centerZ,elev,targetY,eye,...sky,vp:")
rep(" const p=parameters();poiSkyBackdrop(p);",
""" const p=parameters();poiSkyBackdrop(p);
 const sacredPeek=typeof poiSacredTunnelSight==='function'&&poiWalkActive&&!pineAIActive&&!cameraTopDown&&
  poiSacredTunnelSight(facilitySite,p.eye,poiWalkViewX,poiWalkViewZ,poiWalkLevel);""")
rep("poiSacredInteriorDraw(p.vp);","poiSacredInteriorDraw(p.vp,sacredPeek);")
rep("poiMonsterRender(now,p.vp);","poiMonsterRender(now,p.vp,sacredPeek);")
rep("function poiSacredInteriorPlayer(){","""function poiSacredTunnelBoss(site,o){
 const b=site?.id==='base'?site.davidTemple?.boss:null;
 return !!b&&o.type===b.type&&o.x===b.x&&o.z===b.z&&o.y===b.y;
}
function poiSacredTunnelSight(site,eye,x,z,y){
 const t=site?.id==='base'?site.davidTemple:null,i=t?.interior;
 if(!eye||!i||t.depth!==1||y!==0||z<t.entrance.z-8||z>i.exitZ||
    Math.abs(x-t.entrance.x)>4.2||eye[2]>=i.exitZ||eye[2]<t.entrance.z-15)return false;
 const r=t.ring,tx=r.x+.5,tz=r.z+.5;
 // Project through both actual apertures. Conservative edges leave stone
 // thickness/lintel in charge of occlusion rather than opening a side wall.
 const through=(gz,targetY)=>{
  if(gz<=eye[2])return true;
  const u=(gz-eye[2])/(tz-eye[2]),px=eye[0]+(tx-eye[0])*u,py=eye[1]+(targetY-eye[1])*u;
  return px>=i.minX+.09&&px<=i.maxX+.91&&py>.08&&py<3.10;
 };
 return [.9,1.7,2.5].some(h=>through(t.entrance.z,h)&&through(i.exitZ,h));
}
function poiSacredInteriorPlayer(){""")
rep("function poiSacredInteriorDraw(vp){","function poiSacredInteriorDraw(vp,peek=false){")
rep("if(!inside&&!near||!t?.interiorFloors)return;","if(!inside&&!near&&!peek||!t?.interiorFloors)return;")
rep("if(inside)for(const m of q.draws)","if(inside||peek)for(const m of q.draws)")
rep("function poiMonsterRender(now,vp){","function poiMonsterRender(now,vp,sacredPeek=false){")
rep("const sacred=poiSacredInteriorPlayer();","const sacred=sacredPeek||poiSacredInteriorPlayer();")
rep("const onSlice=(o,state)=>poiSacredInteriorHostileVisible(o)&&",
"""const onSlice=(o,state)=>(poiSacredInteriorHostileVisible(o)||sacredPeek&&poiSacredTunnelBoss(facilitySite,o))&&""")
# The published combat lock still calls poiSacredInteriorHostileVisible with
# no aperture exception. Warmth follows actual fractional walking, not HUD state.
rep("function poiTownSceneLight(){","""function poiSacredTunnelLight(site,x,z,y,outside){
 const t=site?.id==='base'?site.davidTemple:null,i=t?.interior;
 if(!i||t.depth!==1||y!==0||!t.enclosure?.has(Math.floor(x+.5)+','+Math.floor(z+.5)))return outside;
 const sm=(a,b,v)=>{const k=Math.max(0,Math.min(1,(v-a)/(b-a)));return k*k*(3-2*k)};
 const inside=sm(t.entrance.z,t.entrance.z+6,z),chamber=sm(i.exitZ-2,i.exitZ+3,z);
 const warm=[.76,.65,.54],hall=[.77,.70,.62];
 return Array.from(outside,(v,j)=>v+(warm[j]+(hall[j]-warm[j])*chamber-v)*inside);
}
function poiTownSceneLight(){""")
rep(""" const field=v=>white>0?v.map(c=>c+(1-c)*white):v;
 if(typeof poiDavidTempleEnclosedAt==='function'&&poiDavidTempleEnclosedAt(facilitySite,poiWalkX,poiWalkZ,poiWalkLevel))
  return poiDavidTempleTunnelAt(facilitySite,poiWalkX,poiWalkZ,poiWalkLevel)?[.76,.65,.54]:[.77,.70,.62];""",
""" const field=v=>{
  const lit=white>0?v.map(c=>c+(1-c)*white):v;
  return typeof poiSacredTunnelLight==='function'?poiSacredTunnelLight(facilitySite,poiWalkViewX,poiWalkViewZ,poiWalkLevel,lit):lit;
 };""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
