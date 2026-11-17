// v24: a small deterministic cast for short-form scenes.
// The same registered NPC instances serve exploration and shooting; no duplicate
// meshes or town generators. All coordinates are authored for the convenience POI.
const NPC_STYLES={
 clerk:Object.freeze({...PLAYER_STYLE,
  skin:0xd3a88a,shadowSkin:0xb88d72,hair:0x38302c,
  shirt:0x4c775e,shirtDark:0x365a45,shirtHighlight:0xb7bc88,
  trousers:0x323a43,trouserShadow:0x252c34,shoes:0x292b30}),
 visitorA:Object.freeze({...PLAYER_STYLE,
  skin:0xc69a79,shadowSkin:0x9e725c,hair:0x302d30,
  shirt:0xad7767,shirtDark:0x86554d,shirtHighlight:0xc49b7f,
  trousers:0x52647a,trouserShadow:0x384b5c}),
 visitorB:Object.freeze({...PLAYER_STYLE,
  skin:0xd3ac91,shadowSkin:0xb58d72,hair:0x594337,
  shirt:0xb5b6a8,shirtDark:0x929485,shirtHighlight:0xe0d6bc,
  trousers:0x4a5860,trouserShadow:0x353f46})
};
const npcs=[
 {id:'npc-clerk-01',poiId:'convenience-study',role:'clerk',style:'clerk',
  x:-5.45,z:73.55,heading:Math.PI,phase:0,speed:0,
  state:'checkout',wait:0,route:[],routeIndex:0,effort:0},
 {id:'npc-shopper-01',poiId:'convenience-study',role:'shopper',style:'visitorA',
  x:1.08,z:74.3,heading:0,phase:1.3,speed:.69,
  state:'walking',wait:0,route:[
   {x:1.08,z:77.15,lookX:3.15,lookZ:77.2,wait:3.5},
   {x:1.08,z:82.90,lookX:3.15,lookZ:83.1,wait:3.0},
   {x:.32,z:75.25,lookX:-5.6,lookZ:72.35,wait:2.2},
   {x:1.08,z:74.3,lookX:0,lookZ:70,wait:.7}
  ],routeIndex:0,effort:0},
 {id:'npc-shopper-02',poiId:'convenience-study',role:'shopper',style:'visitorB',
  x:-1.06,z:84.45,heading:Math.PI,phase:3,speed:.62,
  state:'walking',wait:0,route:[
   {x:-1.06,z:83.15,lookX:-3.15,lookZ:83.1,wait:2.8},
   {x:-1.06,z:77.15,lookX:-3.15,lookZ:77.2,wait:4.2},
   {x:-1.06,z:81.8,lookX:3.15,lookZ:83.1,wait:1.4},
   {x:-1.06,z:84.45,lookX:0,lookZ:88,wait:.8}
  ],routeIndex:0,effort:0}
 ];
// NPC motion is time-based and only advances when an unobstructed route exists.
// Bystanders stop for merchandise; the clerk remains behind the checkout.
function updateNPCs(dt){
 const time=Math.min(.05,Math.max(0,dt));
 for(const npc of npcs){
  if(npc.role==='clerk'){
   npc.heading=Math.PI+.12*Math.sin((npc.phase+=time*.32));
   npc.effort=0;
   continue;
  }
  const waypoint=npc.route[npc.routeIndex];
  if(npc.state==='looking'){
   npc.wait-=time;
   const face=Math.atan2(waypoint.lookX-npc.x,waypoint.lookZ-npc.z);
   const diff=Math.atan2(Math.sin(face-npc.heading),Math.cos(face-npc.heading));
   npc.heading+=diff*Math.min(1,time*4);
   npc.effort=0;
   if(npc.wait<=0){npc.state='walking';npc.routeIndex=(npc.routeIndex+1)%npc.route.length}
   continue;
  }
  const dx=waypoint.x-npc.x,dz=waypoint.z-npc.z;
  const distance=Math.hypot(dx,dz);
  if(distance<.12){
   npc.x=waypoint.x;npc.z=waypoint.z;
   npc.state='looking';npc.wait=waypoint.wait;npc.effort=0;
   continue;
  }
  const move=Math.min(distance,npc.speed*time),ux=dx/distance,uz=dz/distance;
  const nextX=npc.x+ux*move,nextZ=npc.z+uz*move;
  // Shared wall/fixture collision and player clearance.
  if(blocked(nextX,nextZ)||Math.hypot(nextX-player.x,nextZ-player.z)<.48){
   npc.effort=0;
   continue;
  }
  npc.x=nextX;npc.z=nextZ;
  npc.heading=Math.atan2(ux,uz);
  npc.phase+=move*Math.PI/.78;
  npc.effort=Math.min(1,npc.effort+time*7);
 }
}
// One small circular player collider per person; existing shelf/wall rules remain.
function npcBlocks(x,z){
 return npcs.some(npc=>Math.hypot(x-npc.x,z-npc.z)<.43);
}
function renderNpcShadows(){
 for(const npc of npcs){
  renderPlayerShadow(npc.x,npc.z,npc.heading,npc.effort,npc.phase);
 }
}
function renderNPCs(){
 for(const npc of npcs){
  renderDetailedPlayer(npc.x,npc.z,npc.heading,npc.phase,npc.effort,false,
    NPC_STYLES[npc.style]);
 }
 // Reset shared character palette for consistency with any later player effects.
 currentCharacterStyle=PLAYER_STYLE;
}
