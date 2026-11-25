const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]??'world-editor.html','utf8');
const cut=(s,e)=>{const i=h.indexOf(s),j=h.indexOf(e,i+1);a(i>=0&&j>i,s);return h.slice(i,j)};
function runtime(){
 const c=vm.createContext({poiOverlandIndexCache:new WeakMap(),poiOverlandMeshes:new Map(),facilityIsRoofPiece:()=>false,SIGN_TYPES:[],RESIDENTIAL_ROOFS:new Set(),BRIDGE_IDS:new Set(),
  wallExteriorLookup:()=>new Map(),poiSacredGroundLights:()=>({blockers:new Map(),lamps:[]}),poiSacredInteriorSconce:()=>false,poiTownNpcKey:(...v)=>v.join(','),residentialRoofComponents:()=>[],
  isFloor:t=>/^(grass|poiSnowGround)$/.test(t),poiSacredInteriorGrade:(_a,_x,_z,t)=>t,poiSnowGroundEdgeTint:()=>null,
  ROAD_DIAGONALS:new Set(),ROAD_IDS:new Set(),PINE_EAST_NATURE_TONES:{},TERRAIN_STEP:.2,shoreline:()=>{},pineBakeFloorLighting:()=>{},terrainSide:()=>{},
  poiOverlandEngaged:false,POI_OVERLAND_GPU_LIMIT:4194304,poiOverlandStats:{builds:0},upload:m=>({buf:{},count:m.p.length/3})});
 vm.runInContext(cut('const POI_OVERLAND_ORIGINS=','// END OVERLAND STREAM PLANNING')+
  h.match(/^const POI_SNOW_PASS=.*$/m)[0]+cut('const POI_SQUARE_FIELD_SIDE=','// END SQUARE FIELD')+
  cut('const POI_OVERLAND_PATCHES=','// END SPARSE OVERLAND SQUARE')+
  cut('function poiOverlandSpecFor(','function poiOverlandAreas(')+
  cut('function* poiOverlandChunkRows(','function poiOverlandBakeFrame(')+
  cut('function poiCompactPriority(','function poiSeamRoleSources(')+`
  const mesh=()=>({p:[]}),addFloorTile=m=>m.p.push(0,0,0),shiftMesh=(m,t)=>m.p.push(...t.p);
  const shape=(id,width,height)=>({id,davidTemple:{depth:1},map:{world:[],width,height}});
  const home=shape('base',128,182),snow=shape('snowpass',24,29);
  const facilitySite=home;
  const spec=p=>poiOverlandSpecFor(p.id,p,p.map.world,p.map.width,p.map.height);
  const maps=[spec(home),spec(snow)],owner=maps.map((p,i)=>({...p,world:(i?snow:home).map.world}));
  const make=(key,x,z)=>{
   const q=poiOverlandQueue(maps,x,z).find(q=>q.key===key),a=maps.find(a=>a.id===q.id);
   const g=poiOverlandChunkRows(q,a);let r;
   do{r=g.next()}while(!r.done);return poiOverlandUpload(q,r.value);
  };
  const result=(id,x,z)=>[...poiCompactGuaranteed(maps,id,[x,z],owner)].sort();
 `,c);
 return c;
}
test('unmodified real overland spec construction + ground emitter carries identity to actual GPU admission',()=>{
 const c=runtime(),run=s=>JSON.parse(JSON.stringify(vm.runInContext(s,c)));
 a.deepEqual(run('maps.map((p,i)=>p.sourceWorld===owner[i].world)'),[true,true]);
 a.equal(run('spec(home)===maps[0]'),true);
 a.deepEqual(run("make('base:7,17',60,138);make('snowpass:1,0',60,138);result('base',60,138)"),['base:7,17','snowpass:1,0']);
 a.deepEqual(run("result('snowpass',60,139)"),['base:7,17','snowpass:1,0']);
 a.deepEqual(run("poiOverlandMeshes.get('base:7,17').groundRows[0]=254;result('snowpass',60,139)"),['snowpass:1,0']);
 a.deepEqual(run("owner[1].world=[];result('base',60,138)"),[]);
});
