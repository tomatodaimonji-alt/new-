// v20: independent, walkable convenience-store study. 1 unit approximately 1 m.
// Store modeled without a central roof sheet so the interior stays visible from
// the existing third-person camera. Perimeter eaves and ceiling fixtures remain.
const convenienceBuffers=[];
function makeConvenienceMesh(id,build){
 const start=vertices.length;
 build();
 const data=new Float32Array(vertices.splice(start));
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
 gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
 convenienceBuffers.push({id,buffer,count:data.length/6});
}
function storeLight(x,y,z){
 box(x,y,z,2.1,.055,.24,0xf5eee0);
 box(x,y+.05,z,2.2,.045,.30,0xc7c7c4);
}
function storeShell(){
 const b=convenience,front=b.z-b.depth/2,back=b.z+b.depth/2;
 box(b.x,-.12,b.z,b.width,.115,b.depth,0xd2cfbf);
 // Tile joints: small elevations above the pale floor, no coplanar fighting.
 for(let x=-8;x<=8;x+=1.1)box(x,-.002,b.z,.013,.004,b.depth-.18,0xb8b9b1);
 for(let z=70;z<89.5;z+=1.1)box(0,-.002,z,b.width-.20,.004,.013,0xb8b9b1);
 // Exterior walls; entrance is physically open (no invisible door collision).
 for(const x of [-b.width/2,b.width/2])
  box(x,0,b.z,.18,b.height,b.depth+.18,0xbbb9ad);
 box(0,0,back,b.width+.2,b.height,.2,0xc2c3bb);
 for(const side of [-1,1]){
  // Facade: glazed panels at either side of the 3.5 m central sliding doorway.
  const left=side*5.25;
  box(left,0,front,7,.17,.17,0x9ca4a1);
  box(left,3.08,front,7,.17,.17,0x9ca4a1);
  box(left,0,front,.12,3.1,.18,0x7b898c);
  box(left+side*3.44,0,front,.12,3.1,.18,0x7b898c);
  // Blue-grey glazing represented as thin solid tinted panes until texture support.
  box(left,1.25,front+.03,6.78,1.66,.055,0x779aa4);
  box(left,.12,front+.035,6.78,1.1,.06,0x98bac1);
  box(left,1.44,front-.10,6.8,.045,.065,0xd4d6cf);
 }
 // Door track is overhead, not in the pedestrian's collision path.
 box(0,3.08,front,.16,.14,3.75,0x687980);
 box(0,3.27,front,3.78,.13,.2,0x7a8887);
 // Prominent unbranded convenience sign above full-width glazed facade.
 box(0,3.38,front-.29,b.width+.22,.73,.24,0xf0ede5);
 box(0,3.90,front-.30,b.width+.22,.115,.25,0x3b777f);
 box(0,3.42,front-.43,b.width-.95,.055,.028,0x7ba49d);
 box(0,3.17,front-.43,b.width-.95,.05,.028,0x466e8f);
 // Structural corner posts, soffit edge; ceiling deliberately open for filming.
 for(const x of [-8.62,8.62])
  for(const z of [front,back])box(x,0,z,.21,b.height,.21,0x8e9695);
 for(const x of [-8.6,8.6])box(x,4.29,b.z,.28,.16,b.depth,0xb4b7ad);
 for(const z of [front,back])box(0,4.29,z,b.width,.16,.28,0xb4b7ad);
 // Hanging fluorescent strips, checkout light, entrance mat.
 for(const x of [-5.7,0,5.7])for(const z of [74.5,81.0,86.6])storeLight(x,3.72,z);
 box(0,-.014,front-2.85,7.3,.045,4.1,0xa8a7a0);
 // Outdoor trash/recycling stations and bicycle stand beside facade.
 for(let i=0;i<3;i++){
  const x=5.65+i*.92;
  box(x,-.025,front-1.35,.7,1.05,.63,[0x4f717a,0x728d69,0x8c7770][i]);
  box(x,1.02,front-1.35,.73,.10,.66,0x424e4f);
 }
 for(const x of [-6.8,-5.8]){
  box(x,-.015,front-1.0,.075,.57,.075,0x838f91);
  box(x,.52,front-1,.82,.06,.07,0x838f91);
 }
}
function renderStoreFixture(o){
 const {type,x,z,width:w,depth:d,height:h}=o;
 if(type==='floor-mat'){
  box(x,-.009,z,w,.012,d,0x52605f);
  for(let i=-1;i<=1;i++)box(x+i*.48,.005,z,.09,.012,d*.72,0x677471);
  return;
 }
 if(type==='register'){
  // Point-of-sale equipment is displayed on, but does not double-block, checkout.
  box(x,.96,z,w,.12,d,0x333940);
  box(x,1.05,z-.16,.39,.32,.09,0x263944);
  box(x,1.08,z-.215,.28,.22,.017,0x6c98a9);
  box(x+.3,1.01,z+.16,.23,.13,.24,0xddddce);
  // Barcode scanner and card/QR payment reader.
  box(x-.27,.99,z+.15,.14,.12,.19,0x343a3a);
  box(x-.27,1.10,z+.15,.11,.035,.14,0x7da8ad);
  box(x+.30,1.16,z+.18,.17,.025,.13,0x425b61);
  // Small receipt and counter keypad.
  box(x+.08,1.00,z+.17,.15,.028,.13,0xbcc2b6);
  for(let i=0;i<3;i++)box(x+.01+i*.065,1.027,z+.17,.03,.006,.07,0x7c8685);
  return;
 }
 if(type==='checkout'){
  box(x,0,z,w,.9,d,0xa58d72);
  box(x,.90,z,w+.12,.12,d+.14,0x5d6261);
  box(x,.13,z-d/2,.12,.75,d*.48,0x877b66);
  // Checkout basket and divider; product-facing counter stays uncluttered.
  box(x-w*.34,1.027,z+.24,.36,.09,.30,0x4f7272);
  box(x-w*.34,1.05,z+.24,.29,.045,.24,0x879c91);
  box(x+.8,.99,z+.15,.035,.10,.45,0x8b9b96);
  return;
 }
 if(type==='fridge'){
  box(x,0,z,w,h,d,0xdadfd9);
  box(x,.14,z-d/2-.035,w-.18,h-.32,.09,0x6b929f);
  for(let shelf=0;shelf<4;shelf++){
   const y=.47+shelf*.47;
   box(x,y,z-d/2-.11,w-.22,.055,.15,0xc2d0ce);
   populateColdCase(o,y,shelf);
  }
  // Narrow divisions and refrigerator handles.
  box(x,0,z-d/2-.20,.045,h-.14,.06,0xced4d4);
  for(const side of [-1,1])
   box(x+side*(w/2-.1),.95,z-d/2-.21,.055,.65,.045,0xe8ede9);
  return;
 }
 if(type==='hot-case'){
  box(x,0,z,w,.6,d,0x8f8271);
  box(x,.64,z,w,h-.64,d,0xb3a695);
  box(x,.69,z-d/2-.06,w-.12,h-.76,.055,0x8b9b9a);
  for(let i=0;i<3;i++)box(x-w*.3+i*w*.3,.82,z-d/2-.12,.17,.12,.12,0xc7a36e);
  return;
 }
 // Gondola and side racks: open shelves and repeated product silhouettes.
 box(x,0,z,w,.14,d,0x747a76);
 for(const side of [-1,1]){
  box(x+side*(w/2-.05),0,z,.07,h,d,0x858e8b);
 }
 for(let tier=0;tier<4;tier++){
  const y=.28+tier*(h-.35)/4;
  box(x,y,z,w,.05,d,0xb6bab4);
  for(const face of [-1,1])populateStoreShelf(o,tier,face,y);
 }
 box(x,h-.07,z,w+.04,.13,d+.03,0x999e96);
}
function buildConvenience(){
 makeConvenienceMesh(convenience.id,storeShell);
 for(const o of scene.objects.filter(o=>o.poiId===convenience.poiId))
  makeConvenienceMesh(o.id,()=>renderStoreFixture(o));
}
buildConvenience();
// Small navigation shortcut makes the new study area accessible from the 100+ m street.
const storeJump=document.getElementById('storeJump');
storeJump.addEventListener('click',()=>{
 if(shootState.enabled)return;
 if(player.z<66){player.x=0;player.z=65.8;storeJump.textContent='街へ戻る';}
 else {player.x=0;player.z=0;storeJump.textContent='コンビニへ';}
 resetStick();
});
// Walkable store: explicit perimeter walls and individual fixture colliders.
function convenienceBlocked(x,z){
 const b=convenience,front=b.z-b.depth/2,back=b.z+b.depth/2;
 const margin=.23;
 if(x>-b.width/2-margin&&x<b.width/2+margin&&z>front-margin&&z<back+margin){
  if(Math.abs(x)>b.width/2-margin||z>back-margin)return true;
  if(z<front+margin&&Math.abs(x)>b.entrance.opening/2-margin)return true;
 }
 // Only registered fixture volumes can block walking, not drawn decorations.
 for(const o of scene.objects){
  if(o.poiId!=='convenience-study'||o.type==='floor-mat'||o.type==='register')continue;
  if(Math.abs(x-o.x)<o.width/2+margin&&Math.abs(z-o.z)<o.depth/2+margin)return true;
 }
 return false;
}
