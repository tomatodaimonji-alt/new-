const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.argv[2]||'world-editor.html','utf8');
function region(start,end){const x=html.indexOf(start),y=html.indexOf(end,x);a(x>=0&&y>x);return html.slice(x,y);}
function runtime(){
 const role={id:'resadventurer',role:'adventurer',home:{x:1,z:2,y:0},public:{x:3,z:4,y:0}};
 const c=vm.createContext({poiTownNpcActors:[],poiTownNpcBook:null,poiTownNpcNext:0,poiTownNpcNav:null,poiTownNpcVersion:0,
  poiTownNpcMesh:null,poiTownNpcMeshKey:'',poiTownDialogueClose(){},poiTownAmbientClose(){},poiTownNpcRelease(){},
  POI_TOWN_RESIDENT_ROLES:[role],POI_TOWN_INN_BEDS:[],POI_TOWN_WAKE:360,POI_TOWN_CLOSE:1020,POI_TOWN_RESIDENT_HP:100,
  poiTownNpcLoadout:()=>({weapon:'stock',gear:{}}),poiTownNpcStance:()=>true,
  clock:{minute:600,absoluteMinute:600}});
 const additions=html.includes('// BEGIN TOWN ADVENTURER MEMORY')?region('// BEGIN TOWN ADVENTURER MEMORY','// END TOWN ADVENTURER MEMORY'):'';
 vm.runInContext(additions+region('function poiTownResidentsReset','function poiTownNpcLightInvalidate')+
  region('function poiTownNpcInit','function poiTownNpcBedOwner'),c);
 return c;
}
test('completed personal outcome survives two warm regional resets, not live combat or the player booking',()=>{
 const c=runtime();
 const value=vm.runInContext(`poiTownNpcInit(clock);const old=poiTownNpcActors[0];
  Object.assign(old,{hp:35,coins:9,potions:1,target:{live:true},actorLeg:{live:true}});poiTownNpcBook={bedId:'player'};
  poiTownResidentsReset(true);poiTownResidentsReset(true);poiTownNpcInit(clock);
  const fresh=poiTownNpcActors[0];
  [fresh.hp,fresh.coins,fresh.potions,Boolean(fresh.target),Boolean(fresh.actorLeg),poiTownNpcBook,fresh===old]`,c);
 a.deepEqual(Array.from(value),[35,9,1,false,false,null,false]);
});
test('normal gameplay reset drops transient adventure memory',()=>{
 const c=runtime();const value=vm.runInContext(`poiTownNpcInit(clock);poiTownNpcActors[0].coins=9;
  poiTownResidentsReset(true);poiTownResidentsReset();poiTownNpcInit(clock);poiTownNpcActors[0].coins`,c);
 a.equal(value,0);
});
test('the real seamless activation preserves only warm trips and cold start does not',()=>{
 a.match(region('function poiSnowPassApply','function poiSnowPassVeil'),/poiWalkFrameNoRegionRemote\(!cold\)/);
 a.match(region('function poiWalkFrameNoRegionRemote','function poiSnowPassChange'),/poiTownResidentsReset\(keepTownProgress\)/);
});
