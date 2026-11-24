const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const build=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const site=build('base');
test('36-wide circular temple preserves the actual road and old center, with one real dome',()=>{
 const t=site.davidTemple;a.equal(t.dome?.radius,18);
 a.deepEqual([t.boss.x,t.boss.z,t.entrance.x,t.entrance.z],[24,104,24,94]);
 const old=site.map.world.slice(0,t.authored.index),tiles=site.map.world.slice(t.authored.index);
 a.equal(old.length,8984);a.equal(crypto.createHash('sha256').update(JSON.stringify(old)).digest('hex'),'15535689893b8a631827467885930d45d786e0d3b559b74d6a2544267d03439a');
 const w=tiles.filter(o=>o.type==='poiDavidWallRound'),k=o=>[o.x,o.z,o.y].join(',');
 const prior=new Set(old.map(k));a(tiles.every(o=>!prior.has(k(o))));
 a.equal(t.authored.count,tiles.length);a(tiles.length<=1250);
 a(w.length>90&&w.length<170);a(w.every(o=>Math.hypot(o.x-24,o.z-104)>16));a.equal(tiles.filter(o=>o.type==='poiDavidDome').length,1);
 for(const p of t.approach)a(!w.some(o=>k(o)===k(p)));
 a(old.some(o=>o.x===29&&o.z===88&&o.type==='grassTrampled'));
});
test('walk approach and old floor stay open; exact shell checkpoint recovers to neighboring gallery or exterior',()=>{
 const d=site.davidTemple,world=site.map.world;
 site.id='base';
 const wall=(x,z)=>world.some(o=>o.x===x&&o.z===z&&o.y===0&&/^poiDavid/.test(o.type)&&o.type!=='poiDavidDome');
 const c=vm.createContext({facilitySite:site,world,poiWalkLevel:0,poiWalkActive:true,poiMonsterAt:()=>null,
  poiIsMonster:t=>t==='monsterStoneDavid',pineSuperVehicleType:()=>false,isWallId:t=>t.includes('wall'),
  facilityCreekIndex:null,validPos:(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<128&&z<128,
  isFloor:t=>/^(?:road|grass|earth|stone$|woodfloor)/.test(t)});
 vm.runInContext(cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP')+
  cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+cut('function poiWalkCanStep(','function poiFreeCenter(')+
  cut('function poiWildProtectedArea(','function poiWildNearResident('),c);
 for(const p of d.approach)a(c.poiWalkCanStep(p.x,p.z),'actual route '+JSON.stringify(p));
 for(let x=29;x<=35;x++)a(c.poiWalkCanStep(x,88),'old trail kept');
 a(c.poiWildProtectedArea(24,104));a(c.poiWildProtectedArea(24,91));a(!c.poiWildProtectedArea(46,104));
 for(let x=14;x<=33;x++)for(let z=95;z<=114;z++)
  a(c.poiWalkCanStep(x,z),'old arena stays walkable '+x+','+z);
 for(const o of world.filter(o=>o.type==='poiDavidWallRound')){
  a(!c.poiWalkCanStep(o.x,o.z));const p={x:o.x,z:o.z,y:0,facing:2},to=c.poiDavidTempleRecoverPosition(p);
  a.equal(Math.abs(to.x-p.x)+Math.abs(to.z-p.z),1);a.equal(to.facing,2);
  a(!wall(to.x,to.z));a(Math.hypot(to.x-24,to.z-104)>=15.95);
 }
 const p={x:24,z:97,y:0,facing:0};a.equal(c.poiDavidTempleRecoverPosition(p),p);
});
test('dome is a bounded real mesh with high clearance and native close-view keep/overhead cut',()=>{
 const c=vm.createContext({mesh:()=>({p:[],n:[],c:[]}),scene:{}});
 const perspective=h.slice(h.indexOf('function perspective('),h.indexOf('function ',h.indexOf('function perspective(')+9));
 vm.runInContext(cut('// BEGIN ROUND DAVID TEMPLE ART','// END ROUND DAVID TEMPLE ART')+
  cut('function tri(','function addPart(')+cut('// BEGIN DAVID TEMPLE MAP','// END DAVID TEMPLE MAP')+
  cut('function mult(a,b)','function draw(mesh,vp')+perspective,c);
 const m=c.mesh();c.poiDavidDomeGeometry(m,24.5,104.5);
 a(m.p.length/3>2000&&m.p.length/3<3200);
 const shell=[];for(let i=0;i<m.p.length;i+=3)shell.push(m.p.slice(i,i+3));
 a(shell.every(p=>p.every(Number.isFinite)&&p[1]>=7.61));
 a(Math.max(...shell.map(p=>p[1]))>=15.4);
 const vp=c.mult(c.perspective(Math.PI/3,1.8,.45,150),c.look([28,3,75],[24.5,9,104.5]));
 const visible=shell.filter(([x,y,z])=>{
  const cx=vp[0]*x+vp[4]*y+vp[8]*z+vp[12],cy=vp[1]*x+vp[5]*y+vp[9]*z+vp[13],w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];
  return Math.abs(cx)<w&&Math.abs(cy)<w;
 });a(visible.length>1400,'actual approach view shows arched geometry');
 a(c.poiDavidTempleKeepRoof(24,101,true,false,.25,5.5,0));
 a(!c.poiDavidTempleKeepRoof(24,101,true,true,.25,5.5,0));
 a(!c.poiDavidTempleKeepRoof(24,101,true,false,.80,9,0));
 a(!c.poiDavidTempleKeepRoof(24,92,true,false,.25,8,0),'camera physically outside eaves');
 a.match(h,/facilityObjectVisible[\s\S]*?poiWalkActive&&facilityIsRoofPiece\(o\)&&facilityRoofOwner\(o\)!==null\)return false/);
});
test('real catalog/import accepts both newly authored types and one ray cannot cross ring masonry',()=>{
 const c=vm.createContext({MIN_MAP:12,MAX_MAP:128,MAX_LEVEL:8,TERRAIN_MAX:12,PINE_CHECK_COLORS:[],site,facilitySite:site,
  world:site.map.world,validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<128,isWallId:()=>false});
 vm.runInContext(cut('const palette=[','const catalog=new Map(')+'const catalog=new Map(palette.map(p=>[p.id,p]));'+
  cut('function validModel(','function displayJSON(')+cut('function facilityExportMap(','function facilityDownload(')+
  cut('function poiWalkPassableDoor(','let facilityCreekIndex=')+cut('function poiPlayerRayClear(','function poiPlayerWeaponTrace(')+
  ';globalThis.validation=()=>pineValidateWorldData(facilityExportMap(site.map));globalThis.catalog=catalog;',c);
 for(const id of ['monsterStoneDavid','poiDavidGatePier','poiDavidTempleColumn','poiDavidWaystone','poiDavidDome','poiDavidWallRound'])a(c.catalog.has(id),id);
 a.equal(c.validation().newW,128);
 a.equal(c.poiPlayerRayClear(42,104,0,41,104),false);
 a.equal(c.poiPlayerRayClear(24,94,0,24,93),true);
});
