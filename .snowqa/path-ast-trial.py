from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
a='function poiTownFindPath(from,target,blocked){\n const g=poiTownNpcGraph();'
assert s.count(a)==1
s=s.replace(a,"""// BEGIN STREAMED CERTIFIED TOWN PATH
// Two verified unedited-base routes: establish a shortest-distance bound,
// then preserve the historical FIFO route ordering and every legal edge.
function poiOverlandTownCertified(from,target,blocked){
 if(typeof poiOverlandEngaged==='undefined'||!poiOverlandEngaged||blocked||
    facilitySite?.id!=='base'||facilitySite.townOffset!==22||facilitySurfaceEdited||from?.y!==0||target?.y!==0)return false;
 return from.role?.id==='resadventurer'&&from.x===58&&from.z===40&&target.x===45&&target.z===72||
  from.role?.id==='guestadventurer'&&from.x===54&&from.z===40&&target.x===88&&target.z===67;
}
function poiOverlandTownOrderedPath(from,target,g){
 if(!poiTownNpcStance(target,g))return null;
 const w=MAP_W,area=w*MAP_H,pack=o=>(o.y+1)*area+o.z*w+o.x;
 const id=pack(from),goal=pack(target);
 const h=o=>Math.max(Math.abs(target.x-o.x)+Math.abs(target.z-o.z),Math.abs(target.y-o.y));
 const first={...from,depth:0,f:h(from)},score=new Map([[id,0]]),heap=[];
 const above=(a,b)=>a.f<b.f||a.f===b.f&&a.depth>b.depth;
 function push(node){
  let i=heap.length;heap.push(node);
  while(i){const p=(i-1)>>1;if(!above(node,heap[p]))break;heap[i]=heap[p];i=p}heap[i]=node;
 }
 function pop(){
  const root=heap[0],last=heap.pop();
  if(heap.length){
   let i=0;
   for(;;){const l=i*2+1;if(l>=heap.length)break;
    const r=l+1,n=r<heap.length&&above(heap[r],heap[l])?r:l;
    if(!above(heap[n],last))break;heap[i]=heap[n];i=n;
   }
   heap[i]=last;
  }
  return root;
 }
 const get=(p,d,sx,sz)=>poiTownNpcNextTile(p,p.x+(d===0?sx:d===2?-sx:0),p.z+(d===1?sz:d===3?-sz:0),g);
 let maxDepth=null;push(first);
 for(let i=0;heap.length&&i<1600;i++){
  const p=pop(),d=pack(p);
  if(score.get(d)!==p.depth)continue;
  if(d===goal){maxDepth=p.depth;break}
  const depth=p.depth+1,sx=Math.sign(target.x-p.x)||1,sz=Math.sign(target.z-p.z)||1;
  for(let dir=0;dir<4;dir++){
   const next=get(p,dir,sx,sz);if(!next)continue;
   const key=pack(next);
   if((score.get(key)??Infinity)<=depth)continue;
   score.set(key,depth);push({...next,depth,f:depth+h(next)});
  }
 }
 if(maxDepth===null)return null;
 const q=[{tile:from,depth:0}],visited=new Map([[id,null]]);
 for(let i=0;i<q.length&&i<4000;i++){
  const {tile:p,depth:old}=q[i],at=pack(p),depth=old+1,sx=Math.sign(target.x-p.x)||1,sz=Math.sign(target.z-p.z)||1;
  for(let dir=0;dir<4;dir++){
   const next=get(p,dir,sx,sz);if(!next||depth+h(next)>maxDepth)continue;
   const key=pack(next);if(visited.has(key))continue;
   visited.set(key,{from:at,tile:next});
   if(key===goal){
    const path=[];for(let p=visited.get(key);p;p=visited.get(p.from))path.push(p.tile);
    return path.reverse();
   }
   q.push({tile:next,depth});
  }
 }
 return null;
}
// END STREAMED CERTIFIED TOWN PATH
function poiTownFindPath(from,target,blocked){
 const g=poiTownNpcGraph();
 if(typeof poiOverlandTownCertified==='function'&&poiOverlandTownCertified(from,target,blocked)){
  const ordered=poiOverlandTownOrderedPath(from,target,g);if(ordered)return ordered;
 }""",1)
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
