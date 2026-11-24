// BEGIN LOCAL MINI CORE
const POI_LOCAL_MAP_KEY='world-workshop-map-survey-v1',POI_LOCAL_SIDE=41,POI_LOCAL_HALF=20;
const POI_LOCAL_W=128,POI_LOCAL_H=182,POI_LOCAL_BYTES=POI_LOCAL_W*POI_LOCAL_H/8,POI_LOCAL_SCOPES=48;
function poiLocalCrop(x,z){return {x1:x-POI_LOCAL_HALF,z1:z-POI_LOCAL_HALF,x2:x+POI_LOCAL_HALF,z2:z+POI_LOCAL_HALF}}
function poiLocalView(zoom=1,x=0,z=0){
 const n=Math.max(1,Math.min(4,zoom)),max=POI_LOCAL_SIDE-POI_LOCAL_SIDE/n;
 return {zoom:n,x:Math.max(0,Math.min(max,x)),z:Math.max(0,Math.min(max,z))};
}
function poiLocalProject(crop,v){
 const x1=crop.x1+v.x,z1=crop.z1+v.z,span=POI_LOCAL_SIDE/v.zoom;
 return {x1,z1,x2:x1+span,z2:z1+span};
}
function poiLocalBits(){return new Uint8Array(POI_LOCAL_BYTES)}
function poiLocalBit(x,z){
 return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&x<POI_LOCAL_W&&z>=0&&z<POI_LOCAL_H?z*POI_LOCAL_W+x:-1;
}
function poiLocalKnown(bits,x,z){
 const i=poiLocalBit(x,z);
 return !!(bits&&i>=0&&(bits[i>>3]&(1<<(i&7))));
}
function poiLocalMark(bits,x,z){
 const i=poiLocalBit(x,z);
 if(i<0)return false;
 const b=i>>3,n=1<<(i&7);
 if(bits[b]&n)return false;
 bits[b]|=n;return true;
}
function poiLocalEncode(surveys){
 const scopes={};
 for(const [scope,bits] of surveys)scopes[scope]=btoa(String.fromCharCode(...bits));
 return JSON.stringify({version:1,scopes});
}
function poiLocalDecode(raw){
 const out=new Map();
 if(typeof raw!=='string'||raw.length>196608)return out;
 try{
  const {version,scopes}=JSON.parse(raw)??{};
  if(version!==1||!scopes||typeof scopes!=='object'||Array.isArray(scopes))return out;
  for(const [scope,text] of Object.entries(scopes).slice(0,POI_LOCAL_SCOPES)){
   if(!/^[a-z0-9_-]{1,36}:(?:-1|[0-9]):[a-zA-Z0-9_-]{1,24}$/.test(scope)||
     typeof text!=='string'||text.length!==Math.ceil(POI_LOCAL_BYTES/3)*4||!/^[a-zA-Z0-9+/]+={0,2}$/.test(text))continue;
   const data=atob(text);
   if(data.length===POI_LOCAL_BYTES)out.set(scope,Uint8Array.from(data,k=>k.charCodeAt(0)));
  }
 }catch(_){}
 return out;
}
function poiLocalSightRadius(indoor,fog){return fog>.5?5:indoor?6:8}
// An endpoint can be a visible wall. No ray passes through it or cuts the
// corner of a neighboring wall between two visited grid centers.
function poiLocalRay(x,z,tx,tz,blocked){
 const dx=tx-x,dz=tz-z,sx=Math.sign(dx),sz=Math.sign(dz);
 const cx=dx ? .5/Math.abs(dx) : Infinity,cz=dz ? .5/Math.abs(dz) : Infinity;
 let nx=cx,nz=cz;
 while(x!==tx||z!==tz){
  if(Math.abs(nx-nz)<1e-9){
   if(blocked(x+sx,z)||blocked(x,z+sz))return false;
   x+=sx;z+=sz;nx+=2*cx;nz+=2*cz;
  }else if(nx<nz){x+=sx;nx+=2*cx}
  else{z+=sz;nz+=2*cz}
  if((x!==tx||z!==tz)&&blocked(x,z))return false;
 }
 return true;
}
// END LOCAL MINI CORE
let poiLocalSurveys=null,poiLocalSurveyDirty=false,poiLocalSaveTimer=null;
let poiLocalTopology=null,poiLocalSample=null,poiLocalFrame=null,poiLocalOverlay=null;
function poiLocalSave(){
 if(poiLocalSaveTimer!==null){clearTimeout(poiLocalSaveTimer);poiLocalSaveTimer=null}
 if(!poiLocalSurveyDirty||poiGameResetDeparture||poiGameResetBlocked)return;
 try{localStorage.setItem(POI_LOCAL_MAP_KEY,poiLocalEncode(poiLocalSurveys));poiLocalSurveyDirty=false}catch(_){}
}
function poiLocalDirty(){
 poiLocalSurveyDirty=true;
 if(poiLocalSaveTimer===null)poiLocalSaveTimer=setTimeout(poiLocalSave,2000);
}
function poiLocalSurvey(scope){
 if(!poiLocalSurveys){
  try{poiLocalSurveys=poiLocalDecode(localStorage.getItem(POI_LOCAL_MAP_KEY))}
  catch(_){poiLocalSurveys=new Map()}
 }
 let bits=poiLocalSurveys.get(scope);
 if(!bits){
  if(poiLocalSurveys.size>=POI_LOCAL_SCOPES)poiLocalSurveys.delete(poiLocalSurveys.keys().next().value);
  bits=poiLocalBits();poiLocalSurveys.set(scope,bits);
 }
 return bits;
}
function poiLocalInvalidate(){poiLocalTopology=poiLocalSample=poiLocalFrame=null}
function poiLocalCategory(t){
 return BRIDGE_IDS.has(t)?6:t==='poiFortGate'||t==='otherworldPortal'||poiWalkPassableDoor(t)?5:
  t==='guildStairDown'||t==='guildStairUp'?7:
  isWallId(t)||t.includes('wall')||t.startsWith('tower')||/^poiFort(?:Wall|Corner|Boundary)$/.test(t)||t==='poiDavidGatePier'?4:
  t==='water'||t==='river'||t==='lake'||t==='sea'?3:ROAD_IDS.has(t)||t==='earth'?2:isFloor(t)?1:0;
}
function poiLocalOpaque(t){
 return t==='poiFortGate'||t==='ironGate'||t==='otherworldPortal'||t==='poiDavidGatePier'||
  /^poiFort(?:Wall|Corner|Boundary)$/.test(t)||isWallId(t)||/(?:Wall|wall)[A-Z_]/.test(t);
}
function poiLocalTopologyFor(site,concealed){
 if(poiLocalTopology?.world===world&&poiLocalTopology.site===site&&poiLocalTopology.concealed===concealed)return poiLocalTopology;
 const hidden=concealed&&typeof poiSacredMiniRecords==='function'?poiSacredMiniRecords(site,true):null,levels=new Map();
 for(const o of world){
  const i=poiLocalBit(o.x,o.z);if(i<0)continue;
  const t=o.type,cat=poiLocalCategory(t),door=poiWalkPassableDoor(t),wall=poiLocalOpaque(t);
  if(!cat&&!wall&&!door)continue;
  let row=levels.get(o.y);
  if(!row){row={cats:new Uint8Array(POI_LOCAL_W*POI_LOCAL_H),walls:new Uint8Array(POI_LOCAL_W*POI_LOCAL_H)};levels.set(o.y,row)}
  if(!(hidden&&o.y===0&&hidden.has(poiSacredMiniRecordKey(o))))row.cats[i]=Math.max(row.cats[i],cat);
  if(wall||door)row.walls[i]|=(wall?1:0)|(door?2:0)|(t==='ironGate'?4:0);
 }
 if(site?.id==='base'){
  const entry=site.mine?.entrance,trail=site.northTrail;
  for(const [marker,tone] of [[entry,8],[trail?.supply,9],[trail?.waymark,10],[trail?.watchPost?.waymark,11],[trail?.wayfarer?.well,12]]){
   if(!marker)continue;
   if(marker!==entry&&(marker===trail?.supply?!poiNorthTrailSupplyGround(marker):!world.some(o=>o.x===marker.x&&o.z===marker.z&&o.y===marker.y&&o.type===marker.type)))continue;
   const row=levels.get(marker.y),i=poiLocalBit(marker.x,marker.z);if(row&&i>=0)row.cats[i]=tone;
  }
 }
 poiMiniBuilds++;
 return poiLocalTopology={world,site,concealed,levels};
}
function poiLocalBlocked(row,site,y,x,z){
 const flags=row?.walls[poiLocalBit(x,z)]??0;
 if(flags&4&&site?.id==='base'){
  const same=g=>g&&g.x===x&&g.z===z&&g.y===y;
  if(same(site.mine?.vault?.gate)&&poiMineVaultGateOpen()||same(site.otherworld?.gate)&&poiOtherworldGateOpen()||
     same(site.chapel?.gate)&&poiChapelGateOpen())return false;
 }
 if(flags&2)return !(poiWalkDoorOpen?.x===x&&poiWalkDoorOpen.z===z&&poiWalkDoorOpen.y===y);
 return !!flags;
}
const poiLocalTones=['#3a5043','#587764','#a3926b','#477984','#bcb49b','#efc180','#ceab71',
 '#b2ccd1','#f0cd89','#83aaa4','#b1c4b3','#cfbb80','#92cad8'];
function poiLocalCapture(x,z,y,site,realmKey,realm,concealed,quests){
 const crop=poiLocalCrop(x,z),hasSite=site&&/^[a-z0-9_-]{1,36}$/.test(site.id),scope=hasSite?site.id+':'+y+':'+(realmKey||'surface'):null;
 const map=poiLocalTopologyFor(site,concealed),row=map.levels.get(y);
 const bits=scope?poiLocalSurvey(scope):null; // Temporary editor preview is never recorded.
 const door=poiWalkDoorOpen;
 const access=(x,z)=>x>=0&&z>=0&&x<MAP_W&&z<MAP_H&&(!realm||x>=realm.x1&&x<=realm.x2&&z>=realm.z1&&z<=realm.z2);
 const temple=concealed&&site?.davidTemple,closed=(tx,tz)=>!access(tx,tz)||(temple&&poiSacredMiniEntrance(temple,tx,tz))||poiLocalBlocked(row,site,y,tx,tz);
 const indoor=poiWalkIndoor(),fog=typeof poiSacredFogStrength==='function'?poiSacredFogStrength(site,x,z,y):0,
  radius=poiLocalSightRadius(indoor,fog);
 const sample=poiLocalSample;
 if(bits&&(sample?.map!==map||sample.scope!==scope||sample.x!==x||sample.z!==z||sample.door!==door||sample.radius!==radius)){
  poiLocalSample={map,scope,x,z,door,radius};
  let changed=false;
  for(let dz=-radius;dz<=radius;dz++)for(let dx=-radius;dx<=radius;dx++){
   const tx=x+dx,tz=z+dz;
   if(dx*dx+dz*dz>radius*radius||!access(tx,tz)||(temple&&poiSacredMiniEntrance(temple,tx,tz)))continue;
   if(!poiLocalKnown(bits,tx,tz)&&poiLocalRay(x,z,tx,tz,closed))changed=poiLocalMark(bits,tx,tz)||changed;
  }
  if(changed)poiLocalDirty();
 }
 const marks=quests.filter(q=>access(q.x,q.z)&&q.x>=crop.x1&&q.x<=crop.x2&&q.z>=crop.z1&&q.z<=crop.z2&&
  poiLocalKnown(bits,q.x,q.z)&&!(temple&&poiSacredMiniEntrance(temple,q.x,q.z)));
 const cells=new Uint8Array(POI_LOCAL_SIDE**2);
 for(let i=0;i<cells.length;i++){
  const tx=crop.x1+i%POI_LOCAL_SIDE,tz=crop.z1+Math.floor(i/POI_LOCAL_SIDE);
  if(!access(tx,tz)||(temple&&poiSacredMiniEntrance(temple,tx,tz)))continue;
  if((tx===x&&tz===z)||poiLocalKnown(bits,tx,tz))cells[i]=1+(row?.cats[poiLocalBit(tx,tz)]??0);
 }
 return {cells,crop,marks,x,z,y,scope,realm:realmKey,concealed,facing:poiWalkFacing};
}
function poiLocalPaint(cv,frame,v=poiLocalView()){
 const g=cv.getContext('2d');if(!g||!frame)return;
 const {width,height}=cv,{cells,crop,marks,x,z,y}=frame,{x1,z1}=poiLocalProject(crop,v),scale=width/POI_LOCAL_SIDE*v.zoom;
 g.fillStyle='#000';g.fillRect(0,0,width,height);
 for(let i=0;i<cells.length;i++)if(cells[i]){
  const cx=crop.x1+i%POI_LOCAL_SIDE-x1,cz=crop.z1+Math.floor(i/POI_LOCAL_SIDE)-z1;
  if(cx<-1||cz<-1||cx>POI_LOCAL_SIDE/v.zoom||cz>POI_LOCAL_SIDE/v.zoom)continue;
  const l=Math.round(cx*scale),t=Math.round(cz*scale);
  g.fillStyle=poiLocalTones[cells[i]-1];g.fillRect(l,t,Math.round((cx+1)*scale)-l,Math.round((cz+1)*scale)-t);
 }
 for(const q of marks)poiMiniQuestMark(g,(q.x+.5-x1)*scale,(q.z+.5-z1)*scale);
 const px=(x+.5-x1)*scale,pz=(z+.5-z1)*scale,[dx,dz]=[[0,-1],[1,0],[0,1],[-1,0]][frame.facing]||[0,-1];
 g.fillStyle='#ffde7f';g.strokeStyle='#17241e';g.lineWidth=1.7;
 g.beginPath();g.arc(px+dx*4.2,pz+dz*4.2,1.55,0,Math.PI*2);g.fill();
 g.beginPath();g.arc(px,pz,3.25,0,Math.PI*2);g.fill();g.stroke();
 g.fillStyle='#f0e3b8';g.font='bold 10px system-ui';g.textAlign='right';g.fillText('N',width-5,12);
 if(y!==0){g.textAlign='left';g.fillText(frame.realm==='otherworld'?'異界':y<0?'B'+(-y):(y+1)+'F',5,12)}
}
