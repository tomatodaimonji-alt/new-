from pathlib import Path
import sys
src,dst=map(Path,sys.argv[1:3]);s=src.read_text()
def rep(a,b):
 global s
 if s.count(a)!=1: raise SystemExit(f'expected one anchor ({s.count(a)}), {a[:120]}')
 s=s.replace(a,b,1)
rep('function poiNorthTrailSupplyGround(p){\n const ground=', 'function poiNorthTrailSupplyGround(p,objects=world){\n const ground=')
rep(' return world.some(o=>o.x===p.x&&o.z===p.z&&o.y===p.y&&o.type===ground);',' return objects.some(o=>o.x===p.x&&o.z===p.z&&o.y===p.y&&o.type===ground);')
rep('function poiLocalTopologyFor(site,concealed){\n if(poiLocalTopology?.world===world&&poiLocalTopology.site===site&&poiLocalTopology.concealed===concealed)return poiLocalTopology;','''function* poiLocalTopologyRows(site,concealed,source){
 const once=source.length;
 let n=0;'''.replace(' const once=source.length;\n',''))
i=s.index('function* poiLocalTopologyRows(');j=s.index('function poiLocalBlocked(',i)
s=s[:i]+s[i:j].replace(' for(const o of world){',' for(const o of source){\n  if(++n%64===0)yield;').replace('!poiNorthTrailSupplyGround(marker):!world.some(','!poiNorthTrailSupplyGround(marker,source):!source.some(').replace(' poiMiniBuilds++;\n return poiLocalTopology={world,site,concealed,levels};',''' return {world:source,site,concealed,levels};
}
function poiLocalTopologyFor(site,concealed){
 if(poiLocalTopology?.world===world&&poiLocalTopology.site===site&&poiLocalTopology.concealed===concealed)return poiLocalTopology;
 const gen=poiLocalTopologyRows(site,concealed,world);
 let item;while(!(item=gen.next()).done){}
 poiMiniBuilds++;
 return poiLocalTopology=item.value;''')+s[j:]
rep(' const incoming=onBase?poiSnowPassMap():base.site,map=onBase?incoming.map:null;',
''' if(onBase&&poiLocalTopology?.world===world&&poiLocalTopology.site===facilitySite)base.localTopology=poiLocalTopology;
 const incoming=onBase?poiSnowPassMap():base.site,map=onBase?incoming.map:null;''')
rep(' facilityBuildRoofs();poiMiniInvalidate();\n $(\'facilitySessionName\').textContent=facilitySite.name;',
''' facilityBuildRoofs();poiMiniInvalidate();
 if(!onBase&&base.localTopology?.world===world&&base.localTopology.site===facilitySite)
  poiLocalTopology=base.localTopology;
 $('facilitySessionName').textContent=facilitySite.name;''')
rep('function poiSnowPassDrawMeasured(){',
'''let poiSnowMapIdle=null;
function poiSnowMapWarmAllowed(base){
 return !!base&&poiSnowPassBase===base&&facilitySite?.id==='snowpass'&&poiWalkActive&&
  !document.hidden&&Math.abs(poiWalkX-12)<=5&&poiWalkZ<=10;
}
function poiSnowMapWarmConcealed(base){
 const temple=base.site?.davidTemple;
 return !!temple&&poiHotbarRead().sacredTempleSeen!==true&&!poiSacredLocalSeen.has(temple);
}
function poiSnowMapWarmTick(){
 const base=poiSnowPassBase;
 if(typeof requestIdleCallback!=='function'||poiSnowMapIdle||!poiSnowMapWarmAllowed(base))return;
 const concealed=poiSnowMapWarmConcealed(base);
 if(base.localTopology?.world===base.world&&base.localTopology.site===base.site&&base.localTopology.concealed===concealed)return;
 const task={base,concealed,gen:poiLocalTopologyRows(base.site,concealed,base.world)};
 poiSnowMapIdle=task;
 const next=deadline=>{
  if(poiSnowMapIdle!==task||!poiSnowMapWarmAllowed(base)){if(poiSnowMapIdle===task)poiSnowMapIdle=null;return}
  const stop=performance.now()+2;
  let work=0;
  while(work++<10&&deadline.timeRemaining()>.6&&performance.now()<stop){
   const r=task.gen.next();
   if(r.done){
    poiSnowMapIdle=null;
    if(poiSnowMapWarmConcealed(base)===task.concealed){
     base.localTopology=r.value;poiMiniBuilds++;
    }
    return;
   }
  }
  requestIdleCallback(next);
 };
 requestIdleCallback(next);
}
function poiSnowPassDrawMeasured(){''')
rep('function poiMiniUpdate(){\n const hud=',"""function poiMiniUpdate(){
 if(typeof poiSnowMapWarmTick==='function'&&facilitySite?.id==='snowpass')poiSnowMapWarmTick();
 const hud=""")
dst.parent.mkdir(parents=True,exist_ok=True);dst.write_text(s)
