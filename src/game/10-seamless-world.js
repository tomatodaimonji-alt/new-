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
  const authored=new Set(world.filter(o=>!isFloor(o.type)).map(o=>key(o.x,o.z)));
  const occupied=new Set(props.filter(o=>!isFloor(o.type)).map(o=>key(o.x,o.z)));
  const decked=new Set();
  const add=(x,z,type,rot=0)=>{if(!validPos(x,z))return false;
   if(x<96&&authored.has(key(x,z)))return false;
   props.push({x,z,y:0,type,rot});return true;
  };
  const deck=(x,z,type,rot=0)=>{
   const k=key(x,z);if(decked.has(k)||occupied.has(k)||x<96&&authored.has(k))return false;
   if(add(x,z,type,rot)){decked.add(k);return true}return false;
  };
  // Real berth for an 18 x 8 LCU-style small landing craft, aligned east-west.
  // Quay runs adjacent to the north side of the boat; no overlap with its hull.
  // Passenger waiting apron: 7-cell width at island end, retained old town clear.
  for(let x=86;x<=116;x++)for(let z=56;z<=62;z++){
   if(x<97&&z>58)continue; // existing town/coast facilities have priority
   deck(x,z,'pineHarborQuay',1);
  }
  // Concrete apron behind the island embarkation bay; troops can queue here.
  for(let x=98;x<=107;x++)for(let z=53;z<=55;z++)deck(x,z,'pineHarborQuay',1);
  // Mainland quay: reinforced concrete with road connection inland.
  for(let x=132;x<=160;x++)for(let z=56;z<=62;z++)deck(x,z,'pineHarborQuay',1);
  for(let x=151;x<=162;x++)for(let z=53;z<=55;z++)deck(x,z,'pineHarborQuay',1);
  // A separate service pier and original fishing dock.
  for(let z=75;z<=92;z++)for(let x=78;x<=80;x++)deck(x,z,'pineHarborQuay');
  // Enterable island office does not remove houses; keep original shops.
  // Mainland terminal office: separate walls, an actual door, roof and a floor.
  const tx=162,tz=46,tw=6,td=7,front=tz+td-1,door=tx+Math.floor(tw/2);
  for(let z=tz;z<tz+td;z++)for(let x=tx;x<tx+tw;x++){
   add(x,z,'woodfloor');
   const edge=x===tx||x===tx+tw-1||z===tz||z===front;
   if(edge)add(x,z,z===front&&x===door?'plasterwallDoor':
    x>tx&&x<tx+tw&&(z===tz||z===front)?'plasterwallWindow':'plasterwall');
   props.push({x,z,y:1,type:'roofHip',rot:0});
  }
  add(tx+2,tz+2,'table');
  for(let z=front+1;z<=56;z++)deck(door,z,'pineHarborQuay',1);
  // Fenders, bollards and floodlights are located at the edge, not in the walking lane.
  for(const [x,z,type] of [
   [98,56,'pineHarborPallet'],[102,56,'pineHarborLamp'],
   [104,62,'pineHarborBollard'],[115,62,'pineHarborBollard'],
   [100,62,'pineHarborFender'],[113,62,'pineHarborFender'],
   [100,55,'pineHarborSign'],[95,56,'pineHarborLamp'],
   [133,62,'pineHarborBollard'],[148,62,'pineHarborBollard'],
   [138,62,'pineHarborFender'],[151,62,'pineHarborFender'],
   [158,56,'pineHarborPallet'],[159,55,'pineHarborLamp'],
   [154,55,'pineHarborSign'],[150,56,'pineHarborPallet'],
   [79,85,'pineHarborLamp'],[80,90,'pineHarborBollard'],
   [79,91,'pineHarborFender'],[78,88,'pineHarborPallet']
  ]){if(!occupied.has(key(x,z)))add(x,z,type)}
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
 