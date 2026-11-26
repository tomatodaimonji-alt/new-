const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(process.env.WORKSHOP_HTML||'candidate.html','utf8');
const cut=(x,y)=>{const i=html.indexOf(x),j=html.indexOf(y,i+x.length);a(i>=0&&j>i,x);return html.slice(i,j)};
const source=cut('const POI_ACTOR_STAT_ROLES=', 'function poiAttackGrade(')+cut('function poiCompanionSpeed(a){','function poiCompanionFollowWanted(');
function rig(){
 const humans={h:'frontierren'};
 const c=vm.createContext({POI_HUMAN_WALK_RATE:.8,POI_HUMAN_PARTY_IDS:humans,POI_MONSTER_FREE_TICK:380,POI_WALK_MS:175/.8,poiWalkX:0,poiWalkZ:0,poiFreePose:null,
  kit:{weapon:null,gear:{}},npc:{role:{id:'frontierren',role:'adventurer'},gear:{}},poiArmorWorn:k=>k.gear,
  poiHotbarRead:()=>c.kit,poiTownNpcLoadout:a=>({weapon:a.weapon,gear:a.gear}),poiCompanionType:id=>id==='slime'?{enemy:'monsterSlime'}:id==='goblin'?{enemy:'monsterGoblin'}:null,
  poiHumanPartySpec:id=>id==='h'?vm.runInContext('poiTownAttributes(npc)',c):null,frontierResident:id=>id==='frontierren',
  frontierFollowStyle:()=>({pace:1}),frontierSmooth:(l,h,x)=>Math.max(0,Math.min(1,(x-l)/(h-l)))});
 vm.runInContext(source,c);
 return q=>JSON.parse(JSON.stringify(vm.runInContext(q,c)));
}
test('human baseline all known roles grade 1 with preserved intelligence; leather only grants real grade 2',()=>{
 const r=rig();
 a.deepEqual(r("['frontierren','frontiersera','frontierchief','frontiershopkeeper'].map(id=>poiStatBase({id}))"),[2,3,5,4].map(intelligence=>({speed:1,intelligence})));
 a.deepEqual(r("['adventurer','visitor','watch','keeper','scout'].map(role=>poiStatBase({role}))"),[6,5,6,6,7].map(intelligence=>({speed:1,intelligence})));
 a.deepEqual(r('poiPlayerAttributes()'),{speed:1,intelligence:5});
 a.deepEqual(r("kit.gear={head:'armorValdiaCrown',torso:'armorIronTorso',feet:'armorLeatherShoes'};kit.weapon='equipOrvasTwinGreatswords';poiPlayerAttributes()"),{speed:2,intelligence:6});
 a.deepEqual(r("kit.gear={torso:'armorScoutMantle',feet:'starterBoots'};kit.weapon=null;poiPlayerAttributes()"),{speed:1,intelligence:5});
 a.deepEqual(r("npc.gear={feet:'armorLeatherShoes'};poiPartyAttributes({id:'h'})"),{speed:2,intelligence:2});
});
test('human mobility retains v407 .8 baseline with +6.5% actual leather pace, monster and Orvas rates unchanged',()=>{
 const r=rig(),eq=(real,want)=>a(Math.abs(real-want)<1e-12,JSON.stringify({real,want}));
 eq(r('poiCompanionSpeed({id:"h"})'),.8/380);
 eq(r('npc.gear={feet:"armorLeatherShoes"};poiCompanionSpeed({id:"h"})'),.8*1.065/380);
 eq(r('poiCompanionSpeed({id:"slime"})'),1/380);
 eq(r('poiCompanionSpeed({id:"goblin"})'),1.13/380);
 eq(r('poiCompanionSpeed({id:"orvasSoul"})'),1/235);
 eq(r('frontierFollowSpeed({id:"h",freeFollows:true,x:2,z:0})'),.66*1.065/(175/.8));
 eq(r('frontierFollowSpeed({id:"h",freeFollows:true,x:6,z:0})'),1/(175/.8));
 for(const marker of ['function poiTownNpcPace(a){','poiWalkStepMs=(typeof poiChapelStepMs','const pace=elapsed*direction.power*']) {
  const i=html.indexOf(marker);a(i>=0);a(html.slice(i,html.indexOf('\n',i)).includes('poiHumanMovementFactor('),marker);
 }
});
