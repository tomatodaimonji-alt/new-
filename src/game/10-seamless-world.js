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
   [153,53,'pineDockCrane'],[151,53,'pineCargo'],[156,53,'pineCargo'],
   [159,53,'pineGenerator'],[134,55,'pineBarrier'],
   [79,85,'pineHarborLamp'],[80,90,'pineHarborBollard'],
   [79,91,'pineHarborFender'],[78,88,'pineHarborPallet']
  ]){if(!occupied.has(key(x,z)))add(x,z,type)}
 }
 // A 20-person complement: logical 5x4 standing slots on the open deck.
 // The 3D hull and each soldier's mesh are compiled once; draw uses transforms.
 let pineTroopMesh=null,pineTroopCount=0,pineTroopMode='ready',pineTroopStarted=0;
 let pineGangwayMesh=null;
 const PINE_ISLAND_BERTH=110.5,PINE_MAINLAND_BERTH=142.5,PINE_BERTH_Z=67.5;
 const pineTroopSlot=i=>[-3+(i%5)*1.5,-1.9+Math.floor(i/5)*1.3];
 const pineTroopQueue=i=>[100.5+(i%5)*1.1,57+Math.floor(i/5)*1.1];
 const pineTroopLand=i=>[137.5+(i%5)*1.45,56.5+Math.floor(i/5)*1.35];
 const pineLerp=(a,b,t)=>a+(b-a)*Math.max(0,Math.min(1,t));
 const pineMVP=(vp,x,y,z)=>mult(vp,new Float32Array([
  1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1
 ]));
 function pineBoatDock(){
  if(Math.abs(pineBoatZ-PINE_BERTH_Z)>1.1)return null;
  if(Math.abs(pineBoatX-PINE_ISLAND_BERTH)<.65)return 'island';
  if(Math.abs(pineBoatX-PINE_MAINLAND_BERTH)<.65)return 'mainland';
  return null;
 }
 function pineBoatNearPier(){
  const b=pineBoatDock();
  if(!b)return false;
  const bx=b==='island'?PINE_ISLAND_BERTH:PINE_MAINLAND_BERTH;
  return Math.abs(gameX-bx)<8.5&&gameZ>=55&&gameZ<=63;
 }
 function pineCrewAction(){
  if(pineTroopMode==='boarding'||pineTroopMode==='unloading')return;
  const dock=pineBoatDock();
  if(pineTroopMode==='ready'&&dock==='island'){
   pineTroopCount=0;pineTroopMode='boarding';pineTroopStarted=performance.now();
   toast('兵員20名が岸壁から乗船を開始'); 
  }else if(pineTroopMode==='aboard'&&dock==='mainland'){
   pineTroopMode='unloading';pineTroopStarted=performance.now();
   toast('本島の岸壁へ兵員20名の下船開始');
  }else toast('兵員の乗降には所定の港への接岸が必要です');
  pineBoatButtonRefresh();
 }
 function pineBoatButtonRefresh(){
  const b=$('pineBoatButton'),c=$('pineTroopButton');
  if(b){
   b.hidden=!pineWorldEnabled||(!pineSailing&&!pineBoatNearPier());
   b.textContent=pineSailing?(pineBoatDock()?'下船する':'航行中'):'船に乗る';
  }
  if(c){
   const dock=pineBoatDock(),near=pineSailing||pineBoatNearPier();
   c.hidden=!pineWorldEnabled||!near||
    !(pineTroopMode==='boarding'||pineTroopMode==='unloading'||
     pineTroopMode==='ready'&&dock==='island'||
     pineTroopMode==='aboard'&&dock==='mainland');
   c.disabled=pineTroopMode==='boarding'||pineTroopMode==='unloading';
   c.textContent=pineTroopMode==='unloading'?'兵員が下船中':
    pineTroopMode==='boarding'?'乗船中 '+pineTroopCount+'/20':
    pineTroopMode==='ready'?'兵員20名を乗船':'兵員20名に下船指示';
  }
 }
 function pineBoatAction(){
  if(!pineWorldEnabled)return;
  if(pineTroopMode==='boarding'||pineTroopMode==='unloading'){
   toast('兵員の乗降が終わるまで接岸してください');return;
  }
  if(!pineSailing){
   if(!pineBoatNearPier()){toast('船が近くの岸壁に接岸していません');return}
   pineSailing=true;gameMove=null;gameDirs.clear();gameLevel=0;
   gameX=pineBoatX;gameZ=pineBoatZ;gameUpdateRoof();gameSyncCamera(true);
   toast('乗船。十字キーで航行。離岸後は本島港へ接岸してください');
  }else{
   const dock=pineBoatDock();
   if(!dock){toast('下船には船を岸壁へ正確に接岸させてください');return}
   pineSailing=false;gameDirs.clear();gameMove=null;
   gameX=dock==='island'?110.5:142.5;gameZ=61.5;
   gameUpdateRoof();gameSyncCamera(true);
   toast(dock==='island'?'PINE島の岸壁に下船':'本島の岸壁に下船');
  }
  pineBoatButtonRefresh();gamePersistProgress(true);
 }
 function pineBoatTick(dt,now){
  if(!pineWorldEnabled)return;
  if(!pineShipMesh){
   const m=mesh();pineLandingCraftGeometry(m,0,0);pineShipMesh=upload(m);
  }
  if(!pineGangwayMesh){
   const m=mesh(),steel=[.50,.54,.53],yellow=[.75,.67,.40];
   // The side boarding gangway reaches a real quay; it is stowed underway.
   // Inclined aluminum gangway from the ship's cargo deck to the high quay.
   quad(m,[-.95,1.18,-5.18],[-.95,.83,-3.18],[.95,.83,-3.18],[.95,1.18,-5.18],steel);
   cube(m,0,.69,-4.15,1.9,.08,2.0,steel);
   for(const x of [-.87,.87]){
    cube(m,x,.90,-4.16,.08,.35,2.00,yellow);
    cube(m,x,1.26,-4.16,.07,.07,2.00,steel);
   }
   pineGangwayMesh=upload(m);
  }
  if(!pineTroopMesh){
   const m=mesh(),cloth=[.30,.39,.31],face=[.74,.61,.47],helmet=[.22,.29,.24];
   cube(m,0,0,0,.31,.39,.30,cloth);
   cube(m,0,.39,0,.37,.45,.28,cloth);
   cube(m,0,.84,0,.31,.25,.31,face);
   cube(m,0,1.05,0,.36,.13,.36,helmet);
   for(const x of [-.13,.13])cube(m,x,-.31,0,.13,.34,.15,cloth);
   pineTroopMesh=upload(m);
  }
  if(pineSailing){
   const d=(pineTroopMode==='boarding'||pineTroopMode==='unloading')?null:
    (gameLastDir&&gameDirs.has(gameLastDir)?gameLastDir:[...gameDirs].at(-1));
   const vec={e:[1,0],w:[-1,0],n:[0,-1],s:[0,1]}[d];
   if(vec){
    const nx=pineBoatX+vec[0]*3.8*dt,nz=pineBoatZ+vec[1]*3.8*dt;
    // Ship body must never clip through island or mainland ground.
    if(nx>=PINE_ISLAND_BERTH&&nx<=PINE_MAINLAND_BERTH&&nz>=65.8&&nz<=76.5){
     pineBoatX=nx;pineBoatZ=nz;gameX=nx;gameZ=nz;
     // Avatar mesh uses world-relative y only; update pose lazily on coarse intervals.
     if(now-pineShipMeshAt>120){
      pineShipMeshAt=now;if(gameAvatar)gl.deleteBuffer(gameAvatar.buf);
      gameAvatar=gameAvatarMesh();
     }
    }
   }
   if(now-pineSailingSaved>1500){pineSailingSaved=now;gamePersistProgress(true)}
  }
  if(pineTroopMode==='boarding'){
   pineTroopCount=Math.min(20,Math.floor((now-pineTroopStarted)/380));
   if(now-pineTroopStarted>=20*380+1200){
    pineTroopCount=20;pineTroopMode='aboard';gamePersistProgress(true);
    toast('20名全員の乗船を確認');
   }
  }else if(pineTroopMode==='unloading'&&now-pineTroopStarted>=20*380+1200){
   pineTroopCount=0;pineTroopMode='landed';gamePersistProgress(true);
   toast('兵員20名が本島へ上陸');
  }
  if(now%450<65)pineBoatButtonRefresh();
 }
 function pineDrawLandingCraft(vp){
  if(!pineShipMesh||!pineWorldEnabled)return;
  if(Math.abs(gameX-pineBoatX)>65||Math.abs(gameZ-pineBoatZ)>65)return;
  draw(pineShipMesh,pineMVP(vp,pineBoatX,0,pineBoatZ));
  if(pineGangwayMesh&&pineBoatDock())draw(pineGangwayMesh,pineMVP(vp,pineBoatX,0,pineBoatZ));
  if(!pineTroopMesh)return;
  const now=performance.now(),pitch=.85;
  for(let i=0;i<20;i++){
   const slot=pineTroopSlot(i),src=pineTroopQueue(i),land=pineTroopLand(i);
   let x,z,y=.9,visible=true;
   if(pineTroopMode==='ready'){[x,z]=src;y=1.3}
   else if(pineTroopMode==='landed'){[x,z]=land;y=1.3}
   else if(pineTroopMode==='boarding'){
    const t=Math.max(0,Math.min(1,(now-pineTroopStarted-i*380)/1400));
    if(t===0){[x,z]=src;y=1.3}
    else if(t<.7){x=pineLerp(src[0],pineBoatX+slot[0],t/.7);
     z=pineLerp(src[1],63.1,t/.7);y=1.3}
    else{x=pineBoatX+slot[0];z=pineLerp(63.1,pineBoatZ+slot[1],(t-.7)/.3);y=pitch}
   }else if(pineTroopMode==='unloading'){
    const t=Math.max(0,Math.min(1,(now-pineTroopStarted-i*380)/1400));
    if(t<.3){x=pineBoatX+slot[0];z=pineLerp(pineBoatZ+slot[1],63.1,t/.3);y=pitch}
    else{x=pineLerp(pineBoatX+slot[0],land[0],(t-.3)/.7);
      z=pineLerp(63.1,land[1],(t-.3)/.7);y=1.3}
   }else{ x=pineBoatX+slot[0];z=pineBoatZ+slot[1] }
   if(visible)draw(pineTroopMesh,pineMVP(vp,x,y,z));
  }
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
 