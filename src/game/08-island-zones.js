function gameBuildIslandZones(){
  gameZoneProps.length=0;gameZonePaths.length=0;
  if(MAP_W<96||MAP_H<96||!gameMapMigrated)return;
  const floor=new Map(world.filter(o=>o.y===0&&isFloor(o.type)).map(o=>[gameTileKey(o.x,o.z),o.type]));
  const objects=new Set(world.filter(o=>o.y===0&&!isFloor(o.type)&&
   !/^(?:tree|bush|flower|fern|grass|rockPebble|rockSmall|mushroom)/i.test(o.type))
   .map(o=>gameTileKey(o.x,o.z)));
  const placed=new Set(),reserved=new Set();
  const buildingCells=new Set(world.filter(o=>o.y>0&&/^roof/.test(o.type)).map(o=>gameTileKey(o.x,o.z)));
  const dry=(x,z)=>{const t=floor.get(gameTileKey(x,z));return !!t&&!/^(?:sea|river|water|lake)$/.test(t)};
  const reserve=(x,z)=>{if(dry(x,z))reserved.add(gameTileKey(x,z))};
  const trail=(points,kind='main',width=1)=>{
   for(let j=0;j<points.length-1;j++){
    let [x,z]=points[j];const [tx,tz]=points[j+1];
    while(true){
     for(let w=0;w<width;w++)reserve(x+(x===tx?w:0),z+(x===tx?0:w));
     if(x===tx&&z===tz)break;
     if(x!==tx)x+=Math.sign(tx-x);else z+=Math.sign(tz-z);
    }
   }
  };
  // The old town is in the centre. Clear and connected walks branch east.
  trail([[59,48],[69,48],[76,48],[76,60]],'camp');
  trail([[69,39],[69,64],[73,64]],'main',2);
  trail([[73,64],[73,75],[74,75],[74,78]],'main');
  trail([[60,55],[82,55],[82,53]],'market');
  trail([[59,62],[72,62],[75,75]],'base');
  trail([[40,78],[41,85],[41,91]],'oldPort',2);
  trail([[73,75],[73,85],[73,91]],'militaryPort',2);
  trail([[76,62],[82,62],[82,69],[76,69]],'inspection',2);
  trail([[22,55],[17,55],[17,53]],'hotel');
  // These areas must never be blocked, even if an object would be legal there.
  const safe=(x,z)=>dry(x,z)&&!buildingCells.has(gameTileKey(x,z))&&!objects.has(gameTileKey(x,z))&&!placed.has(gameTileKey(x,z))&&!reserved.has(gameTileKey(x,z));
  const put=(x,z,type,rot=0)=>{
   if(!validPos(x,z)||!safe(x,z))return false;
   placed.add(gameTileKey(x,z));gameZoneProps.push({x,z,y:0,type,rot});return true;
  };
  const colors=['pineTentTan','pineTentBlue','pineTentGrey','pineTentWhite','pineTentOlive','pineTentOrange'];
  const tents=['small','family','lean','patched'];
  // Clustered staggered refugee rows. Deliberate gaps, but no exact grid.
  for(let z=37;z<=54;z+=2)for(let x=63;x<=78;x+=2){
   const noise=surfaceNoise(x*4+7,z*5+19);
   if(noise<.21||x===69||x===76)continue;
   const jx=noise>.7?1:0,jz=noise<.35?1:0;
   const nx=x+jx,nz=z+jz;
   const style=tents[Math.floor(surfaceNoise(x*11,z*13)*tents.length)];
   const color=colors[Math.floor(surfaceNoise(x*7+2,z*3+6)*colors.length)];
   put(nx,nz,color+':'+style,Math.floor(surfaceNoise(x+19,z+11)*4));
  }
  put(64,51,'pineRation');put(77,51,'pineMedical');
  for(const [x,z,t] of [[64,43,'pineLaundry'],[66,50,'pineSupplies'],[74,50,'pineFireBarrel'],
   [77,43,'pineSupplies'],[65,54,'pineWaterTank'],[75,53,'pineLaundry'],
   [63,45,'pineSupplies'],[78,47,'pineFireBarrel'],[66,53,'pineSupplyCrate']])put(x,z,t);
  // Military relocation: tents, command post, field power, surveillance.
  for(const [x,z,t] of [[63,58,'pineMilitaryTent'],[66,58,'pineMilitaryTent'],
    [78,60,'pineCommand'],[65,65,'pineGenerator'],[67,64,'pineWatchtower'],
    [79,65,'pineRadio'],[66,68,'pineSupplyCrate'],[77,72,'pineSupplyCrate'],
    [80,72,'pineMilitaryTent'],[67,72,'pineSupplies'],[81,73,'pineBarrier']])put(x,z,t);
  // Incoming refugees arrive at the inspection/control gate before camp.
  for(const [x,z,t] of [[80,66,'pineInspection'],[85,68,'pineMedical'],
    [77,67,'pineBarrier'],[84,66,'pineBarrier'],[80,71,'pineSupplies'],
    [77,65,'pineWatchtower']])put(x,z,t);
  // Replace the earlier unrealistic one-tile bridges with a proper
  // three-tile-wide fishing pier. The original white stone bridge is authored
  // in world data and is NEVER touched here.
  for(let z=80;z<=92;z++)for(let x=40;x<=42;x++){
   const k=gameTileKey(x,z);
   if(objects.has(k)||placed.has(k))continue;
   gameZoneProps.push({x,z,y:0,type:'pineHarborPier',rot:0});
   placed.add(k);
  }
  // The military dock receives its own constructed quay (below), instead
  // of a long wooden footbridge cutting straight through the military base.
  // Old fishing quay & separate military supply dock.
  for(const [x,z,t] of [[38,83,'pineFishingNet'],[44,84,'pineSupplyCrate'],
    [39,85,'pineFishingBoat'],[43,85,'pineFishingBoat'],
    [69,83,'pineCargo'],[76,83,'pineCargo'],[78,80,'pineGenerator'],
    [69,78,'pineBarrier']])put(x,z,t);
  for(const [x,z,t] of [[59,7,'pineLighthouse'],[68,25,'pineScenicPine'],
    [61,21,'pineScenicPine'],[76,22,'pineScenicPine'],[60,30,'pineScenicPine']])put(x,z,t);
  // Hand-painted signage and waterfront vessels serve as visual landmarks.
  put(14,55,'pineHotelSign');
  put(79,56,'pineMarketSign');
  put(44,85,'pineFishingNet');
  put(74,85,'pineCargo');
  // Place two boats on the water beside their respective piers.
  for(const [x,z,t] of [[38,90,'pineFishingBoat'],[76,90,'pineSupplyBoat']]){
   const k=gameTileKey(x,z);
   if(!objects.has(k)&&!placed.has(k)){gameZoneProps.push({x,z,y:0,type:t,rot:0});placed.add(k)}
  }
  put(75,23,'pineLighthouse');
  for(const k of reserved){const [x,z]=k.split(',').map(Number);gameZonePaths.push({x,z,kind:'main'})}
  pineAddBaseExpansion(gameZoneProps,gameZonePaths);
  pineAddHarbors(gameZoneProps);
 }

 // PINE v2: concrete naval base, headquarters, airfield and traversable quay.
 // These are runtime props, so existing authored houses and editor JSON are untouched.
 