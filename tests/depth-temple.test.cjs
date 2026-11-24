const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const i=h.indexOf('function extendTownWorldDavidTemple('),j=h.indexOf('// END DAVID TEMPLE MAP',i);
const c=vm.createContext({});
const gen=vm.runInContext(h.slice(i,j)+';extendTownWorldDavidTemple',c);
function boot(){const site={id:'base',map:{width:128,height:182,world:[],terrainHeights:[]},buildings:[]};site.davidTemple=gen(site);c.facilitySite=site;return {site,d:site.davidTemple};}
test('three-cell covered external straight tunnel joins actual giant dome and far centered encounter',()=>{
 const {site,d}=boot(),w=site.map.world,at=(x,z,type,y=0)=>w.some(p=>p.x===x&&p.z===z&&p.type===type&&p.y===y);
 const wall=(x,z)=>w.some(p=>p.y===0&&p.x===x&&p.z===z&&/^poiDavid(?:Wall|GatePier)/.test(p.type));
 a.deepEqual([d.ring.x,d.ring.z,d.ring.radius],[24,158,18]);
 a.deepEqual([d.boss.x,d.boss.z],[24,158]);a(d.boss.z-d.interior.exitZ>=15);
 a(d.ring.z-d.ring.radius-d.entrance.z>=10);
 a.deepEqual([d.entrance.x,d.entrance.z,d.retreat.z],[24,128,125]);
 for(let z=128;z<142;z++){
  a(wall(22,z)&&wall(26,z));for(let x=23;x<=25;x++){a(!wall(x,z));a(at(x,z,'poiDavidTunnelRoof',2));a(d.enclosure.has(x+','+z));a(!d.boss.room.arena.cells.has(x+','+z))}
 }
 a(d.boss.room.arena.cells.has('24,142'));a(d.boss.room.arena.cells.has('24,158'));
 a(w.every(o=>o.x<48&&o.z<182));a(at(24,158,'poiDavidSacredRoof',2));a(w.filter(o=>o.type==='poiDavidCandleSconce').length>=10);
});
test('legacy temple resume moves once to open forecourt but woodland, subterranean and newly written coordinates do not migrate',()=>{
 const {site,d}=boot(),m=vm.runInContext('poiDavidTempleMigrateResume',c),p={x:24,z:104,y:0,facing:2};
 a.deepEqual({...m({},p)},{x:24,z:125,y:0,facing:2});
 a.equal(m({templeDepth:1},p),p);
 const off={...p,y:-1};a.equal(m({},off),off);
 const forest={...p,x:15,z:86};a.equal(m({},forest),forest);
 a.equal(d.retreat.z,d.entrance.z-3);
});
test('only the named far dome is withheld from ordinary far ground view; near visibility and plan are unchanged',()=>{
 const first=h.indexOf('function facilityVisibleRoofs('),end=h.indexOf('function facilityCollectEntranceGuides(',first);
 const {site}=boot(),ctx={facilitySite:site,facilityRoofMeshes:[{count:8}],facilityHiddenRoof:()=>0,poiWalkActive:true,
  poiWalkLevel:0,cameraTopDown:false,poiWalkViewX:24,poiWalkViewZ:49};
 const r=vm.runInNewContext(h.slice(first,end)+';facilityVisibleRoofs',ctx);
 a.equal(r().length,0);ctx.cameraTopDown=true;a.deepEqual(Array.from(r()),[0]);
 ctx.cameraTopDown=false;ctx.poiWalkViewZ=120;a.deepEqual(Array.from(r()),[0]);
 ctx.poiWalkViewZ=151;a.deepEqual(Array.from(r()),[0]);
});
test('new deep ground item and gold save coordinates are scoped to the base extension',()=>{
 const i=h.indexOf('function poiDavidDepthGroundPoint('),j=h.indexOf('function poiInventoryReadDrops(',i);
 a(i>0&&j>i);const fn=vm.runInNewContext(h.slice(i,j)+';poiDavidDepthGroundPoint');
 a(fn({x:24,z:158,y:0}));a(fn({x:47,z:181,y:0}));
 for(const p of [{x:48,z:149,y:0},{x:24,z:182,y:0},{x:24,z:159,y:-1},{x:24,z:159,y:1},{x:24,z:159,y:0,region:'snowpass'},null])a.equal(fn(p),false);
});
test('old exact stable Orvas drop ids rehydrate beside new center rather than disappearing or duplicating',()=>{
 const i=h.indexOf('const POI_ORVAS_REWARDS='),j=h.indexOf('function poiOrvasRewardOwned(',i);
 if(i<0)return;
 const get=vm.runInNewContext(h.slice(i,j)+';poiOrvasRewardValid');
 const old={id:'orvas-head',type:'equipOrvasHead',x:24,z:103,y:0};
 a.equal(get(old).z,157);
 a.equal(get({...old,z:157}).z,157);
 a.equal(get({...old,z:104}),null);
});
