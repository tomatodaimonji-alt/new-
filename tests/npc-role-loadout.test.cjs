const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.QA_HTML||'world-editor.html','utf8');
const slice=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+1);assert.ok(i>=0&&j>i);return h.slice(i,j)};
const build=vm.runInNewContext(slice('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
function load(){
 const c={POI_TOWN_RESIDENT_HP:100,POI_TOWN_RESIDENT_MELEE:13,poiTownNpcDisplayName:r=>r.name,poiArmorDefense:t=>t==='armorMerchantCoat'?2:0,poiPlayerAttackDamage:t=>({'equipWoodSword':28,equipBallpointPen:21,equipFryingPan:25}[t]??20)};
 vm.createContext(c);vm.runInContext(slice('const POI_TOWN_RESIDENT_ROLES=Object.freeze(','const POI_TOWN_INN=')+slice('function poiTownNpcStatus(','function poiNpcStatusView('),c);return c;
}
test('genuine work gear and read-only status use same role kit; adventurer retains baseline melee',()=>{
 const c=load(),roster=vm.runInContext('POI_TOWN_RESIDENT_ROLES',c);
 const status=id=>c.poiTownNpcStatus({role:roster.find(r=>r.id===id),hp:28,coins:3,potions:1});
 assert.equal(status('guildkeeper').weapon,'equipBallpointPen');assert.equal(status('guildkeeper').gear.torso,'armorGuildUniform');
 assert.equal(status('toolkeeper').gear.torso,'armorMerchantCoat');assert.equal(status('toolkeeper').defense,2);
 assert.equal(status('resadventurer').attack,13);assert.equal(status('resadventurer').hp,28);
 assert.equal(status('towncook').weapon,'equipFryingPan');assert.equal(status('towncook').gear.head,'armorCookHat');
 assert.equal(status('towncook').gear.torso,'armorCookApron');assert.equal(status('towncook').tools[0],'equipLadle');
});
test('cook has own stable daytime ID, exact safe workplace beside real stove, and an offsite route origin',()=>{
 const c=load(),role=vm.runInContext("POI_TOWN_RESIDENT_ROLES.find(r=>r.id==='towncook')",c),s=build('base');
 assert.ok(role);assert(role.name);assert.equal(role.role,'visitor');assert(role.arrives<480&&role.leaves>17*60);
 assert.deepEqual([role.work.x,role.work.z,role.work.y],[26,42,0]);
 assert(s.map.world.some(o=>o.x===25&&o.z===42&&o.y===0&&o.type==='kitchenStove'));
 assert.deepEqual(Array.from(s.map.world.filter(o=>o.x===26&&o.z===42&&o.y===0).map(o=>o.type)),['brickfloor']);
 assert.notDeepEqual(role.home,role.work);assert.equal(role.home.y,0);
});
test('cook reaches work through real walkable cells and never claims a guest bed',()=>{
 const c=load(),s=build('base'),role=vm.runInContext("POI_TOWN_RESIDENT_ROLES.find(r=>r.id==='towncook')",c);
 Object.assign(c,{world:s.map.world,MAP_W:s.map.w||128,MAP_H:s.map.h||96,facilitySite:s,facilityCreekIndex:null,
  terrainPassable:()=>true,isFloor:t=>/^(?:grass|earth|dirt|road|water|woodfloor|brickfloor|stone$|moss$)/.test(t),
  isWallId:t=>/wall/i.test(t),poiWalkPassableDoor:t=>t==='door'||t==='poiFortGate'||/(?:Door|DoorOpen|Entrance)$/.test(t)});
 vm.runInContext(slice('const POI_TOWN_WALK_DECOR=','function poiTownNpcExistsBed('),c);
 const route=c.poiTownFindPath(role.home,role.work);
 assert.ok(route?.length>10);assert.equal(route.at(-1).x,role.work.x);assert.equal(route.at(-1).z,role.work.z);
 assert.ok(c.poiTownFindPath(role.work,role.public)?.length);
 assert.equal(role.bed,undefined);
});
