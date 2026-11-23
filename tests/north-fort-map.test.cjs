const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const pick=(l,r)=>{const i=h.indexOf(l),j=h.indexOf(r,i+1);a(i>=0&&j>i,l);return h.slice(i,j)};
const site=vm.runInNewContext(pick('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
site.id='base';
const has=(x,z,y,t)=>site.map.world.some(o=>o.x===x&&o.z===z&&o.y===y&&(!t||o.type===t));
const cells=(x,z,y)=>site.map.world.filter(o=>o.x===x&&o.z===z&&o.y===y).map(o=>o.type);
const equal=(actual,expected)=>a.equal(JSON.stringify(actual),JSON.stringify(expected));
test('north approach uses new adjacent terrain, clear scout camp slots, and a stone gate at the existing boundary',()=>{
 const f=site.northFort;a.ok(f,'north fort absent');
 a.equal(site.map.width,128);a.equal(site.map.height,128);
 a.equal(f.name,'北の古砦');a.equal(f.difficulty,5);
 const path=f.approach;a.ok(path.length>=12);
 equal(path[0],{x:66,z:4,y:0});equal(path.at(-1),f.entrance);
 for(let i=1;i<path.length;i++){
  const {x,z,y}=path[i],p=path[i-1];a.equal(Math.abs(x-p.x)+Math.abs(z-p.z),1);
  a.equal(y,0);a.ok(cells(x,z,y).some(t=>/^(road|grassTrampled|earth)/.test(t)));
  a.ok(cells(x,z,y).every(t=>/^(road|grassTrampled|earth|poiFortGate)/.test(t)),[x,z]);
 }
 equal(site.northTrail.scoutCamp.stand,{x:67,z:2,y:0});
 a.ok(cells(67,2,0).every(t=>t==='grassTrampled'));
 a.equal(f.entrance.z,0);a.equal(f.surfaceStand.z,1);
 a.ok(has(f.entrance.x,f.entrance.z,0,'poiFortGate'));
});
test('the standalone B1 chamber has only the authored boss, clear dodge terrain, a connected return and region rank',()=>{
 const f=site.northFort;a.ok(f,'north fort absent');
 const {bounds:b,boss:p,entrance,exit,surfaceStand,dungeonStand}=f;
 const local=site.map.world.filter(o=>o.y===b.y&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2);
 const monsters=local.filter(o=>o.type.startsWith('monster'));a.equal(monsters.length,1);
 equal([monsters[0].type,monsters[0].x,monsters[0].z,monsters[0].y],['monsterNorthMinotaur',64,13,-1]);
 for(let z=p.room.minZ;z<=p.room.maxZ;z++)for(let x=p.room.minX;x<=p.room.maxX;x++)
  a.ok(cells(x,z,-1).some(t=>/^(stone|road)/.test(t))&&cells(x,z,-1).every(t=>/^(stone$|road|monsterNorthMinotaur)/.test(t)),[x,z]);
 for(let z=19;z<=24;z++)a.ok(has(64,z,-1)&&cells(64,z,-1).every(t=>/^(stone|road)/.test(t)),z);
 const c=vm.createContext({site,facilitySite:site});
 vm.runInContext(pick('function poiDungeonPointIn(','// Keep the B1')+
 pick('function poiOtherworldPortalAt(','function poiOtherworldUseStep(')+
 pick('function poiDungeonThemeAt(','function poiDungeonEnterEffect(')+
 pick('const POI_SAFE_TOWN=','// BEGIN LOCATION PANEL MOTION')+
 pick('const POI_DUNGEON_COOLDOWN=','function poiDungeonPopulationMinute(')+
 pick('function poiDungeonSpawnId(','function poiDungeonActorAbsent('),c);
 a.equal(c.poiDungeonTravelKey(site,p.x,p.z,p.y),'northFort');
 a.equal(c.poiDungeonTravelKey(site,116,61,-1),null);
 a.equal(c.poiDungeonThemeAt(site,dungeonStand.x,dungeonStand.z,-1),'northFort');
 equal(c.poiRegionAt(site,p.x,p.z,false,-1),{name:f.name,difficulty:5,stars:'★★★★★☆☆☆☆☆'});
 const arrive=c.poiOtherworldPortalAt(site,entrance.x,entrance.z,0),leave=c.poiOtherworldPortalAt(site,exit.x,exit.z,-1);
 a.ok(c.poiOtherworldTraversal(arrive,surfaceStand.x,surfaceStand.z,0));a.equal(arrive.to,dungeonStand);
 a.ok(c.poiOtherworldTraversal(leave,dungeonStand.x,dungeonStand.z,-1));a.equal(leave.to,surfaceStand);
 a.ok(!c.poiOtherworldTraversal(arrive,surfaceStand.x+1,surfaceStand.z,0));
 a.equal(c.poiDungeonSpawnId(monsters[0]),'northFort.minotaur');
});
