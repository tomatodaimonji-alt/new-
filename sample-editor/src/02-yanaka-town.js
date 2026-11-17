// Yanaka Ginza-inspired compact shopping street. Visual study: Taito ward streetscape
// guidance and street-level photos. Dimensions are approximate, not surveyed geometry.
// 1 world unit ~= 1 meter; narrow lane, low-rise mixed facades and varied storefront depths.
box(0,-.30,0,150,.15,175,0x6b795e);
box(0,-.155,0,10.6,.10,132,0xb18d67); // warm ochre pedestrian surface
for(const side of [-1,1]){
 // Drainage and narrow stone frontage, raised slightly above the pedestrian street.
 box(side*5.37,-.055,0,.24,.055,132,0x858784);
 box(side*5.87,-.045,0,.78,.08,132,0x9a9690);
}
// The scene registry drives individual building buffers and their collision footprints.
const townBuildings=[];
const storePalettes=[0x9b8f7d,0xc1ad94,0xc4c2b5,0x998a79,0xa7b0a9,0x877c70,0xb6a48c];
const awnings=[0x467269,0x824d49,0xc1ab79,0x425d73,0x76674a,0x865f40,0x537b83];
const signage=[0x554a3d,0x3d5c51,0x755843,0x7b4842,0x4b5861,0x746340];
function renderStreetShop(shop){
 const {side,k}=shop;
 const x=shop.x,z=shop.z,width=shop.width,depth=shop.depth,height=shop.height;
 const wall=storePalettes[(k+(side>0?3:0))%storePalettes.length];
 const accent=awnings[(k*3+(side>0?1:0))%awnings.length];
 const front=x-side*depth*.5;
 const start=vertices.length;
 // Individual plot: narrower than a modern office frontage.
 box(x,.0,z,depth,height,width,wall);
 box(x,height,z,depth+.18,.17,width+.22,0x555653);
 for(let floor=1;floor<Math.floor(height/2.65);floor++){
  const y=1.6+floor*2.66;
  for(const p of [-1.65,1.65]){
   box(front-side*.055,y,z+p,.08,1.37,1.32,0x4b6266);
   box(front-side*.103,y-.72,z+p,.12,.085,1.47,0xc7b9a4);
   box(front-side*.12,y,z+p,.08,1.43,.07,0xb2a598);
  }
 }
 // Open shop fronts, not repetitive full-height glass office walls.
 box(front-side*.07,.045,z,.12,2.55,width-.38,0x342f2a);
 box(front-side*.14,.21,z,.14,2.18,width-.58,0x53635f);
 for(const p of [-width*.28,width*.28]){
  box(front-side*.20,.1,z+p,.09,2.32,.1,0x8d755b);
  box(front-side*.23,.96,z+p,.075,1.4,1.45,0x304946);
 }
 // Varied upper signboards, small projecting sign + realistic awning with sloped fabric.
 box(front-side*.19,2.62,z,.17,.56,width-.28,signage[k%signage.length]);
 for(const p of [-1.75,-.85,.1,1.1,1.75]){
  box(front-side*.293,2.65,z+p,.015,.12,.37,0xd0ba89);
 }
 const edge=front-side*(1.10+seeded(k*7,side)*.28);
 quad([front-side*.25,2.45,z-width*.47],[edge,2.15,z-width*.47],
      [edge,2.15,z+width*.47],[front-side*.25,2.45,z+width*.47],color(accent));
 box(edge,2.11,z,.09,.12,width*.95,accent);
 for(const p of [-width*.42,width*.42])box(edge,2.16,z+p,.045,.09,.04,0x4a4743);
 // Cargo boxes, shop baskets, planters and varied stock extend towards the street.
 const category=k%5;
 for(let i=0;i<4;i++){
  const zz=z-2.1+i*1.33+seeded(k,i)*.12;
  const offset=category===0?.46:category===1?.68:.48;
  const px=edge-side*offset;
  if(i===3&&k%4===0)continue;
  const isPlants=category===0||category===4;
  box(px,.09,zz,.60,.26,.72,isPlants?0x65513e:0x836b51);
  if(isPlants){
   box(px,.34,zz,.42,.12,.49,0x41452d);
   box(px,.45,zz,.54,.36,.55,[0x536c41,0x758647,0x597b56][i%3]);
  }else{
   for(let t=0;t<3;t++)
    box(px,.38,zz-.22+t*.21,.42,.18,.17,[0xb7a579,0x9b633c,0xc3a24f,0x72817b][(i+t+k)%4]);
  }
 }
 // Door handles and wall-mounted air-conditioning boxes.
 box(front-side*.31,1.06,z+width*.24,.035,.16,.035,0xbdb4a0);
 if(k%3===0){
  box(front-side*.12,3.75,z-width*.34,.30,.43,.66,0xc1c2bc);
  for(let t=0;t<4;t++)box(front-side*.29,3.62+t*.08,z-width*.34,.012,.025,.44,0x656b67);
 }
 if(k%4===1){
  box(edge-side*.36,.45,z+2.20,.52,.88,.45,0x8d7b5d);
  box(edge-side*.39,1.33,z+2.20,.08,.06,.53,0xd5c7a5);
 }
 const geometry=new Float32Array(vertices.splice(start));
 if(shop.buffer)gl.deleteBuffer(shop.buffer);
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
 Object.assign(shop,{cx:x,cz:z,front,buffer,count:geometry.length/6});
 return shop;
}
for(const shop of scene.buildings)townBuildings.push(renderStreetShop(shop));
// Lanterns, utility poles, overhead cables and drainage add a credible lived-in streetscape.
for(const object of scene.objects){
 const z=object.z;
 const side=Math.sign(object.x),px=object.x;
 {
  box(px,0,z,.18,7.1,.18,0x676765);
  box(px,5.45,z,.36,.23,.40,0x8d8d86);
  box(px-side*.26,4.4,z+.46,.035,.12,1.12,0x565b56);
  box(px-side*.26,4.34,z+1.02,.31,.19,.24,0xb4ae85);
  // Thin rails imitate several drooping overhead lines without expensive curves.
  for(let wire=0;wire<3;wire++){
   const h=6.3+wire*.17;
   for(let t=0;t<5;t++){
    const xx=-5.6+t*2.24;
    box(xx,h-.24*Math.sin((t+1)*Math.PI/6),z+wire*.15,2.27,.027,.029,0x424544);
   }
  }
 }
}
// Street crosses small paved courts at each end so the scene is explorable.
box(0,-.155,-62,20,.1,14,0xa99983);
box(0,-.155,62,20,.1,14,0xa99983);
