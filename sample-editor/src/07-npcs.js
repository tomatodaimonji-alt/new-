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
  state:'checkout',wait:0,route:[],routeIndex:0,effort:0,transaction:0,action:'idle',motion:0,pose:{pick:0,carry:0,pay:0}},
 {id:'npc-shopper-01',poiId:'convenience-study',role:'shopper',style:'visitorA',
  x:1.08,z:74.3,heading:0,phase:1.3,speed:.69,
  state:'walking',wait:0,carrying:false,action:'idle',shoppingCycles:0,paymentDone:false,itemPlaced:false,motion:0,pose:{pick:0,carry:0,pay:0},route:[
   {x:1.08,z:77.15,lookX:3.15,lookZ:77.2,wait:3.5,activity:'pick'},
   {x:1.08,z:82.90,lookX:3.15,lookZ:83.1,wait:3.0,activity:'browse'},
   {x:1.08,z:72.20,lookX:-5.6,lookZ:72.35,wait:.25},
   {x:-3.45,z:73.55,lookX:-5.6,lookZ:72.35,wait:3.5,activity:'pay'},
   {x:1.08,z:74.3,lookX:0,lookZ:70,wait:.7}
  ],routeIndex:0,effort:0},
 {id:'npc-shopper-02',poiId:'convenience-study',role:'shopper',style:'visitorB',
  x:-1.06,z:84.45,heading:Math.PI,phase:3,speed:.62,
  state:'walking',wait:0,carrying:false,action:'idle',shoppingCycles:0,paymentDone:false,motion:0,pose:{pick:0,carry:0,pay:0},route:[
   {x:-1.06,z:83.15,lookX:-3.15,lookZ:83.1,wait:2.8,activity:'pick'},
   {x:-1.06,z:77.15,lookX:-3.15,lookZ:77.2,wait:4.2,activity:'browse'},
   {x:-1.06,z:74.00,lookX:-5.6,lookZ:72.35,wait:.25},
   {x:-3.20,z:74.45,lookX:-5.6,lookZ:72.35,wait:3.5,activity:'pay'},
   {x:-1.06,z:74.0,lookX:0,lookZ:79,wait:.2},
   {x:-1.06,z:84.45,lookX:0,lookZ:88,wait:.8}
  ],routeIndex:0,effort:0}
 ];
function updateNpcPose(npc,dt){
 const gain=1-Math.exp(-Math.min(.05,Math.max(0,dt))*6);
 for(const key of ['pick','carry','pay']){
  npc.pose[key]+=((npc.action===key?1:0)-npc.pose[key])*gain;
  if(Math.abs(npc.pose[key])<.001)npc.pose[key]=0;
 }
 npc.motion+=((npc.effort||0)-npc.motion)*(1-Math.exp(-dt*7));
}
// NPC motion is time-based and only advances when an unobstructed route exists.
// Bystanders stop for merchandise; the clerk remains behind the checkout.
function updateNPCs(dt){
 const time=Math.min(.05,Math.max(0,dt));
 for(const npc of npcs){
  if(npc.role==='clerk'){
   npc.heading=Math.PI+.12*Math.sin((npc.phase+=time*.32));
   const active=npcs.some(other=>other.role==='shopper'&&other.action==='pay');
   npc.action=active?'pay':'idle';
   npc.transaction=active?Math.min(1,(npc.transaction||0)+time*3):0;
   npc.effort=0;
   updateNpcPose(npc,time);
   continue;
  }
  const waypoint=npc.route[npc.routeIndex];
  if(npc.state==='looking'){
   npc.wait-=time;
   const face=Math.atan2(waypoint.lookX-npc.x,waypoint.lookZ-npc.z);
   const diff=Math.atan2(Math.sin(face-npc.heading),Math.cos(face-npc.heading));
   npc.heading+=diff*Math.min(1,time*4);
   npc.effort=0;
   const elapsed=waypoint.wait-npc.wait;
   if(waypoint.activity==='pick'){
    npc.action=elapsed<1.15?'pick':npc.carrying?'carry':'idle';
    if(elapsed>=1.15)npc.carrying=true;
   }else if(waypoint.activity==='pay'){
    npc.action='pay';
    // Release one item onto the counter, then finish a single payment.
    if(npc.wait<=waypoint.wait-1.35)npc.itemPlaced=true;
    if(npc.wait<=.45&&!npc.paymentDone){npc.carrying=false;npc.shoppingCycles++;npc.paymentDone=true}
   }else npc.action=npc.carrying?'carry':'idle';
   if(npc.wait<=0){
    npc.state='walking';npc.routeIndex=(npc.routeIndex+1)%npc.route.length;
    npc.action=npc.carrying?'carry':'idle';
    npc.paymentDone=false;
    npc.itemPlaced=false;
   }
   updateNpcPose(npc,time);
   continue;
  }
  const dx=waypoint.x-npc.x,dz=waypoint.z-npc.z;
  const distance=Math.hypot(dx,dz);
  if(distance<.12){
   npc.x=waypoint.x;npc.z=waypoint.z;
   npc.state='looking';npc.wait=waypoint.wait;npc.effort=0;
   updateNpcPose(npc,time);
   continue;
  }
  const move=Math.min(distance,npc.speed*time),ux=dx/distance,uz=dz/distance;
  const nextX=npc.x+ux*move,nextZ=npc.z+uz*move;
  // Shared wall/fixture collision and player clearance.
  if(blocked(nextX,nextZ)||Math.hypot(nextX-player.x,nextZ-player.z)<.48||
     npcs.some(other=>other!==npc&&Math.hypot(nextX-other.x,nextZ-other.z)<.48)){
   npc.effort=0;
   updateNpcPose(npc,time);
   continue;
  }
  npc.x=nextX;npc.z=nextZ;
  npc.heading=Math.atan2(ux,uz);
  npc.phase+=move*Math.PI/.78;
  npc.action=npc.carrying?'carry':'idle';
  npc.effort=Math.min(1,npc.effort+time*7);
  updateNpcPose(npc,time);
 }
}
// One small circular player collider per person; existing shelf/wall rules remain.
function npcBlocks(x,z){
 return npcs.some(npc=>Math.hypot(x-npc.x,z-npc.z)<.43);
}
function renderNpcShadows(){
 for(const npc of npcs){
  renderPlayerShadow(npc.x,npc.z,npc.heading,npc.motion,npc.phase);
 }
}
function renderNPCs(){
 for(const npc of npcs){
  renderDetailedPlayer(npc.x,npc.z,npc.heading,npc.phase,npc.motion,false,
    NPC_STYLES[npc.style],npc.pose);
  if(npc.carrying||npc.pose.pick>.03||npc.itemPlaced)renderNpcCarriedProduct(npc);
 }
 // Reset shared character palette for consistency with any later player effects.
 currentCharacterStyle=PLAYER_STYLE;
}

// Reuse the arm's local grip position for the item. The checkout target is a
// fixed empty section of the actual counter and never enters the walking lane.
function npcGripWorld(npc){
 const pick=npc.pose.pick,pay=npc.pose.pay,carry=npc.pose.carry;
 const weight=Math.min(1,pick+pay+carry);
 const localX=.376*(1-weight)+.35*weight;
 const localZ=-.018*(1-weight)-(.58*pick+.45*pay+.22*carry);
 const angle=npc.heading-Math.PI,cs=Math.cos(angle),sn=Math.sin(angle);
 return [npc.x+localX*cs+localZ*sn, .871*(1-weight)+1.00*weight+.06*pick,
  npc.z-localX*sn+localZ*cs];
}
const CHECKOUT_ITEM_POINT=Object.freeze({x:-4.39,y:1.035,z:72.72});
// An unbranded product is positioned relative to the raised right hand.
// This is an animation prop only; shelf inventory is not yet simulated.
function renderNpcCarriedProduct(npc){
 const hand=npcGripWorld(npc);
 const isPay=npc.state==='looking'&&npc.route[npc.routeIndex].activity==='pay';
 const remaining=isPay?npc.wait:4;
 const transition=isPay?Math.min(1,Math.max(0,(2.65-remaining)/1.30)):0;
 const eased=transition*transition*(3-2*transition);
 const checkoutX=CHECKOUT_ITEM_POINT.x+(npc.style==='visitorB'?-.32:0);
 const x=hand[0]+(checkoutX-hand[0])*eased;
 const y=hand[1]+(CHECKOUT_ITEM_POINT.y-hand[1])*eased;
 const z=hand[2]+(CHECKOUT_ITEM_POINT.z-hand[2])*eased;
 const kind=npc.style==='visitorA'?'canned-coffee':'green-tea';
 // Before pickup finishes, scale the presentation prop up near the grip.
 const visibility=npc.carrying||npc.itemPlaced?1:Math.min(1,npc.pose.pick);
 if(visibility>.02)renderOriginalProduct(kind,x,y,z,.76*visibility);
}
