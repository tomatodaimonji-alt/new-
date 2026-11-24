const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=build('base'),t=site.davidTemple,w=site.map.world,W=o=>/^poiDavid(?:Wall|GatePier)/.test(o.type);
site.id="base";
test('canonical same-world entry uses real straight dark masonry, then close centered reveal',()=>{
 a.deepEqual([t.entrance.x,t.entrance.z,t.retreat.z,t.boss.x,t.boss.z],[24,128,125,24,158]);
 a(t.interior&&t.interior.exitZ===142,'a real same-scene passage is authored');
 a(t.interior.path.length>=10);
 const occupied=(x,z)=>w.some(o=>o.x===x&&o.z===z&&o.y===0&&W(o));
 for(let i=0;i<t.interior.path.length;i++){const p=t.interior.path[i],q=t.interior.path[i-1]??p;
  a(!occupied(p.x,p.z)); a(i===0||Math.abs(q.x-p.x)+Math.abs(q.z-p.z)===1);
 }
 a(occupied(22,132)&&occupied(26,132)&&!occupied(24,132),'the straight aperture has solid side walls and stays walkable');
 a(!t.boss.room.arena.cells.has('24,141')&&t.boss.room.arena.cells.has('24,142')&&t.boss.room.arena.cells.has('24,158'));
});
test('solid dome/ceiling, tunnel top and locally budgeted warm sconces are physical scene content',()=>{
 a.equal(t.interior.permanent,true);
 const pieces=w.slice(t.authored.index,t.authored.index+t.authored.count);
 a.equal(pieces.filter(o=>o.type==='poiDavidSacredRoof').length,1);
 a(pieces.filter(o=>o.type==='poiDavidTunnelRoof').length>=7);
 a(pieces.filter(o=>/^poiDavidCandle/.test(o.type)).length>=8);
 a(pieces.filter(o=>/^poiDavidCandle/.test(o.type)).length<=16);
 const roof=vm.runInNewContext(cut('function facilityVisibleRoofs(','function facilityCollectEntranceGuides(')+';facilityVisibleRoofs',
  {poiWalkActive:true,poiWalkLevel:0,poiWalkViewX:24,poiWalkViewZ:145,cameraTopDown:false,facilitySite:site,facilityHiddenRoof:()=>site.buildings.findIndex(b=>b.id==='davidTemple'),facilityRoofMeshes:site.buildings.map(()=>({count:1}))});
 a(roof().includes(site.buildings.findIndex(b=>b.id==='davidTemple')),'authored roof must actually draw even on its inside');
});
test('the true wall-ray and walking functions block axial and side exterior sightings, but establish a short clear boss reveal',()=>{
 const c=vm.createContext({facilitySite:site,world:w,poiWalkActive:true,poiWalkLevel:0,poiMonsterAt:()=>null,
   isWallId:t=>/Wall/.test(t),isFloor:t=>/^(road|earth|grass|floor)/i.test(t),poiIsMonster:t=>t==='monsterStoneDavid',pineSuperVehicleType:()=>false,
   facilityCreekIndex:null,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<182&&(z<128||x<48),POI_AIM_EPS:1e-6});
 vm.runInContext(cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+
  cut('function poiPlayerRayClear(','function poiPlayerWeaponTrace(')+
  cut('function poiAimWallLimit(','function poiAimChooseLock(')+cut('function poiWalkCanStep(','function poiFreeCenter(')+
  cut('function poiDavidTempleEnclosedAt(','// END DAVID TEMPLE MAP'),c);
 const opts=(x,z,fx,fz)=>c.poiPlayerRayClear(x,z,0,fx,fz);
 function direct(x,z,tx=24,tz=158){
  const dx=tx-x,dz=tz-z,len=Math.hypot(dx,dz);
  return c.poiAimWallLimit({x,z},{x:dx/len,z:dz/len},len,opts)>=len-1e-6;
 }
 for(const x of [17,19,21,27,29,31])for(let z=126;z<=133;z+=1.3)a(!direct(x,z),`side peek at ${x},${z}`);
 for(const z of [128,129,130,131,132,133,134])for(const x of [22,23,24,25,26]){
  const p={x,z,y:0,facing:2};
  if(c.poiWalkCanStep(x,z))continue;
  const q=c.poiDavidTempleRecoverPosition(p);
  a(Math.hypot(q.x-x,q.z-z)<=1&&c.poiWalkCanStep(q.x,q.z),JSON.stringify(p));
  a.deepEqual([q.y,q.facing],[p.y,p.facing]);
 }
 for(const p of t.interior.path)a(c.poiWalkCanStep(p.x,p.z));
 a(direct(24,142),'the actual eye line down the release portal is clear; actual long straight hall opens into centered arena');
 a(c.poiDavidTempleEnclosedAt(site,23,132,0)&&c.poiDavidTempleTunnelAt(site,23,132,0));
 a(c.poiDavidTempleEnclosedAt(site,24,142,0)&&!c.poiDavidTempleTunnelAt(site,24,142,0));
 a(!c.poiDavidTempleEnclosedAt(site,24,125,0));
});

test('old editor and prefab dome ID validates alongside unrelated stocked objects and still has real legacy geometry',()=>{
 const c=vm.createContext({MIN_MAP:12,MAX_MAP:128,MAX_LEVEL:8,TERRAIN_MAX:12,POI_SACRED_DEPTH_H:182,POI_SACRED_DEPTH_W:48,PINE_CHECK_COLORS:[],site,facilitySite:site,
  world:w,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<182&&(z<128||x<48),isWallId:()=>false,mesh:()=>({p:[],n:[],c:[]})});
 vm.runInContext(cut('const palette=[','const catalog=new Map(')+'const catalog=new Map(palette.map(p=>[p.id,p]));'+
  cut('function validModel(','function displayJSON(')+cut('function facilityExportMap(','function facilityDownload(')+
  cut('function tri(m,a,b,c,col){','function addPart(')+cut('// BEGIN ROUND DAVID TEMPLE ART','// END ROUND DAVID TEMPLE ART')+
  ';globalThis.validation=m=>{const f=facilityExportMap(m);return {...pineValidateWorldData(f),world:f.world,offset:f.workshopFacility.floorOffset}};',c);
 const roof={x:24,z:104,y:2,type:'poiDavidDome',rot:0},m=c.mesh();
 const prefab={id:'prefab-old-dome',name:'旧ドーム',w:1,h:1,tiles:[{x:0,z:0,y:2,type:roof.type,rot:0}]};
 const previous=Object.assign({},site.map,{world:[...site.map.world,roof],prefabs:[prefab]});
 const imported=c.validation(previous);
 a.equal(imported.newW,128);a(imported.world.some(o=>o.type===roof.type&&o.y===2+imported.offset));
 a(imported.world.some(o=>o.type==='monsterStoneDavid'&&o.x===24&&o.z===158));
 a.equal(imported.blocks[0].tiles[0].type,roof.type);
 c.poiDavidDomeGeometry(m,24.5,104.5);a(m.p.length/3>2000&&m.p.length/3<3200);
});
