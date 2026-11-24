// BEGIN SACRED FOREST MAP
function extendTownWorldSacredForest(site,temple){
 const world=site.map.world,index=world.length,P=(x,z)=>({x,z,y:0}),K=(x,z)=>x+','+z;
 const covered=[{x1:4,x2:31,z1:71,z2:93},{x1:4,x2:43,z1:89,z2:133},{x1:4,x2:44,z1:126,z2:141}];
 const old=new Set(world.filter(o=>o.y===0).map(o=>K(o.x,o.z)));
 const grade=new Set((site.map.terrainHeights||[]).map(o=>K(o.x,o.z)));
 const occupied=new Set([...old,...grade]),trees=[],soil=[],soft=[];
 const route=knots=>{
  let [x,z]=knots[0];const dots=[P(x,z)];
  for(const [u,v] of knots.slice(1)){
   if(x!==u&&z!==v)throw Error('sacred forest path must remain cardinal');
   while(x!==u||z!==v){x+=Math.sign(u-x);z+=Math.sign(v-z);dots.push(P(x,z));}
  }
  return dots;
 };
 const main=route([[12,49],[12,56],[15,56],[15,67],[13,67],[13,77],[9,77],[9,88],[13,88],[13,99],[18,99],[18,109],[24,109],[24,125]]);
 const east=route([[41,70],[41,77],[38,77],[38,81],[35,81],[35,86],[28,86],[28,95],[19,95],[19,99],[18,99]]);
 const glade=route([[9,81],[6,81],[6,95],[10,95],[10,99],[13,99]]);
 const paths=[main,east,glade],lane=new Set(paths.flatMap(a=>a.map(p=>K(p.x,p.z))));
 for(const p of temple.approach)lane.add(K(p.x,p.z));
 const plant=(p,type,list)=>{
  const k=K(p.x,p.z);
  if(occupied.has(k))return false;
  list.push({...p,type,rot:(p.x*7+p.z*11)%4});occupied.add(k);return true;
 };
 for(const path of paths)for(const p of path){
  // Uninterrupted walkability, gently broken natural path coloration.
  plant(p,(p.x*7+p.z*13)%13<2?'grassTrampled':p.z<69?'roadGravelFull':'earth',soil);
 }
 const noise=(x,z,s=0)=>(Math.imul((x+37)*14513+(z+53)*11579+s*9127,2654435761)>>>0)/4294967296;
 const reveal=P(24,125),ring=temple.ring,canopy=[];
 const keepRoute=(x,z)=>paths.some(a=>a.some(p=>Math.hypot(x-p.x,z-p.z)<2.25));
 const keepGate=(x,z)=>Math.hypot((x-reveal.x)/5.7,(z-reveal.z+1)/6.2)<1||
  x>=20&&x<=28&&z>=124||
  Math.hypot(x-ring.x,z-ring.z)<ring.radius+3.2;
 const openEast=(x,z)=>z<82&&x>=29||z<86&&x>=38;
 const picks=[];
 for(const b of covered)for(let z=b.z1;z<=b.z2;z++)for(let x=b.x1;x<=b.x2;x++){
  const k=K(x,z);
  if(occupied.has(k)||lane.has(k)||z<73||openEast(x,z)||keepGate(x,z)||keepRoute(x,z))continue;
  const screen=(z>=88&&z<=98&&x>=14&&x<=34)||(z>=104&&z<=117&&x>=16&&x<=34);
  const grove=Math.sin(x*.33+z*.23)*Math.sin(x*.17-z*.29)>.2;
  const score=noise(x,z)+.22*(+grove)+.21*(+screen);
  if(score>.69)picks.push({x,z,score,screen});
 }
 picks.sort((a,b)=>b.score-a.score||a.z-b.z||a.x-b.x);
 for(const {x,z,screen} of picks){
  if(trees.length>=96)break;
  if(trees.some(o=>Math.hypot(o.x-x,o.z-z)<3.15))continue;
  const r=noise(x,z,7),kind=screen?(r<.48?'treeCedar':'treePine'):r<.16?'treeBirch':r<.43?'treeOak':r<.68?'treePine':'treeCedar';
  if(plant(P(x,z),kind,trees)&&screen)canopy.push(P(x,z));
 }
 for(const [x,z,type] of [[11,54,'tallGrass'],[19,60,'flowerField'],[11,65,'flowerField'],
  [12,72,'bushFern'],[16,75,'tallGrass'],[11,79,'bushFern'],[7,88,'tallGrass'],[13,91,'bushFern'],
  [15,102,'bushFern'],[21,110,'tallGrass'],[22,114,'bushFern'],[26,119,'tallGrass'],
  [37,77,'flowerField'],[33,83,'bushFern'],[28,89,'tallGrass']]){
  if(!lane.has(K(x,z)))plant(P(x,z),type,soft);
 }
 world.push(...soil,...soft,...trees);
 return {name:'深樹の聖林',difficulty:1,coverage:covered,route:main,routes:paths,trees,canopy,reveal,authored:{index,count:world.length-index}};
}
// END SACRED FOREST MAP
