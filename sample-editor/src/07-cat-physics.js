// v31: lightweight local impact simulation; not a rigid-body physics engine.
// Cars are original procedural props. NPCs are kicked as whole bodies with a tumble.
// Existing shop meshes are hidden when destroyed, replaced by rubble.
const catCars=[
 {x:1.6,z:4.5,y:0,vx:0,vy:0,vz:0,angle:0,spin:0,hit:false,body:0xb24c39},
 {x:-2.7,z:19,y:0,vx:0,vy:0,vz:0,angle:0,spin:0,hit:false,body:0x537e96},
 {x:2.8,z:27,y:0,vx:0,vy:0,vz:0,angle:0,spin:0,hit:false,body:0xe8d7b1}
];
const catDebris=[];
function renderCatCar(car){
 const start=vertices.length;
 // Build local car geometry, then apply a small roll about its longitudinal axis.
 box(0,.30,0,1.75,.42,3.25,car.body);
 box(0,.72,-.10,1.44,.57,1.7,0x667d86);
 box(0,.61,-1.01,1.45,.22,.05,0x99b1bb);
 box(0,.60,.80,1.43,.20,.055,0x667984);
 for(const side of [-1,1])for(const z of [-1.02,1.02]){
  box(side*.85,.18,z,.27,.39,.60,0x25262a);
  box(side*.993,.20,z,.045,.22,.31,0x979a9b);
 }
 for(const z of [-1.51,1.51]){
  box(0,.30,z,1.58,.13,.09,z<0?0xe5e7c6:0x902e27);
 }
 const c=Math.cos(car.angle),s=Math.sin(car.angle);
 for(let i=start;i<vertices.length;i+=6){
  const x=vertices[i],y=vertices[i+1]-.48;
  vertices[i]=car.x+x*c-y*s;
  vertices[i+1]=car.y+.48+x*s+y*c;
  vertices[i+2]+=car.z;
 }
}
function catKnockNPC(npc,ux,uz,power){
 npc.knock={vx:ux*power,vy:Math.min(8,2+power*.4),vz:uz*power,
  y:0,tilt:0,spin:3.8+power*.19,rest:0};
 npc.state='stunned';
 npc.action='idle';npc.effort=0;
 npc.carrying=false;
}
function updateCatImpacts(dt){
 const friction=Math.exp(-Math.max(0,dt)*1.8);
 for(const car of catCars){
  if(!car.hit)continue;
  car.x+=car.vx*dt;car.z+=car.vz*dt;
  car.y=Math.max(0,car.y+car.vy*dt);
  car.vy-=9.8*dt;
  if(car.y===0&&car.vy<0){car.vy=car.vy< -1?-car.vy*.23:0;car.spin*=.70}
  car.vx*=friction;car.vz*=friction;car.spin*=friction;
  car.angle+=car.spin*dt;
  // Keep the visual simulation bounded; do not clip through the town's entire map.
  car.x=clamp(car.x,-105,105);car.z=clamp(car.z,-105,105);
 }
 for(const npc of npcs){
  const k=npc.knock;if(!k)continue;
  const nx=npc.x+k.vx*dt,nz=npc.z+k.vz*dt;
  if(!blocked(nx,npc.z))npc.x=nx;else k.vx*=-.25;
  if(!blocked(npc.x,nz))npc.z=nz;else k.vz*=-.25;
  k.y=Math.max(0,k.y+k.vy*dt);
  k.vy-=9.8*dt;
  if(k.y===0&&k.vy<0)k.vy=0;
  k.tilt=Math.min(Math.PI/2,k.tilt+Math.abs(k.spin)*dt);
  k.vx*=friction;k.vz*=friction;k.spin*=friction;
  if(k.y===0){k.rest+=dt;if(k.rest>3.5){
   npc.knock=null;
   // Restore authored route at its initial waypoint; avoid retaining an interrupted transaction.
   npc.state=npc.role==='bystander'?'idle':'walking';
   npc.wait=0;npc.action='idle';npc.routeIndex=0;
  }}
 }
 for(let i=catDebris.length-1;i>=0;i--){
  const d=catDebris[i];
  if(d.life<=0){catDebris.splice(i,1);continue}
  d.life-=dt;d.x+=d.vx*dt;d.z+=d.vz*dt;
  d.y=Math.max(0,d.y+d.vy*dt);d.vy-=9.8*dt;
  if(d.y===0&&d.vy<0){d.vy=0;d.vx*=.8;d.vz*=.8}
 }
}
function catImpactSound(power){
 if(!audio||audio.state!=='running')return;
 const now=audio.currentTime;
 const osc=audio.createOscillator(),gain=audio.createGain();
 osc.type='triangle';osc.frequency.setValueAtTime(95,now);
 osc.frequency.exponentialRampToValueAtTime(33,now+.20);
 gain.gain.setValueAtTime(.0001,now);
 gain.gain.linearRampToValueAtTime(Math.min(.17,.04+power*.01),now+.009);
 gain.gain.exponentialRampToValueAtTime(.0001,now+.28);
 osc.connect(gain);gain.connect(audio.destination);osc.start(now);osc.stop(now+.3);
}
function catHitTest(x,z,width){
 const dx=x-cat.x,dz=z-cat.z,dist=Math.hypot(dx,dz);
 const forwardX=Math.sin(cat.heading),forwardZ=Math.cos(cat.heading);
 const ahead=dx*forwardX+dz*forwardZ;
 const side=Math.abs(dx*forwardZ-dz*forwardX);
 return ahead>-.12*cat.scale&&ahead<1.9*cat.scale+width&&
 side<.72*cat.scale+width;
}
function catStrike(){
 const power=Math.min(18,2.8+cat.scale*1.1);
 const dirX=Math.sin(cat.heading),dirZ=Math.cos(cat.heading);
 let hits=0;
 for(const npc of npcs){
  if(npc.knock||!catHitTest(npc.x,npc.z,.34))continue;
  catKnockNPC(npc,dirX,dirZ,power);
  hits++;
 }
 for(const car of catCars){
  if(!catHitTest(car.x,car.z,1.1))continue;
  car.hit=true;
  car.vx+=dirX*(power*.92);car.vz+=dirZ*(power*.92);
  car.vy+=Math.min(9,power*.45);
  car.spin+=(car.x-cat.x>0?1:-1)*(1.5+cat.scale*.18);
  hits++;
 }
 // Buildings are already in separate, independently rendered buffers.
 // One destroyed shop disappears entirely and leaves a low rubble footprint.
 if(cat.scale>=3){
  for(const shop of townBuildings){
   if(shop.catDestroyed)continue;
   const frontX=shop.front;
   if(!catHitTest(frontX,shop.z,Math.max(1.5,shop.width*.37)))continue;
   shop.catDestroyed=true;hits++;
   for(let i=0;i<18;i++){
    const offset=(i/18-.5)*shop.width;
    catDebris.push({x:frontX+Math.sin(i*19)*.8,z:shop.z+offset,
      y:.4+Math.random()*2,vx:dirX*(1+Math.random()*3),
      vy:1+Math.random()*3,vz:dirZ*(1+Math.random()*3),
      life:15,color:[0x8b8174,0xab9c86,0x655d53][i%3]});
   }
   // One building per punch: prevents instant clearing of an entire street.
   break;
  }
 }
 if(hits)catImpactSound(power);
 return hits;
}
function renderCatDebris(){
 for(const shop of townBuildings){
  if(!shop.catDestroyed)continue;
  box(shop.x,.01,shop.z,shop.depth,.28,shop.width,0x7f7466);
  for(let i=0;i<12;i++)box(shop.front+Math.sin(i*6.1)*1.0,.12,
   shop.z+(i-5.5)*shop.width/13,.55,.43,.60,0x938575);
 }
 for(const d of catDebris)box(d.x,d.y,d.z,.32,.28,.4,d.color);
}
