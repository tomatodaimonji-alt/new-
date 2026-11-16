function pineExtendWorld(){
  if(!gameMapMigrated||MAP_W!==96||MAP_H!==96)return;
  const oldLast=world[world.length-1],oldFirst=world[0];
  pineOldSignature=MAP_W+':'+MAP_H+':'+world.length+':'+(oldFirst?oldFirst.type+oldFirst.x+oldFirst.z:'')+':'+(oldLast?oldLast.type+oldLast.x+oldLast.z:'');
  MAP_W=320;MAP_H=160;pineWorldEnabled=true;
  // Mainland streets are generated as chunk ground, not tens of thousands of
  // persistent water/road blocks. Store only real, accessible buildings.
  const add=(x,z,type,y=0,rot=0)=>world.push({x,z,y,type,rot});
  for(let z=19;z<=137;z+=15)for(let x=169;x<=304;x+=15){
   const n=surfaceNoise(x*3+2,z*5+9);
   const w=n<.5?7:9,d=n<.35?7:9;
   const storeys=n>.74?3:n>.42?2:1;
   const doorX=x+Math.floor(w/2),front=z+d-1;
   for(let floor=0;floor<storeys;floor++)for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++){
    const xx=x+dx,zz=z+dz,edge=dx===0||dz===0||dx===w-1||dz===d-1;
    add(xx,zz,floor===0?'woodfloor': 'woodfloorLight',floor);
    if(edge){
     const entry=floor===0&&xx===doorX&&zz===front;
     const facade=entry?'plasterwallDoor':
      (zz===front||zz===z)&&dx>0&&dx<w-1&&(dx+floor)%2===0?'plasterwallWindow':'plasterwall';
     add(xx,zz,facade,floor,zz===front?0:zz===z?2:xx===x?3:1);
    }
   }
   for(let dz=0;dz<d;dz++)for(let dx=0;dx<w;dx++)add(x+dx,z+dz,'roofHip',storeys);
   for(let floor=0;floor<storeys-1;floor++)add(x+1,z+1,'stairSwitchback',floor);
   // Clear front approaches connect each actual doorway to the street.
  }
  // A terminal beside the western coast; its actual door is accessible.
  dirty=true;
 }
 function pineAddHarbors(props){
 if(!pineWorldEnabled)return;
 const key=(x,z)=>gameTileKey(x,z);
 const authored=new Set(world.filter(o=>o.y===0&&!isFloor(o.type)).map(o=>key(o.x,o.z)));
 const placed=new Set(props.filter(o=>o.y===0&&!isFloor(o.type)).map(o=>key(o.x,o.z)));
 const add=(x,z,type,rot=0)=>{if(!validPos(x,z))return false;
  if(x<96&&authored.has(key(x,z)))return false;
  props.push({x,z,y:0,type,rot});return true;
 };
 const deck=(x,z,type,rot=0)=>{const k=key(x,z);if(placed.has(k)||x<96&&authored.has(k))return false;
  if(add(x,z,type,rot)){placed.add(k);return true}return false;
 };
 // Island passenger pier: 3-cell approach, wider berth at the seaward end.
 for(let x=86;x<=100;x++)for(let z=55;z<=57;z++)deck(x,z,'pineHarborPier',1);
 for(let x=97;x<=100;x++)for(let z=58;z<=59;z++)deck(x,z,'pineHarborPier',1);
 // Mainland terminal: the approach continues all the way onto dry land.
 for(let x=145;x<=164;x++)for(let z=55;z<=57;z++)deck(x,z,'pineHarborQuay');
 for(let x=149;x<=153;x++)for(let z=58;z<=59;z++)deck(x,z,'pineHarborQuay');
 // Historic supply port: a narrow working quay, NOT a giant concrete carpet.
 for(let z=75;z<=92;z++)for(let x=78;x<=80;x++)deck(x,z,'pineHarborQuay');
 // A proper, enterable port office on the mainland. Built from the same
 // individual wall / door / roof blocks as the old town.
 const tx=162,tz=46,tw=6,td=7,front=tz+td-1,door=tx+Math.floor(tw/2);
 for(let z=tz;z<tz+td;z++)for(let x=tx;x<tx+tw;x++){
  add(x,z,'woodfloor');
  const edge=x===tx||x===tx+tw-1||z===tz||z===front;
  if(edge)add(x,z,z===front&&x===door?'plasterwallDoor':
   x>tx&&x<tx+tw&&(z===tz||z===front)?'plasterwallWindow':'plasterwall');
  props.push({x,z,y:1,type:'roofHip',rot:0});
 }
 add(tx+2,tz+2,'table');
 // Keep a paved entrance route to the ferry approach at z=55.
 for(let z=front+1;z<=57;z++)deck(door,z,'pineHarborQuay');
 // Clutter stays on outside edges, never down the central walking lane.
 for(const [x,z,type] of [
  [91,55,'pineHarborBollard'],[95,55,'pineHarborLamp'],
  [99,59,'pineHarborBollard'],[98,59,'pineHarborFender'],
  [88,55,'pineHarborPallet'],[94,57,'pineHarborSign'],
  [148,55,'pineHarborLamp'],[152,59,'pineHarborBollard'],
  [150,59,'pineHarborFender'],[159,55,'pineHarborPallet'],
  [161,57,'pineHarborSign'],
  [80,85,'pineHarborLamp'],[80,90,'pineHarborBollard'],
  [79,91,'pineHarborFender'],[78,88,'pineHarborPallet']
 ])add(x,z,type);
}
 function pineBoatNearPier(){
  const x=gameX,z=gameZ;
  return (Math.abs(x-99.5)<=3.3&&Math.abs(z-58.5)<=2.3&&Math.abs(pineBoatX-99.5)<=3.2)||
   (Math.abs(x-151.5)<=3.3&&Math.abs(z-58.5)<=2.3&&Math.abs(pineBoatX-151.5)<=3.2);
 }
 function pineBoatDock(){
  return Math.abs(pineBoatZ-60.5)<=1.1&&
   (Math.abs(pineBoatX-99.5)<=2.5?'island':
    Math.abs(pineBoatX-151.5)<=2.5?'mainland':null);
 }
 function pineBoatButtonRefresh(){
  const b=$('pineBoatButton');
  if(!b)return;
  b.hidden=!pineWorldEnabled||(!pineSailing&&!pineBoatNearPier());
  if(pineSailing)b.textContent=pineBoatDock()?'下船する':'航行中';
  else b.textContent='船に乗る';
 }
 function pineBoatAction(){
  if(!pineWorldEnabled)return;
  if(!pineSailing){
   if(!pineBoatNearPier()){toast('船が近くの桟橋にありません');return}
   pineSailing=true;gameMove=null;gameDirs.clear();gameLevel=0;
   gameX=pineBoatX;gameZ=pineBoatZ;gameUpdateRoof();gameSyncCamera(true);
   toast('乗船した。十字キーで海を進み、港へ接岸しよう');
  }else{
   const dock=pineBoatDock();
   if(!dock){toast('下船には桟橋へ接岸してください');return}
   pineSailing=false;gameDirs.clear();gameMove=null;
   gameX=dock==='island'?99.5:151.5;gameZ=58.5;
   gameUpdateRoof();gameSyncCamera(true);
   toast(dock==='island'?'PINE島の港に下船':'本島の港に下船');
  }
  pineBoatButtonRefresh();gamePersistProgress(true);
 }
 function pineBoatTick(dt,now){
  if(!pineWorldEnabled)return;
  if(pineSailing){
   const d=gameLastDir&&gameDirs.has(gameLastDir)?gameLastDir:[...gameDirs].at(-1);
   const vec={e:[1,0],w:[-1,0],n:[0,-1],s:[0,1]}[d];
   if(vec){
    const velocity=5.5*dt,nx=pineBoatX+vec[0]*velocity,nz=pineBoatZ+vec[1]*velocity;
    // Continuous, manually steered ship in the common ocean, with docking bays.
    if(nx>=99.5&&nx<=151.5&&nz>=39.5&&nz<=73.5){
     pineBoatX=nx;pineBoatZ=nz;
     gameX=nx;gameZ=nz;
     if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
     gameAvatar=gameAvatarMesh();
    }
   }
   if(now-pineSailingSaved>1500){pineSailingSaved=now;gamePersistProgress(true)}
  }
  if(!pineShipMesh||((pineBoatX!==pineShipMeshX||pineBoatZ!==pineShipMeshZ)&&now-pineShipMeshAt>90)){
   pineShipMeshAt=now;pineShipMeshX=pineBoatX;pineShipMeshZ=pineBoatZ;
   if(pineShipMesh)gl.deleteBuffer(pineShipMesh.buf);
   const m=mesh(),x=pineBoatX,z=pineBoatZ;
   const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dz,dy,z+dx,d,h,w,c);
   B(0,.24,0,2.6,.42,5.2,[.28,.37,.31]);
   B(0,.50,0,2.3,.13,4.9,[.51,.55,.50]);
   B(0,.93,1.1,1.35,.74,1.8,[.68,.72,.69]);
   B(0,1.37,1.1,1.35,.12,1.9,[.38,.46,.41]);
   B(0,1.08,2.06,.83,.25,.03,[.34,.53,.62]);
   B(0,.80,-1.25,1.4,.22,1.2,[.45,.49,.41]);
   for(const dx of [-1.05,1.05])B(dx,.58,-1.0,.07,.32,2.7,[.74,.70,.46]);
   pineShipMesh=upload(m);
  }
  if(now%450<65)pineBoatButtonRefresh();
 }
 function pineChunkWindow(){
  if(!pineWorldEnabled)return {x0:0,z0:0,x1:MAP_W,z1:MAP_H,id:'legacy'};
  const cx=Math.floor(gameX/PINE_CHUNK),cz=Math.floor(gameZ/PINE_CHUNK);
  const radius=Math.min(4,Math.max(2,Math.ceil(12/Math.max(.28,zoom)/PINE_CHUNK)));
  return {x0:Math.max(0,(cx-radius)*PINE_CHUNK),z0:Math.max(0,(cz-radius)*PINE_CHUNK),
   x1:Math.min(MAP_W,(cx+radius+1)*PINE_CHUNK),z1:Math.min(MAP_H,(cz+radius+1)*PINE_CHUNK),
   id:cx+':'+cz+':'+radius};
 }
 function gameZoneFor(x,z){
  if(pineWorldEnabled&&x>=96)return pineMainlandLand(x,z)?(z>=44&&z<=62&&x<=168?'本島・旅客港':'本島・都市部'):'海峡・海域';
  if(MAP_W<96||!gameMapMigrated)return '';
  if(x>=77&&z>=62&&z<=75)return '入場検査区域';
  if(x>=61&&x<=84&&z>=56&&z<=81)return '軍臨時基地・補給港';
  if(x>=61&&x<=80&&z>=35&&z<56)return '避難民キャンプ';
  if(x>=20&&x<=60&&z>=46&&z<=68)return '旧住民区域';
  if(x>=8&&x<=18&&z>=44&&z<=57)return 'ホテル区域';
  if(x>=79&&z>=44&&z<=56)return '商業区域';
  if(z>=81&&x>=32&&x<=48)return '旧漁港';
  if(z>=82&&x>=63&&x<=81)return '軍補給港';
  if(z<35||x<20)return '松林・自然区域';
  return '';
 }
 