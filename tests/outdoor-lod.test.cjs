const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function load(){
 const a=h.indexOf('// BEGIN OUTDOOR GEOGRAPHY LOD'),b=h.indexOf('// END OUTDOOR GEOGRAPHY LOD',a);
 assert(a>=0&&b>a,'production shared outdoor geographic draw policy exists');
 const c=vm.createContext({Math,Map,Set,facilityParams:{get:()=>null},poiOverlandGlobal:(id,x,z)=>id==='base'?[x,z]:[x+48,z+139],
  poiOverlandLocal:(id,x,z)=>id==='base'?[x,z]:[x-48,z-139],
  poiSacredInteriorGrade:(_,x,z,t)=>x===7&&z===3?'grass':t,poiSacredTempleVisualMember:(_,o)=>o.type.startsWith('poiDavid'),
  poiSnowGroundEdgeTint:(_,x,z,t,c)=>c,TERRAIN_STEP:1,
  mesh:()=>({p:[],n:[],c:[]}),quad:(m,a,b,c,d,k)=>{for(const p of [a,b,c,a,c,d])m.p.push(...p)},
  tri:(m,a,b,c,k)=>m.p.push(...a,...b,...c)});
 vm.runInContext(h.slice(a,b),c);
 return c;
}
test('one real authored floor authority keeps sparse padding out, preserves same-height snow and hides arena floor type',()=>{
 const g=load(),q={i:0,j:0,x0:0,x1:8,z0:0,z1:8};
 const spec={id:'base',layout:{},owns:(x,z)=>(z===2&&x>=2&&x<5)||(z===3&&x===7),
  terrain:new Map([['2,2',1],['3,2',1],['4,2',2]]),index:{floors:new Map([['7,3','roadRoyalFull']])}};
 const runs=g.poiOutdoorGroundRuns(q,spec);
 assert.deepEqual(JSON.parse(JSON.stringify(runs)),[[2,4,2,1,'grass'],[4,5,2,2,'grass'],[7,8,3,0,'grass']]);
 const snow={id:'snowpass',layout:{},terrain:new Map(),index:{floors:new Map([['1,2','roadGravelFull']])},owns:(x,z)=>z===2&&x<=1};
 assert.deepEqual(JSON.parse(JSON.stringify(g.poiOutdoorGroundRuns(q,snow))),[[0,1,2,0,'poiSnowGround'],[1,2,2,0,'roadGravelFull']]);
});
test('only authentic canopy and approved landmarks can enter distant geometry',()=>{
 const c=load(),at=(type,y=0)=>c.poiOutdoorLandmark({layout:{},owns:()=>true},{x:1,z:2,y,type});
 assert(at('treePine')&&at('treeCedar')&&at('poiFortGate')&&at('rockMossy'));
 for(const t of ['monsterStoneDavid','npcGuild','poiDavidSacredRoof','poiDavidTunnelRoof','poiDavidWallRound','healingHerb','roadRoyalFull'])assert(!at(t),t);
 assert(!at('treePine',-1));
});
