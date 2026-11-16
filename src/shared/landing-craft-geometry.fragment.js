// Reference-informed small troop carrier: 18x8 map cells, with 3-cell draft,
// 2+ cells freeboard/superstructure and a 6x5 passenger zone.
// Draw once into a GPU mesh; moving the boat uses model translation, not VBO upload.
const PINE_SHIP_LENGTH=18,PINE_SHIP_BEAM=8,PINE_SHIP_CAPACITY=20;
function pineLandingCraftGeometry(m,cx=0,cz=0){
 const B=(dx,y,dz,w,h,d,c)=>cube(m,cx+dx,y,cz+dz,w,h,d,c);
 const hull=[.29,.36,.38],hullShadow=[.20,.28,.31],steel=[.46,.52,.52],
    deck=[.48,.50,.47],rubber=[.17,.21,.22],mark=[.78,.68,.33],glass=[.28,.48,.57];
 // Water line y=0; lower body down to -3. Positive 2.4m side and wheelhouse.
 B(0,-2.9,0,16,2.9,6.6,hullShadow);
 B(0,-1.20,0,17.2,1.70,7.1,hull);
 B(0,-.06,0,17.7,.66,7.6,hull);
 B(0,.58,0,16.9,.22,7.05,deck);
 // Chamfered bow and transom, each made of a stepped steel bow structure.
 for(const sign of [-1,1]){
  B(sign*8.7,-.9,0,.36,1.8,5.3,hull);
  B(sign*8.92,-.34,0,.25,1.05,4.3,steel);
  B(sign*8.2,-.15,0,.43,.34,6.6,steel);
 }
 // Side bulwarks; deliberate central gap on north side for side gangway.
 for(const side of [-1,1]){
  const z=side*3.54;
  for(let x=-8;x<=8;x+=2){
   if(side<0&&x>=-1&&x<=1)continue;
   B(x,.77,z,1.95,.75,.21,steel);
   B(x,1.56,z,1.95,.08,.25,hullShadow);
  }
  for(const x of [-7.5,-3.5,3.5,7.5]){
   B(x,1.68,z,0.09,.30,.10,steel);
   B(x,1.95,z,1.25,.07,.08,steel);
  }
  for(const x of [-7,-3,3,7])B(x,.07,side*3.72,.7,.42,.24,rubber);
 }
 // 6x5 passenger grid amidships; cargo deck is open.
 for(let x=-4;x<=3;x+=1){
  B(x,.83,-2.6,.04,.013,.23,[.56,.55,.47]);
  B(x,.83,2.6,.04,.013,.23,[.56,.55,.47]);
 }
 for(let i=0;i<5;i++) B(-4+i*2,.82,0,.045,.012,5.6,[.43,.47,.44]);
 // Stern wheelhouse: raised cockpit, angled glass effect, roof and navigation mast.
 B(-6.65,.88,0,2.5,1.35,4.0,steel);
 B(-6.5,2.1,0,2.9,.15,4.4,hullShadow);
 B(-5.37,1.67,0,.09,.46,3.22,glass);
 for(const z of [-1.34,0,1.34])B(-5.31,1.72,z,.12,.52,.07,steel);
 B(-7.7,1.73,0,.10,.55,2.6,glass);
 B(-6.65,2.22,0,.12,1.2,.12,steel);
 B(-6.65,3.30,0,1.65,.08,.10,steel);
 B(-7.25,2.35,1.55,.14,.55,.15,mark);
 B(-7.25,2.35,-1.55,.14,.55,.15,[.72,.24,.22]);
 // Bow door and fold-down ramp (stowed underway).
 B(8.75,.76,0,.18,.92,3.65,[.38,.45,.47]);
 for(const z of [-1.95,1.95]) B(8.15,.85,z,1.1,.17,.13,steel);
 for(const z of [-2.1,2.1])B(7.72,.82,z,.18,.52,.16,mark);
 // Small working gear: anchors, winch, cabling, vents, cleats and stowage.
 B(5.9,.84,0,.92,.38,1.35,steel);
 B(6,.96,0,.35,.25,1.54,rubber);
 for(const z of [-2.6,2.6]){
  B(-3.8,.84,z,.48,.19,.25,steel);
  B(4.8,.84,z,.42,.19,.26,steel);
 }
 B(-4.4,.87,2.25,.58,.54,.50,rubber);
 B(-4.4,1.43,2.25,.62,.06,.55,steel);
 // Deck safety stripe, minimal low-poly markings.
 for(const z of [-2.96,2.96])B(0,.84,z,7.9,.02,.12,mark);
}
