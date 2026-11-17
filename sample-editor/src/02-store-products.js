// v22: original, unbranded procedural convenience products.
// Each SKU is reusable; the display instances are generated deterministically.
// No image textures, external model fetches or arbitrary per-frame allocations.
const STORE_PRODUCTS=[
 {id:'green-tea',kind:'bottle',body:0x69845b,label:0xc9d0ab,accent:0x3f684b},
 {id:'mineral-water',kind:'bottle',body:0x8aafb7,label:0xd9e6df,accent:0x4c8095},
 {id:'canned-coffee',kind:'can',body:0x876247,label:0xd9be87,accent:0x4a352a},
 {id:'fruit-juice',kind:'carton',body:0xddae6c,label:0xf5d8a5,accent:0xc96b45},
 {id:'rice-ball',kind:'riceball',body:0xf0eee3,label:0xc7c3b5,accent:0x344a40},
 {id:'snack-bag',kind:'pouch',body:0xbb695e,label:0xe6bd77,accent:0x8b3e42},
 {id:'cup-noodles',kind:'cup',body:0xe0d6b9,label:0xa45b48,accent:0x754b3b},
 {id:'bread',kind:'pouch',body:0xcbb284,label:0xe5d2ab,accent:0x927652},
 {id:'boxed-food',kind:'carton',body:0x6e9576,label:0xe0d7b3,accent:0xb4a060}
];
const skuById=Object.fromEntries(STORE_PRODUCTS.map(s=>[s.id,s]));
function storeCylinder(x,y,z,rx,rz,height,hex,segments=9,topHex=hex){
 const bottom=y,top=y+height,shade=color(hex),topColor=color(topHex);
 for(let i=0;i<segments;i++){
  const a=i*2*Math.PI/segments,b=(i+1)*2*Math.PI/segments;
  const pa=[x+Math.cos(a)*rx,bottom,z+Math.sin(a)*rz];
  const pb=[x+Math.cos(b)*rx,bottom,z+Math.sin(b)*rz];
  const pc=[pb[0],top,pb[2]],pd=[pa[0],top,pa[2]];
  quad(pa,pb,pc,pd,shade.map(v=>v*(.79+.15*Math.cos((a+b)/2))));
  tri([x,top,z],pd,pc,topColor);
 }
}
function renderOriginalProduct(id,x,y,z,scale=1){
 const sku=skuById[id];if(!sku)return;
 const {kind,body,label,accent}=sku;
 if(kind==='bottle'){
  storeCylinder(x,y,z,.075*scale,.077*scale,.265*scale,body,9);
  storeCylinder(x,y+.261*scale,z,.048*scale,.047*scale,.082*scale,body,8);
  storeCylinder(x,y+.338*scale,z,.047*scale,.047*scale,.038*scale,accent,8);
  storeCylinder(x,y+.105*scale,z,.079*scale,.080*scale,.100*scale,label,9);
  box(x,y+.127*scale,z-.084*scale,.074*scale,.029*scale,.009*scale,accent);
 }else if(kind==='can'){
  storeCylinder(x,y,z,.082*scale,.082*scale,.275*scale,body,10);
  storeCylinder(x,y+.274*scale,z,.080*scale,.080*scale,.009*scale,0xc5c4bc,10);
  storeCylinder(x,y+.069*scale,z,.084*scale,.084*scale,.150*scale,label,10);
  box(x,y+.147*scale,z-.087*scale,.080*scale,.053*scale,.012*scale,accent);
 }else if(kind==='riceball'){
  // triangular rice silhouette approximated by a small triangular prism.
  const a=[x-.13*scale,y,z-.055*scale],b=[x+.13*scale,y,z-.055*scale],c=[x,y+.24*scale,z-.055*scale];
  const aa=[a[0],a[1],z+.055*scale],bb=[b[0],b[1],z+.055*scale],cc=[c[0],c[1],z+.055*scale];
  tri(a,b,c,color(body));tri(bb,aa,cc,color(body));
  quad(a,aa,bb,b,color(0xd2d0c6));quad(b,bb,cc,c,color(0xe2dfd1));
  box(x,y+.025*scale,z-.063*scale,.092*scale,.105*scale,.018*scale,accent);
  box(x,y+.065*scale,z-.075*scale,.072*scale,.025*scale,.01*scale,label);
 }else if(kind==='cup'){
  storeCylinder(x,y,z,.091*scale,.091*scale,.245*scale,body,10);
  storeCylinder(x,y+.24*scale,z,.103*scale,.103*scale,.025*scale,0xe9e2cf,10);
  box(x,y+.084*scale,z-.092*scale,.095*scale,.08*scale,.014*scale,label);
  box(x,y+.142*scale,z-.098*scale,.062*scale,.027*scale,.014*scale,accent);
 }else if(kind==='pouch'){
  box(x,y,z,.22*scale,.285*scale,.10*scale,body);
  box(x,y+.06*scale,z-.058*scale,.16*scale,.15*scale,.009*scale,label);
  box(x,y+.085*scale,z-.066*scale,.11*scale,.034*scale,.01*scale,accent);
  box(x,y+.268*scale,z,.23*scale,.021*scale,.109*scale,accent);
 }else{
  box(x,y,z,.185*scale,.305*scale,.16*scale,body);
  box(x,y+.050*scale,z-.086*scale,.128*scale,.160*scale,.009*scale,label);
  box(x,y+.135*scale,z-.092*scale,.084*scale,.036*scale,.01*scale,accent);
  box(x,y+.29*scale,z,.186*scale,.025*scale,.162*scale,accent);
 }
}
// Shelf faces show identifiable silhouettes rather than uniform colored blocks.
function populateStoreShelf(o,tier,face,shelfY){
 const count=o.type==='side-rack'?7:8;
 const kindSet=tier===0?['rice-ball','bread','boxed-food']:
  tier===1?['cup-noodles','snack-bag','boxed-food']:
  tier===2?['fruit-juice','canned-coffee','green-tea']:
  ['snack-bag','cup-noodles','mineral-water'];
 const frontX=o.x+face*(o.width/2+.03);
 for(let i=0;i<count;i++){
  const zz=o.z-o.depth*.43+(i+.5)*o.depth*.86/count;
  const kind=kindSet[(i+o.id.length)%kindSet.length];
  const xx=frontX+face*.025;
  // Rows of objects stay above shelves, with no additional collision volumes.
  renderOriginalProduct(kind,xx,shelfY+.053,zz,.79);
 }
 // Shelf-edge label strip and short price-card blocks.
 box(frontX,shelfY-.022,o.z,.035,.046,o.depth*.91,0xe2dfce);
 for(let i=0;i<4;i++){
  const zz=o.z-o.depth*.36+i*o.depth*.24;
  box(frontX+face*.022,shelfY-.016,zz,.012,.019,o.depth*.105,0x856e56);
 }
}
function populateColdCase(o,shelfY,tier){
 const kinds=['green-tea','mineral-water','canned-coffee','fruit-juice'];
 for(let i=0;i<8;i++){
  const xx=o.x-o.width*.42+(i+.5)*o.width*.84/8;
  const kind=kinds[(i+tier+o.id.length)%kinds.length];
  renderOriginalProduct(kind,xx,shelfY+.055,o.z-o.depth*.5-.15,.65);
 }
}
