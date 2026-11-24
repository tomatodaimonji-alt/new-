const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=build('base');site.id='base';const d=site.davidTemple,w=site.map.world;
function env(extra={}){
 const c=vm.createContext({facilitySite:site,world:w,poiWalkActive:true,poiWalkX:24,poiWalkZ:103,poiWalkLevel:0,
  poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,facilityFloorMasks:[],facilityRefreshStairs(){},
  facilityCreekIndex:null,validPos:(x,z)=>x>=0&&z>=0&&x<128&&z<128,poiMonsterAt:()=>null,
  poiIsMonster:t=>t==='monsterStoneDavid',pineSuperVehicleType:()=>false,isWallId:t=>/wall/i.test(t),
  isFloor:t=>/^(road|grass|earth|woodfloor)/.test(t),...extra});
 vm.runInContext(cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  cut('function poiWalkCanStep(','function poiFreeCenter(')+
  cut('function poiPlayerRayClear(','function poiPlayerWeaponTrace(')+
  cut('const facilityCellKey=','function facilityRefreshStairs(')+
  cut('function facilityFloorOwner(','function facilityValidLanding(')+
  cut('function facilityHiddenRoof(','function pineGuildRenewalSample(')+
  cut('function poiWalkIndoor(','function poiWalkRoof(')+
  cut('function poiSkyCanLookUp(','function poiOrbitPitchClamp(')+
  cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP'),c);
 c.facilityPrepareFloorMasks();
 return c;
}
test('no roof exists or masks outdoor sky, even in direct old in-arena save',()=>{
 a.equal(d.ring.radius,18);
 a.equal(w.slice(d.authored.index).some(o=>o.y>0),false);
 a.equal(w.slice(d.authored.index).some(o=>o.type==='poiDavidDome'),false);
 a.doesNotMatch(h,/poiDavidTempleRoofStays|poiDavidTempleKeepRoof/);
 const c=env();a.equal(c.facilityHiddenRoof(),null);a.equal(c.poiWalkIndoor(),false);a.equal(c.poiSkyCanLookUp(),true);
});
test('actual threshold, piers and mirrored body wall meet one straight center, preserving prior approach and boss',()=>{
 a.deepEqual(JSON.parse(JSON.stringify(d.entrance)),{x:24,z:94,y:0});
 a.deepEqual(JSON.parse(JSON.stringify(d.retreat)),{x:24,z:91,y:0});
 a.deepEqual([d.boss.x,d.boss.z,d.boss.room.minZ],[24,104,93]);
 a.deepEqual(JSON.parse(JSON.stringify(d.boss.room.arena)),{x:24,z:104,radius:16.95,minZ:93.5});
 const props=w.slice(d.authored.index),wings=props.filter(o=>o.type==='poiDavidWallWing'),c=env();
 a(wings.length>=22);
 const type=(x,z)=>props.find(o=>o.x===x&&o.z===z&&!c.isFloor(o.type))?.type;
 for(const [x,t] of [[20,'poiDavidWallWing'],[21,'poiDavidGatePier'],[27,'poiDavidGatePier'],[28,'poiDavidWallWing']]){
  a.equal(type(x,94),t);a.equal(c.poiWalkCanStep(x,94,x,93),false);
 }
 for(const p of wings)a(wings.some(b=>b.x===48-p.x&&b.z===p.z&&b.rot===p.rot));
 for(let x=22;x<=26;x++){
  a.equal(c.poiWalkCanStep(x,94,x,93),true);
  a.equal(c.poiPlayerRayClear(x,94,0,x,93),true);
 }
 for(const x of [20,21,27,28])a.equal(c.poiPlayerRayClear(x,94,0,x,93),false,'pier/wall '+x+' blocks shots as well as walking');
 for(let x=29;x<=35;x++)a(c.poiWalkCanStep(x,88),x);
 for(let i=0;i<d.approach.length;i++){
  const p=d.approach[i],q=d.approach[i-1]??p;
  a(c.poiWalkCanStep(p.x,p.z,q.x,q.z),JSON.stringify(p));
 }
 for(const p of [{x:24,z:94,y:0,facing:2},{x:24,z:91,y:0,facing:3},{x:24,z:103,y:0,facing:0}])a.equal(c.poiDavidTempleRecoverPosition(p),p);
 for(const p of wings){
  const old={...p,facing:3},next=c.poiDavidTempleRecoverPosition(old);
  a(Math.abs(next.x-old.x)+Math.abs(next.z-old.z)===1,JSON.stringify(old));
  a(c.poiWalkCanStep(next.x,next.z));a.equal(next.facing,3);
 }
});
test('north masonry is a real closed boundary except for the gate, not a second facade with a side opening',()=>{
 const c=env(),from={x:29,z:88},to={x:24,z:100},seen=new Set(),q=[from];
 const key=(x,z)=>x+','+z,walk=new Map();let blockedGate=false;
 function reachable(lock){
  seen.clear();q.length=1;seen.add(key(from.x,from.z));
  while(q.length){
   const p=q.shift();if(p.x===to.x&&p.z===to.z)return true;
   for(const [dx,dz] of [[-1,0],[1,0],[0,-1],[0,1]]){
    const x=p.x+dx,z=p.z+dz,k=key(x,z);
    if(x<3||x>44||z<84||z>124||seen.has(k)||lock&&z===94&&x>=22&&x<=26)continue;
    if(!walk.has(k))walk.set(k,c.poiWalkCanStep(x,z));
    if(!walk.get(k))continue;
    seen.add(k);q.push({x,z});
   }
  }
  return false;
 }
 a.equal(reachable(false),true);q.splice(0,q.length,from);a.equal(reachable(true),false,'every exterior approach passes through the centered gate');
});
test('authored wing, portal and path align in actual submitted stone vertex space',()=>{
 const c=vm.createContext({mesh:()=>({p:[],n:[],c:[]})});
 vm.runInContext(cut('function tri(m,a,b,c,col){','function addPart(')+
  cut('// BEGIN DAVID TEMPLE ARCHITECTURE','// END DAVID TEMPLE ARCHITECTURE')+
  cut('// BEGIN ROUND DAVID TEMPLE ART','// END ROUND DAVID TEMPLE ART'),c);
 const m=c.mesh(),gateX=d.entrance.x+.5,plane=d.entrance.z+.5;
 for(const x of [20,28])c.poiDavidWingGeometry(m,x+.5,0,plane,0);
 for(const [x,t] of [[21,0],[27,2]])c.poiDavidTempleArchitecture(m,'poiDavidGatePier',x+.5,0,plane,t);
 const vertices=m.p.reduce((p,q,i)=>i%3?p:[...p,m.p.slice(i,i+3)],[]);
 a(vertices.every(p=>Math.abs(p[2]-plane)<.54));
 a(vertices.filter(p=>p[1]<3.5).every(p=>p[0]<22.001||p[0]>26.999),'foot-level aperture is exactly x22–26');
 a(vertices.some(p=>p[1]>=3.88&&Math.abs(p[0]-gateX)<.32),'the two lintels meet above the center, not inside the path');
 const stripe=w.find(o=>o.x===24&&o.z===94&&o.type==='roadRoyalFull');a(stripe);
});
test('legacy world data and castle roof behavior are untouched, and map transport accepts actual new walls',()=>{
 const old=w.slice(0,d.authored.index),tiles=w.slice(d.authored.index),key=o=>[o.x,o.z,o.y].join(',');
 a.equal(old.length,8984);
 a.equal(crypto.createHash('sha256').update(JSON.stringify(old)).digest('hex'),'15535689893b8a631827467885930d45d786e0d3b559b74d6a2544267d03439a');
 const prior=new Set(old.map(key));a(tiles.every(o=>!prior.has(key(o))));
 a.equal(d.authored.count,tiles.length);a(tiles.length<=1250);
 const round=tiles.filter(o=>o.type==='poiDavidWallRound');
 a(round.length>70&&round.length<170);a(round.every(o=>Math.hypot(o.x-24,o.z-104)>16));
 a(old.some(o=>o.x===29&&o.z===88&&o.type==='grassTrampled'));
 const run=env({facilityRoofMeshes:[{count:0}],facilitySite:site});
 a(run.poiWalkCanStep(24,94));a(!run.poiPlayerRayClear(42,104,0,41,104));
 a.match(h,/facilityObjectVisible[\s\S]*?poiWalkActive&&facilityIsRoofPiece\(o\)&&facilityRoofOwner\(o\)!==null\)return false/);
 const c=vm.createContext({MIN_MAP:12,MAX_MAP:128,MAX_LEVEL:8,TERRAIN_MAX:12,PINE_CHECK_COLORS:[],site,facilitySite:site,
  world:w,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<128,isWallId:()=>false});
 vm.runInContext(cut('const palette=[','const catalog=new Map(')+'const catalog=new Map(palette.map(p=>[p.id,p]));'+
  cut('function validModel(','function displayJSON(')+cut('function facilityExportMap(','function facilityDownload(')+
  ';globalThis.validation=(m=site.map)=>pineValidateWorldData(facilityExportMap(m));globalThis.catalog=catalog;',c);
 for(const id of ['monsterStoneDavid','poiDavidGatePier','poiDavidTempleColumn','poiDavidWaystone','poiDavidWallWing','poiDavidWallRound','poiDavidDome'])a(c.catalog.has(id),id);
 a.equal(c.validation().newW,128);
});

test('old editor and prefab dome ID validates alongside unrelated stocked objects and still has real legacy geometry',()=>{
 const c=vm.createContext({MIN_MAP:12,MAX_MAP:128,MAX_LEVEL:8,TERRAIN_MAX:12,PINE_CHECK_COLORS:[],site,facilitySite:site,
  world:w,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<128,isWallId:()=>false,mesh:()=>({p:[],n:[],c:[]})});
 vm.runInContext(cut('const palette=[','const catalog=new Map(')+'const catalog=new Map(palette.map(p=>[p.id,p]));'+
  cut('function validModel(','function displayJSON(')+cut('function facilityExportMap(','function facilityDownload(')+
  cut('function tri(m,a,b,c,col){','function addPart(')+cut('// BEGIN ROUND DAVID TEMPLE ART','// END ROUND DAVID TEMPLE ART')+
  ';globalThis.validation=m=>{const f=facilityExportMap(m);return {...pineValidateWorldData(f),world:f.world,offset:f.workshopFacility.floorOffset}};',c);
 const roof={x:24,z:104,y:2,type:'poiDavidDome',rot:0},m=c.mesh();
 const prefab={id:'prefab-old-dome',name:'旧ドーム',w:1,h:1,tiles:[{x:0,z:0,y:2,type:roof.type,rot:0}]};
 const previous=Object.assign({},site.map,{world:[...site.map.world,roof],prefabs:[prefab]});
 const imported=c.validation(previous);
 a.equal(imported.newW,128);a(imported.world.some(o=>o.type===roof.type&&o.y===2+imported.offset));
 a(imported.world.some(o=>o.type==='monsterStoneDavid'&&o.x===24&&o.z===104));
 a.equal(imported.blocks[0].tiles[0].type,roof.type);
 c.poiDavidDomeGeometry(m,24.5,104.5);a(m.p.length/3>2000&&m.p.length/3<3200);
});
