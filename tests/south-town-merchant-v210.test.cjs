const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const built=fs.readFileSync(process.env.LAYOUT_HTML||(fs.existsSync('../layout/world-editor.html')?'../layout/world-editor.html':'world-editor.html'),'utf8');
const sl=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i+1);assert.ok(i>=0&&j>i,a);return s.slice(i,j)};
const build=vm.runInNewContext(sl(built,'const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
function fixture(){
 const site=Object.assign(build('base'),{id:'base'}),c={facilitySite:site,POI_SAFE_TOWN:[],POI_WILD_GATES:[],POI_WILD_LANDMARKS:[],validPos:()=>true,poiWildZone:()=>false,poiDungeonThemeAt:()=>null,
  poiWalkLevel:0,poiWalkX:101,poiWalkZ:112,facilityFloorOwner:()=>null,world:site.map.world};
 vm.createContext(c);
 vm.runInContext(sl(h,'function poiRegionAt(','const poiMiniStatic=')+sl(h,'function poiAudioMusicZone(','function poiAudioTownRegionMusic(')+sl(h,'function poiWildExterior(','function poiWildActive('),c);
 const start=h.includes('const POI_SOUTH_MERCHANT_ID=')?'const POI_SOUTH_MERCHANT_ID=':'const POI_TOWN_RESIDENT_ROLES=Object.freeze(';
 vm.runInContext(sl(h,start,'const POI_TOWN_INN='),c);return c;
}
test('actual south market keeper has authored counter stands, room and real sleeping bed',()=>{
 const c=fixture(),r=c.poiSouthMarketRole();
 assert.equal(r.id,'southmerchant');assert.equal(r.role,'keeper');assert.equal(r.type,'humanMerchant');
 assert.deepEqual([r.work.x,r.work.z,r.public.x,r.public.z],[99,112,101,112]);
 assert.deepEqual([r.home.x,r.home.z,r.sleepStand.x,r.sleepStand.z,r.bed.x,r.bed.z],[115,117,114,117,114,118]);
 assert(c.world.some(o=>o.y===0&&o.x===100&&o.z===112&&o.type==='counterWood'&&o.rot%2===1));
 assert(c.world.some(o=>o.y===0&&o.x===114&&o.z===118&&o.type==='bed'));
 c.facilitySite={id:'standalone'};assert.equal(c.poiSouthMarketRole(),null);
});
test('only the authored settlement is safe and uses its market music; named road keeps danger/music',()=>{
 const c=fixture();
 assert.equal(c.poiRegionAt(c.facilitySite,101,112,false,0).name,'街道の宿場');
 assert.equal(c.poiRegionAt(c.facilitySite,101,112,false,0).difficulty,0);
 assert.equal(c.poiRegionAt(c.facilitySite,101,112,false,-1).difficulty,1);
 assert.equal(c.poiAudioMusicZone(),'market');assert.equal(c.poiWildExterior(101,112),false);
 c.poiWalkX=105;c.poiWalkZ=100;assert.equal(c.poiAudioMusicZone(),'outside');assert.equal(c.poiWildExterior(105,100),true);
 c.poiWalkX=101;c.poiWalkZ=112;c.poiWalkLevel=-1;assert.equal(c.poiAudioMusicZone(),'outside');
});
test('legitimate merchant uses existing private-trade role and stock codec without changing old keys',()=>{
 const c=fixture(),role=c.poiSouthMarketRole();
 const actor={...role.work,role,activity:'work'};
 Object.assign(c,{poiTownNpcActors:[actor],poiTownNpcActive:()=>true,poiTownClockSnapshot:()=>({day:2})});
 vm.runInContext(sl(h,'const POI_NPC_TRADE_BASE_PRICES=','function poiNpcTradeOffer('),c);
 assert(c.poiNpcTradeEligible(actor));
 assert.equal(c.poiNpcTradeState({},actor).stock.healingHerb,2);
 const decoded=c.poiNpcTradeDecode({version:1,day:2,actors:{southmerchant:{healingHerb:1,cannedFood:0},toolkeeper:{healingHerb:2,cannedFood:1},impostor:{healingHerb:3,cannedFood:0}}});
 assert.equal(decoded.actors.southmerchant.healingHerb,1);
 assert.equal(decoded.actors.toolkeeper.cannedFood,1);
 assert.equal(decoded.actors.impostor,undefined);
 c.poiWalkX=102;assert.equal(c.poiNpcTradeEligible(actor),false);
});
test('keeper can physically walk from shop across the street to his own bed stand',()=>{
 const c=fixture(),r=c.poiSouthMarketRole(),m=c.facilitySite.map;
 Object.assign(c,{MAP_W:m.w||128,MAP_H:m.h||128,facilityCreekIndex:null,terrainPassable:()=>true,
  isFloor:t=>/^(?:grass|earth|road|stone$|brickfloor|woodfloor)/.test(t),isWallId:t=>/wall/i.test(t),
  poiWalkPassableDoor:t=>/(?:Door|DoorOpen|Entrance)$/.test(t)});
 vm.runInContext(sl(h,'const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed('),c);
 const route=c.poiTownFindPath(r.work,r.sleepStand);
 assert.ok(route?.length>10);assert.equal(route.at(-1).x,114);assert.equal(route.at(-1).z,117);
 assert(route.some(p=>p.x===102&&p.z===112));assert(route.some(p=>p.x===108&&p.z===116));
});
