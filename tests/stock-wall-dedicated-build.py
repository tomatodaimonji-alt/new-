from pathlib import Path
import re,sys
src=Path(sys.argv[1]).read_text()
def put(a,b):
 global src
 assert src.count(a)==1,a
 src=src.replace(a,b)
vert=re.search(r"^const VERT='([^'\n]+)';",src,re.M).group(1)
assert 'vCol=aCol*l*mix(1.0,wallShade(n)/wallShade(aNorm),aHybridWallFace)' in vert
simple='precision highp float;attribute vec3 aPos;attribute vec3 aNorm;attribute vec3 aCol;uniform mat4 uMVP;varying vec3 vCol;varying mediump vec2 vHybridWallBand;varying mediump float vWorldHeight;varying mediump vec2 vLootXZ;void main(){gl_Position=uMVP*vec4(aPos,1.0);vWorldHeight=aPos.y;vLootXZ=aPos.xz;vHybridWallBand=vec2(0.0);float l=.60+.40*max(dot(normalize(aNorm),normalize(vec3(-.4,1.0,.35))),0.0);vCol=aCol*l;}'
put("const VERT='"+vert+"';","const VERT='"+simple+"';\nconst WALL_VERT='"+vert+"';")
props=dict(re.findall(r"(\w+):gl.getUniformLocation\(program,'(\w+)'\)",src))
attrs=dict(re.findall(r"(\w+):gl.getAttribLocation\(program,'(\w+)'\)",src))
assert {'p','n','c','hybridWallRot','hybridWallFace','hybridWallBand','hybridWallShift'} <= attrs.keys()
assert len(props)==14,props
def literal(d):return '{'+','.join(f"{k}:'{v}'" for k,v in d.items())+'}'
before='let program;try{program=gl.createProgram();'
put(before,'const poiWallDedicatedRequested=new URLSearchParams(location.search).get("dedicated-wall")==="1";\nlet poiWallProgram=null,poiWallLoc=null;\n'+before)
put('gl.attachShader(program,sh(gl.VERTEX_SHADER,VERT));','''if(poiWallDedicatedRequested&&(typeof gl.drawArraysInstanced==='function'||gl.getExtension('ANGLE_instanced_arrays'))){
 try{
  poiWallProgram=gl.createProgram();
  gl.attachShader(poiWallProgram,sh(gl.VERTEX_SHADER,WALL_VERT));
  gl.attachShader(poiWallProgram,sh(gl.FRAGMENT_SHADER,FRAG));
  gl.linkProgram(poiWallProgram);
  if(!gl.getProgramParameter(poiWallProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(poiWallProgram));
  poiWallLoc=Object.create(null);
  for(const [key,name] of Object.entries('''+literal(props)+'''))poiWallLoc[key]=gl.getUniformLocation(poiWallProgram,name);
  for(const [key,name] of Object.entries('''+literal(attrs)+'''))poiWallLoc[key]=gl.getAttribLocation(poiWallProgram,name);
 }catch(e){
  if(poiWallProgram)gl.deleteProgram(poiWallProgram);
  poiWallProgram=poiWallLoc=null;
 }
}
gl.attachShader(program,sh(gl.VERTEX_SHADER,poiWallProgram?VERT:WALL_VERT));''')
# Intercept by source key only the scalar/vector setter sites of the shared game program.
writes=set(re.findall(r"gl.uniform[1234]f\(loc\.(\w+),",src))
assert writes==props.keys()-{'mvp'},(writes,props)
src=re.sub(r"gl\.(uniform[1234]f)\(loc\.(\w+),",r"poiWallUniformWrite('\1','\2',",src)
put("try{initSignProgram()}catch(e)",'''const poiWallUniformState=Object.create(null);
function poiWallUniformWrite(method,key,...args){
 gl[method](loc[key],...args);
 if(poiWallProgram)poiWallUniformState[key]=[method,args];
}
function poiWallUniformUse(){
 if(!poiWallProgram)return loc;
 gl.useProgram(poiWallProgram);
 for(const [key,[method,args]] of Object.entries(poiWallUniformState))gl[method](poiWallLoc[key],...args);
 return poiWallLoc;
}
try{initSignProgram()}catch(e)''')
a=src.index('function poiHybridWallDraw(vp){')
b=src.index('// BEGIN OPTIMIZED FORT POLICY',a)
wall=src[a:b]
assert wall.count('  try{')==1
wall=wall.replace('  try{','  if(!sets.size){if(spec.id!==id)poiSacredFrontierFogRegion(id);continue}\n  const wallLoc=poiWallUniformUse();\n  try{').replace('loc.','wallLoc.')
wall=wall.replace('   if(spec.id!==id)poiSacredFrontierFogRegion(id);\n   for(const a', '   for(const a')
cleanup='gl.vertexAttrib4f(a,0,0,0,1)}\n  }'
assert wall.count(cleanup)==1
wall=wall.replace(cleanup,cleanup[:-3]+'   if(poiWallProgram)gl.useProgram(program);\n   if(spec.id!==id)poiSacredFrontierFogRegion(id);\n  }')
src=src[:a]+wall+src[b:]
Path(sys.argv[2]).write_text(src)
