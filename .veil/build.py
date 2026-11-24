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
 const concealment={trees:[],boxes:[{x1:38,x2:47,z1:127,z2:176},
  {x1:2,x2:13,z1:141,z2:174},{x1:6,x2:42,z1:174,z2:181}]};
 for(let i=0;i<veilSpots.length;i++){
  const [x,z]=veilSpots[i],p=P(x,z),type=i%5===2?'treePine':'treeCedar';
  if(x===43||x===47||z===150||z===166||keepRoute(x,z)||
     x>=20&&x<=28&&z<144||Math.hypot(x-ring.x,z-ring.z)<ring.radius+1.8)continue;
  if(plant(p,type,trees))concealment.trees.push(trees.at(-1));
 }
 world.push(...soil,...soft,...trees);
 return {concealment,name:""")
rep("if(!inspect&&!f.coverage.some(b=>within(b,23))){poiSacredClearScene();return}",
"""if(!inspect&&!f.coverage.some(b=>within(b,23))&&!f.concealment?.boxes.some(b=>within(b,23))){poiSacredClearScene();return}""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
