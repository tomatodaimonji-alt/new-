const POI_COMPANION_NAV_STALL=145,POI_COMPANION_NAV_RADIUS=16;
let poiCompanionSharedNavReady=0;
const poiCompanionNavBarriers=new WeakMap();
function poiCompanionNavWorldChanged(source){if(source)poiCompanionNavBarriers.delete(source)}
function poiCompanionNavStairs(source){
 let stairs=poiCompanionNavBarriers.get(source);
 if(stairs)return stairs;
 stairs=new Set();
 for(const o of source)if(o.type==='guildStairUp'||o.type==='guildStairDown')stairs.add(o.x+','+o.z+','+o.y);
 poiCompanionNavBarriers.set(source,stairs);return stairs;
}
function poiCompanionNavScope(a,to,following=a.freeFollows===true){
 if(!facilitySite||a.y!==poiWalkLevel||!to)return null;
 // Keep the established mine and intact authored bridge policies unchanged.
 if(facilitySite.id==='base'){
  if(a.y===-1){
   const b=facilitySite.mine?.bounds,inside=(x,z)=>b&&x>=b.x1&&x<=b.x2&&z>=b.z1&&z<=b.z2;
   if(inside(a.x,a.z)&&inside(to.x,to.z))return inside;
  }else if(a.y===0&&facilityCreekIndex?.parts?.size){
   for(const d of facilityCreekIndex.parts.values()){
    if(Math.abs(a.x-d.x)+Math.abs(a.z-d.z)>15||Math.abs(to.x-d.x)+Math.abs(to.z-d.z)>15)continue;
    return (x,z)=>Math.abs(x-d.x)+Math.abs(z-d.z)<=15;
   }
  }
 }
 if(!following||Math.abs(a.x-to.x)+Math.abs(a.z-to.z)>POI_COMPANION_NAV_RADIUS)return null;
 const site=facilitySite,y=a.y,from={x:a.x,z:a.z};
 const zone=(x,z)=>poiDungeonTravelKey(site,x,z,y);
 const inside=(x,z)=>typeof poiDavidTempleEnclosedAt==='function'&&poiDavidTempleEnclosedAt(site,x,z,y);
 const startZone=zone(from.x,from.z),temple=inside(from.x,from.z);
 if(startZone!==zone(to.x,to.z)||temple!==inside(to.x,to.z))return null;
 const allow=(x,z)=>Math.abs(x-from.x)+Math.abs(z-from.z)<=POI_COMPANION_NAV_RADIUS&&validPos(x,z)&&
  zone(x,z)===startZone&&inside(x,z)===temple&&!poiOtherworldPortalAt(site,x,z,y)&&
  !poiCompanionNavStairs(world).has(x+','+z+','+y);
 allow.followOnly=true;
 return allow;
}
function poiCompanionNearGroundClear(a,p,to,now){
 // A close, idle follower needn't repeatedly collision-probe an unchanged pose.
 const k=[p.x,p.z,to.x,to.z].map(x=>Math.round(x*8)).join(','),prior=a.localNearGround;
 if(prior?.world===world&&prior.k===k&&now<prior.until)return prior.clear;
 const clear=poiCompanionNavGroundClear(a,p,to);
 a.localNearGround={world,k,until:now+125,clear};return clear;
}
