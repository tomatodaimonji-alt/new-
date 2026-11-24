const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)+a.length));
test('a hidden Orvas wall cannot bake its circular outline into exterior floor lighting',()=>{
 const area={id:'base',davidTemple:{depth:1,bounds:{x1:6,x2:42,z1:124,z2:176}}};
 const ctx=vm.createContext({isFloor:()=>false,PINE_WARM_TYPES:new Set(),RESIDENTIAL_ROOFS:new Set(),AUTO_ROOFS:new Set(),isWallId:()=>false,pineBaseTreeProfile:()=>({w:1}),pineWarmNear:()=>[]});
 const helper=source.includes('function poiSacredGroundLights(')?cut('function poiSacredGroundLights(','function poiSacredInteriorGrade('):'function poiSacredGroundLights(site,list,playing){return pineFloorLightingSources(list)}';
 vm.runInContext(cut('function pineBakeFloorLighting(','// v102:')+cut('function poiSacredTempleVisualMember(','function poiSacredTempleVisibleAmount(')+helper,ctx);
 const wall={x:24,z:176,y:0,type:'poiDavidWallRound'},ordinary={x:31,z:176,y:0,type:'stoneWall'};
 const bake=(lights,x)=>{const m={p:[x+.5,0,176.5],c:[.43,.56,.37]};ctx.pineBakeFloorLighting(m,x,176,0,lights.blockers,lights.lamps);return m.c};
 const ground=ctx.poiSacredGroundLights(area,[wall,ordinary],true);
 a.deepEqual(bake(ground,24),[.43,.56,.37],'hidden circular wall should leave no color footprint on grass');
 a(bake(ground,31)[1]<.56,'ordinary contact shadows remain intact');
 a(bake(ctx.poiSacredGroundLights(area,[wall],false),24)[1]<.56,'editor still shows actual architectural contact');
 a(bake(ctx.poiSacredGroundLights({...area,id:'custom'},[wall],true),24)[1]<.56,'unrelated scenes remain unchanged');
});
test('only the real northern approach, inside and inspector may reveal temple architecture',()=>{
 const c=vm.createContext({});
 vm.runInContext(cut('function poiDavidTempleEnclosedAt(','function poiDavidTempleTunnelAt(')+cut('function poiSacredTempleVisibleAmount(','function poiSacredTempleViewAmount('),c);
 const site={id:'base',davidTemple:{depth:1,entrance:{x:24,z:128},ring:{x:24,z:158,radius:18},interior:{exitZ:142},enclosure:new Set(['24,129','24,158'])}};
 const seen=(x,z,inspect=false)=>c.poiSacredTempleVisibleAmount(site,x,z,0,inspect);
 a.equal(seen(46,153),0,'outside on the west seam cannot reveal a side wall');
 a.equal(seen(48,158),0,'snow side cannot reveal the wall');
 a.equal(seen(24,182),0,'southern exterior is equally hidden');
 a.equal(seen(9,148),0,'no back way to reveal a concealed wall');
 a.equal(seen(24,111),0,'no long reveal before the approach');
 a(seen(24,121)>0&&seen(24,121)<1,'actual entrance fades in without snapping');
 a.equal(seen(24,127),1);
 a.equal(seen(24,129),1);a.equal(seen(24,158),1);
 a.equal(seen(48,158,true),1,'inspection sees authored structure');
});
test('sacred atmosphere wraps Base temple on four sides without relabelling Snow',()=>{
 const c=vm.createContext({});
 vm.runInContext(cut('function poiSacredForestOf(','function poiSacredForestKey(')+cut('function poiSacredFogStrength(','function poiSacredEdgeFog('),c);
 const f={coverage:[{x1:4,x2:44,z1:126,z2:141}],reveal:{x:24,z:125}};
 const site={id:'base',davidTemple:{depth:1,entrance:{x:24,z:128},ring:{x:24,z:158,radius:18},interior:{exitZ:142},enclosure:new Set(['24,158'])},sacredForest:f};
 const snow={...site,id:'snowpass'};
 for(const [x,z] of [[2,158],[46,153],[24,181],[24,139]]){
  a(c.poiSacredForestContains(site,x,z,0),`exterior sacred ${x},${z}`);
  if(z!==139)a(c.poiSacredFogStrength(site,x,z,0)>.3);
 }
 a(!c.poiSacredForestContains(snow,4,16,0));a.equal(c.poiSacredFogStrength(snow,10,16,0),0);
 a(!c.poiSacredForestContains(site,85,153,0));a(!c.poiSacredForestContains(site,46,153,1));
 a.equal(c.poiSacredFogStrength(site,24,127,0),0,'clear authentic entrance');
 a.equal(c.poiSacredFogStrength(site,24,158,0),0,'do not plume fog across true interior');
});
test('real eye aligns with both apertures before encounter and no off-axis view leaks',()=>{
 const c=vm.createContext({});
 const helper=source.includes('function poiSacredTunnelSight(')?cut('function poiSacredTunnelSight(','function poiSacredInteriorPlayer('):'function poiSacredTunnelSight(){return false}';
 vm.runInContext(helper,c);
 const site={id:'base',davidTemple:{depth:1,entrance:{x:24,z:128},ring:{x:24,z:158,radius:18},interior:{minX:23,maxX:25,exitZ:142}}};
 const visible=(eye,x=24,z=125,y=0)=>c.poiSacredTunnelSight(site,eye,x,z,y);
 a(visible([24.5,2,123]),'center line from porch can see the feet/torso through the true passage');
 a(!visible([33,2,123]),'actual east stone wall blocks even if player position is centered');
 a(!visible([24.5,15,123]),'cannot look down through the roof from above');
 a(!visible([24.5,2,145]),'cannot peek backwards from the chamber towards modeled boss');
 a(!visible([24.5,2,123],24,124,1));
 a(!visible([24.5,2,123],24,114,0),'cannot see structure while far along wooded path');
});
test('outdoor and interior lighting blend over actual fractional tunnel travel',()=>{
 const c=vm.createContext({});
 const helper=source.includes('function poiSacredTunnelLight(')?cut('function poiSacredTunnelLight(','function poiTownSceneLight('):'function poiSacredTunnelLight(site,x,z,y,outside){return z>=128?[.76,.65,.54]:outside}';
 vm.runInContext(helper,c);
 const temple={id:'base',davidTemple:{depth:1,entrance:{x:24,z:128},interior:{exitZ:142,minX:23,maxX:25},enclosure:new Set([...' '.repeat(31)].map((_,i)=>'24,'+(128+i)))}};
 const outside=[.54,.62,.77],f=(x,z)=>Array.from(c.poiSacredTunnelLight(temple,x,z,0,outside));
 a.deepEqual(f(24,127.49),outside);
 a.deepEqual(f(24,128),outside);
 a.deepEqual(f(45,133),outside,'distant grass is unaffected');
 for(let z=128;z<143;z+=.25)a(Math.max(...f(24,z+.25).map((n,i)=>Math.abs(n-f(24,z)[i])))<.04,`no lighting jump at ${z}`);
 a(Math.abs(f(24,136)[0]-.76)<.025);
});
