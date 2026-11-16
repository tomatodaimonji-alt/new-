function pineZoneGeometry(m,o){
  const x=o.x+.5,z=o.z+.5,y=terrainY(o.x,o.z);
  const olive=[.36,.43,.30],oliveDark=[.22,.31,.24],canvas=[.70,.70,.56],
   blue=[.37,.51,.58],wood=[.46,.32,.22],metal=[.32,.38,.39],
   rust=[.52,.31,.22],yellow=[.82,.70,.36],stone=[.70,.70,.65];
  const B=(dx,dy,dz,w,h,d,c)=>cube(m,x+dx,y+dy,z+dz,w,h,d,c);
  const tentKind=o.type.split(':')[0],tentShape=o.type.split(':')[1]||'small';
  const roof=(color,shape='small')=>{
   // Small, ridge, lean-to and patched makeshift shelter silhouettes.
   const tall=shape==='family'?1.35:shape==='lean'?.77:1.16;
   const half=shape==='family'?.48:.44;
   const depth=shape==='family'?.48:.43;
   for(const sign of [-1,1]){
    const peakX=shape==='lean'?sign*.15:0;
    quad(m,[x+sign*half,y+.35,z-depth],[x+sign*half,y+.35,z+depth],
     [x+peakX,y+tall,z+depth],[x+peakX,y+tall,z-depth],color);
   }
   if(shape==='patched'){
    B(-.18,.64,-.31,.22,.025,.20,[.55,.51,.40]);
    B(.16,.49,.34,.20,.022,.17,[.38,.44,.42]);
   }
   if(shape==='family'){
    B(0,.49,-depth,.64,.25,.035,color);
    B(0,.25,depth,.37,.41,.035,[.27,.31,.28]);
   }
   B(0,.12,0,.89,.11,.88,[.38,.35,.27]);
   B(0,.35,.43,.28,.56,.016,oliveDark);
   B(0,.29,.445,.20,.43,.020,[.15,.16,.15]);
   for(const sx of [-.45,.45])for(const sz of [-.45,.45])
    B(sx,0,sz,.045,.40,.045,metal);
  };

  if(o.type==='pineRoomFloor'){
   B(0,.035,0,.96,.07,.96,[.59,.61,.57]);
  }else if(o.type.startsWith('pineRoomSign:')){
   B(0,.0,0,.12,1.25,.12,metal);
   B(0,1.0,0,.86,.38,.12,oliveDark);
   B(0,1.03,.075,.65,.065,.02,canvas);
  }else if(o.type==='pineConcreteDock'){
   // Entire quay remains walkable, including over sea tiles.
   B(0,.12,0,1,.27,1,[.58,.61,.62]);
   B(0,.26,0,.94,.03,.94,[.67,.69,.68]);
   if(o.z===94)B(0,.32,.43,.12,.13,.12,yellow);
  }else if(o.type==='pineRunway'){
   B(0,.04,0,1,.13,1,[.24,.27,.29]);
   if(o.z===25&&o.x%4<2)B(0,.116,0,.54,.015,.12,stone);
  }else if(o.type==='pineHelipad'){
   B(0,.05,0,1,.13,1,[.38,.42,.42]);
   if((o.x+o.z)%4===0)B(0,.125,0,.4,.015,.1,yellow);
  }else if(o.type==='pineHeadquarters'||o.type==='pineBarracks'||o.type==='pineWarehouse'){
   const h=o.type==='pineHeadquarters'?2.7:1.8;
   B(0,.08,0,5,.18,4,[.55,.58,.52]);
   B(0,h/2+.13,-1.9,5,h,.19,olive);
   B(-2.4,h/2+.13,0,.20,h,4,olive);
   B(2.4,h/2+.13,0,.20,h,4,olive);
   B(0,h+.2,0,5.3,.2,4.3,oliveDark);
   for(let i=-1;i<=1;i++)B(i*1.1,1.35,-1.79,.66,.45,.04,blue);
   B(0,.84,1.9,1.3,1.4,.09,metal);
  }else if(o.type==='pineMeetingRoom'){
   B(0,.10,0,4,.20,3,stone);
   for(const dx of [-1.85,1.85])B(dx,1,0,.19,1.9,3,olive);
   B(0,1,-1.4,4,1.9,.18,olive);
   B(0,.65,0,2.5,.16,.95,wood);
   for(const dx of [-1.1,0,1.1])for(const dz of [-.75,.75])
    B(dx,.26,dz,.50,.44,.5,oliveDark);
   B(0,1.35,-1.26,2,.8,.035,[.32,.42,.35]);
  }else if(o.type==='pineTransportShip'){
   B(0,.27,0,6,1.14,15,oliveDark);
   B(0,.89,0,5.25,.18,13,metal);
   B(0,1.48,-3,3.2,1.3,3.5,stone);
   B(0,2.28,-3,.9,.6,2,blue);
   B(0,3.1,-3,.12,1.7,.13,metal);
   for(const dz of [-5,-2,1,4,5.8])
    B(0,.99,dz,4.6,.14,.10,yellow);
   B(2.7,.75,4,1.4,.14,2.4,wood);
  }else if(o.type==='pineHelicopter'){
   B(0,.78,0,2,.72,3.6,olive);
   B(0,1.55,0,.12,.35,.12,metal);
   B(0,1.79,0,7,.045,.12,metal);
   B(0,1.79,0,.12,.045,6,metal);
   B(0,.94,-2.4,.38,.38,3.2,olive);
   for(const dx of [-1,1])B(dx,.13,0,.09,.12,3.5,metal);
  }else if(o.type==='pineTransportPlane'){
   B(0,1.35,0,2.5,1.2,10,stone);
   B(0,1.27,0,12,.15,2.6,olive);
   B(0,2.16,-4,.17,1.8,1.2,oliveDark);
   B(0,1.8,4.7,1.8,.22,1,blue);
   for(const dx of [-1.3,1.3])B(dx,.41,1,.14,.7,.14,metal);
  }else if(o.type==='pineDockCrane'){
   B(0,2.5,0,.42,5,.48,yellow);
   B(1.5,4.9,0,5,.25,.4,yellow);
   B(3.8,2.8,0,.08,4.1,.08,metal);
   B(3.8,.8,0,.9,1.6,.8,metal);
  }else if(o.type==='pineMainlandTerminal'){
   B(0,.1,0,6,.18,4,stone);
   B(0,1.5,0,6,2.6,3.9,oliveDark);
   B(0,2.9,0,6.5,.18,4.2,stone);
   for(let dx=-2;dx<=2;dx++)B(dx,1.5,1.97,.55,1,.08,blue);
  }else if(o.type.startsWith('pineCityTower:')){
   const [,strH,strW]=o.type.split(':'),h=Number(strH)*2.15,w=Number(strW);
   const n=surfaceNoise(o.x*7,o.z*9);
   const facade=n<.35?[.38,.45,.49]:n<.7?[.55,.56,.52]:[.42,.49,.43];
   B(0,h/2+.06,0,w,h,w,facade);
   B(0,h+.15,0,w+.3,.2,w+.3,metal);
   for(let level=1;level<Number(strH)*2;level++)
    for(const dx of [-w/2+.02,w/2-.02]){
     B(dx,level*1.05,0,.04,.36,w-.5,blue);
    }
   for(let level=1;level<Number(strH)*2;level++)
    for(const dz of [-w/2+.02,w/2-.02])
     B(0,level*1.05,dz,w-.5,.36,.04,blue);
  }else if(o.type==='pineCityBarrier'){
   // Invisible collision tile within city block footprints.
  }else
  if(/^pineTent/.test(tentKind)){
   const color={pineTentTan:canvas,pineTentBlue:blue,
    pineTentGrey:[.52,.55,.52],pineTentWhite:[.79,.78,.70],
    pineTentOlive:olive,pineTentOrange:[.74,.49,.29]}[tentKind]||canvas;
   roof(color,tentShape);
  }else if(o.type==='pineMilitaryTent'||o.type==='pineCommand'||o.type==='pineMedical'||o.type==='pineRation'){
   roof(o.type==='pineMedical'?[.78,.79,.73]:o.type==='pineRation'?[.60,.56,.40]:olive);
   if(o.type==='pineCommand'||o.type==='pineMilitaryTent'){
    B(0,.73,-.30,.37,.13,.06,oliveDark);
    for(const sx of [-.32,.32])B(sx,0,-.35,.055,.8,.06,wood);
   }
   if(o.type==='pineMedical'){
    B(0,.77,.44,.32,.075,.026,[.68,.20,.20]);
    B(0,.77,.44,.08,.31,.027,[.68,.20,.20]);
   }
   if(o.type==='pineRation'){
    B(.28,.02,.53,.42,.53,.26,wood);
    B(.28,.56,.53,.45,.06,.29,canvas);
   }
  }else if(o.type==='pineSupplyCrate'||o.type==='pineSupplies'){
   B(0,.03,0,.85,.78,.80,o.type==='pineSupplyCrate'?olive:wood);
   for(const side of [-.31,.31])B(side,.05,.41,.08,.71,.05,metal);
   B(0,.79,0,.89,.045,.85,canvas);
  }else if(o.type==='pineGenerator'){
   B(0,.13,0,.79,.66,.67,oliveDark);
   B(0,.75,0,.86,.065,.72,metal);
   for(const xx of [-.30,.30])B(xx,.30,.35,.045,.30,.035,yellow);
   B(.24,.78,-.18,.10,.38,.10,rust);
  }else if(o.type==='pineBarrier'){
   for(const sx of [-.33,.33])B(sx,0,0,.10,.64,.10,wood);
   B(0,.33,0,.80,.12,.09,olive);
   B(0,.53,0,.80,.10,.09,canvas);
  }else if(o.type==='pineRadio'){
   B(0,.02,0,.58,.55,.58,oliveDark);
   for(const xx of [-.19,.19])B(xx,.60,0,.06,2.05,.06,metal);
   B(0,2.57,0,.55,.075,.08,metal);
   B(0,1.65,.0,.49,.07,.08,metal);
   B(0,2.48,.0,.09,.44,.09,yellow);
  }else if(o.type==='pineWatchtower'){
   for(const sx of [-.38,.38])for(const sz of [-.38,.38])B(sx,0,sz,.10,2.40,.10,wood);
   B(0,2.15,0,.99,.17,.98,wood);
   for(const sx of [-.40,.40])B(sx,2.35,0,.07,.62,.90,wood);
   for(const sz of [-.40,.40])B(0,2.35,sz,.88,.62,.07,wood);
   B(0,2.92,0,1.08,.16,1.07,oliveDark);
  }else if(o.type==='pineLighthouse'){
   // Old white navigation tower with a visible illuminated lantern.
   B(0,0,0,.88,2.95,.88,stone);
   for(const h of [.45,1.25,2.05])B(0,h,.46,.26,.30,.038,oliveDark);
   B(0,2.93,0,1.04,.17,1.04,rust);
   for(const dx of [-.29,.29])for(const dz of [-.29,.29])B(dx,3.12,dz,.06,.65,.06,metal);
   B(0,3.12,0,.55,.59,.55,yellow);
   B(0,3.77,0,1.05,.15,1.05,rust);
   B(0,3.92,0,.30,.26,.31,rust);
  }else if(o.type==='pineInspection'){
   B(0,.02,0,.81,.77,.79,oliveDark);
   B(0,.80,0,.92,.07,.89,canvas);
   B(0,.85,.41,.73,.13,.05,yellow);
   B(0,.34,.47,.64,.08,.10,metal);
  }else if(o.type==='pineLaundry'){
   for(const side of [-.39,.39])B(side,0,0,.065,1.32,.065,wood);
   B(0,1.22,0,.78,.025,.035,metal);
   for(const [offset,c] of [[-.21,blue],[.10,canvas],[.29,[.60,.43,.34]]])
    B(offset,.72,.01,.20,.49,.038,c);
  }else if(o.type==='pineFireBarrel'){
   B(0,.02,0,.55,.63,.55,rust);B(0,.64,0,.58,.05,.57,metal);
   B(0,.70,0,.38,.06,.38,[.18,.17,.16]);
   for(const [xx,zz] of [[-.11,0],[.14,.08]])B(xx,.76,zz,.10,.25,.10,yellow);
  }else if(o.type==='pineWaterTank'){
   B(0,.04,0,.73,.92,.72,blue);
   for(const h of [.15,.78])B(0,h,0,.77,.07,.77,metal);
   B(0,.98,0,.64,.07,.62,oliveDark);
  }else if(o.type==='pineFishingNet'){
   for(const xx of [-.37,.37])B(xx,0,0,.065,1.0,.07,wood);
   for(let h=0;h<4;h++)B(0,.3+h*.18,0,.74,.018,.035,[.42,.44,.34]);
   for(let i=0;i<5;i++)B(-.31+i*.16,.32,0,.015,.62,.03,[.42,.44,.34]);
  }else if(o.type==='pineCargo'){
   B(0,.04,0,.93,.83,.87,metal);
   for(const h of [.18,.38,.58,.78])B(0,h,.45,.86,.022,.025,[.48,.51,.50]);
   B(.37,.04,-.28,.08,.85,.07,rust);
  }else if(o.type==='pineFishingBoat'||o.type==='pineSupplyBoat'){
   const fishing=o.type==='pineFishingBoat',hull=fishing?[.44,.27,.18]:olive;
   B(0,.03,0,.91,.24,.53,hull);
   B(0,.19,0,.77,.10,.39,wood);
   for(const side of [-.36,.36])B(side,.22,0,.06,.23,.43,hull);
   B(-.12,.23,0,.08,.64,.08,metal);
   B(0,.82,0,.63,.035,.40,fishing?canvas:oliveDark);
  }else if(o.type==='pineHotelSign'||o.type==='pineMarketSign'){
   const hotel=o.type==='pineHotelSign',color=hotel?[.30,.49,.49]:[.39,.54,.32];
   for(const xx of [-.34,.34])B(xx,0,0,.08,1.45,.08,metal);
   B(0,1.03,0,.80,.43,.16,color);
   for(const xx of [-.23,0,.23])B(xx,1.19,.085,.11,.09,.025,canvas);
   B(0,1.08,.09,.61,.035,.03,yellow);
  }else if(o.type==='pineScenicPine'){
   B(0,0,0,.15,1.42,.16,wood);
   for(let i=0;i<3;i++)diamond(m,x,y+.86+i*.30,z,.62-i*.11,
    [.19+i*.02,.40+i*.02,.31+i*.01]);
  }
 }
 function gameConfigureNaturalScenery(){
  gameNatureHiddenTrees.clear();
  const candidates=world.filter(o=>o.y===0&&/^tree(?:Oak|Pine|Birch|Cedar|Round|Branch|Broad|Spruce|Fir|Maple|Willow|Palm)?$/i.test(o.type));
  if(!candidates.length)return;
  const roads=new Set(world.filter(o=>o.y===0&&(ROAD_IDS.has(o.type)||/^(?:road|bridge)/.test(o.type))).map(o=>gameTileKey(o.x,o.z)));
  const buildings=new Set(world.filter(o=>o.y===0&&/(?:door|wall|window|oldTown.*Shop)/i.test(o.type)).map(o=>gameTileKey(o.x,o.z)));
  const near=(set,x,z,r)=>{for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++)
   if(Math.abs(dx)+Math.abs(dz)<=r&&set.has(gameTileKey(x+dx,z+dz)))return true;
   return false;
  };
  // Keep the riverbank landmark trees at the far end of the main bridge.
  const landmarks=new Set(['19,60','31,61']);
  for(const o of candidates){
   const key=gameTileKey(o.x,o.z);
   if(landmarks.has(key))continue;
   if((o.x>=62&&o.x<=85&&o.z>=34&&o.z<=82)||(o.x>=27&&o.x<=70&&o.z>=22&&o.z<=28)||(o.x>=66&&o.x<=76&&o.z>=29&&o.z<=35)){gameNatureHiddenTrees.add(o);continue;}
   const byRoad=near(roads,o.x,o.z,2);
   const byHouse=near(buildings,o.x,o.z,2);
   const nearBridge=Math.abs(o.x-23)<=4&&(Math.abs(o.z-50)<=5||Math.abs(o.z-58)<=5);
   // Smooth regional variation creates groves and open glades, not regular grids.
   const grove=smoothSurfaceNoise(o.x*.15+3.6,o.z*.15+8.1);
   const chance=(byRoad||byHouse||nearBridge)?.21:(.47+.29*grove);
   const score=surfaceNoise(o.x*9+71,o.z*13+29);
   if(score>=chance)gameNatureHiddenTrees.add(o);
  }
 }
 