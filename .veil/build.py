from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
rep(' world.push(...soil,...soft,...trees);\n return {name:',""" // Actual rooted understory and canopy beside the hidden temple: no
 // fake distant silhouette or unwalkable forest wall. Leave both outer
 // east travel strips and periodic dry cross-lanes at z150 and z166.
 const veilSpots=[
  [44,143],[46,146],[44,148],[46,152],[44,154],[46,156],[44,158],
  [46,160],[44,162],[46,164],[44,168],[46,171],[44,174],
  [39,130],[42,133],[45,137],[40,138],[46,141],
  [14,123],[19,124],[31,125],[35,127],
  [4,146],[3,155],[4,160],[5,169],
  [13,178],[21,180],[30,178],[38,177]
 ];
 // Nearer planted crowns interrupt the long northeast ray before it reaches
 // the dome instead of relying on a solid, unwalkable tree curtain.
 const nearer=[[53,129],[55,130],[57,129],[59,131],[50,134],[55,136]];
 const approachEdges=[[22,117],[26,120],[21,121],[27,116]];
 const sleeve=poiSnowSleeveRoute();
 const concealment={trees:[],boxes:[{x1:38,x2:47,z1:127,z2:176},
  {x1:2,x2:13,z1:141,z2:174},{x1:6,x2:42,z1:174,z2:181},
  {x1:49,x2:62,z1:128,z2:137}]};
 for(let i=0;i<veilSpots.length;i++){
  const [x,z]=veilSpots[i],p=P(x,z),type=i%5===2?'treePine':'treeCedar';
  if(x===43||x===47||z===150||z===166||keepRoute(x,z)||
     x>=20&&x<=28&&z<144||Math.hypot(x-ring.x,z-ring.z)<ring.radius+1.8)continue;
  plant(p,type,concealment.trees);
 }
 for(const [x,z] of nearer)if(!sleeve.some(p=>Math.abs(x-p.x)+Math.abs(z-p.z)<2))
  plant(P(x,z),'treeOak',concealment.trees);
 for(const [x,z] of approachEdges)if(z<122&&Math.abs(x-temple.entrance.x)>=2)
  plant(P(x,z),'treeOak',concealment.trees);
 world.push(...soil,...soft,...trees,...concealment.trees);
 return {concealment,name:""")
rep("if(!inspect&&!f.coverage.some(b=>within(b,23))){poiSacredClearScene();return}",
"""if(!inspect&&!f.coverage.some(b=>within(b,23))&&!f.concealment?.boxes.some(b=>within(b,23))){poiSacredClearScene();return}""")
# Preserve historical/core profile count; the live forest and resume see
# the extra individually rooted authoring through the same original systems.
rep("index=new Set(f.trees.map(poiSacredForestKey));", "index=new Set(f.trees.concat(f.concealment?.trees??[]).map(poiSacredForestKey));")
rep("if(!f.trees.some(o=>o.x===p.x&&o.z===p.z)||", "if(!f.trees.concat(f.concealment?.trees??[]).some(o=>o.x===p.x&&o.z===p.z)||")
# The old ground generator runs after authoring: add existing natural grade
# beneath newly planted live sleeve trees without skipping its old records.
rep("""function poiSnowPassSeam(site,world){
 if(site?.id!=='base')return false;
 const own=new Set(world.filter(o=>o.y===0).map(o=>o.x+','+o.z));""",
"""function poiSnowPassSeam(site,world){
 if(site?.id!=='base')return false;
 const roots=new Set((site.sacredForest?.concealment?.trees??[]).filter(o=>o.x>=48).map(poiSacredForestKey));
 const own=new Set(world.filter(o=>o.y===0&&(!roots.size||!roots.has(poiSacredForestKey(o)))).map(o=>o.x+','+o.z));""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
