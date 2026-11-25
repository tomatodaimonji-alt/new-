const fs=require('node:fs'),a=require('node:assert/strict'),vm=require('node:vm'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML??'world-editor.html','utf8'),old=fs.readFileSync(process.env.BASELINE??'/workspace/shared/workshop-next-npc-scout-report/release.html','utf8');
const sec=(v,s,e)=>{const i=v.indexOf(s);a(i>=0,s);const j=v.indexOf(e,i+1);a(j>i,e);return v.slice(i,j)};
function setup(){
 const state={POI_OUTDOOR_FAR_PEAK:786432,POI_OVERLAND_GPU_LIMIT:4194304,
   POI_SQUARE_FIELD_SIDE:184,TERRAIN_STEP:.28,poiWalkLevel:0,poiWalkActive:true,facilitySurfaceEdited:false,cameraTopDown:false,pineAIActive:false,
   facilitySite:null,facilityVisibilityOwner:()=>null,poiDavidTempleEnclosedAt:()=>false,
   poiSquareFieldSite:()=>true,poiOverlandSnow:null,poiWalkViewX:54,poiWalkViewZ:119,
   poiOverlandCommands:[],poiOutdoorCaches:new Map(),poiOverlandGroundDrawn:new Map(),poiOutdoorFarBytes:0,
   poiOverlandLocal:(_r,x,z)=>[x,z],poiOverlandBoxVisible:()=>true,mesh:()=>({p:[]}),uploads:[],draws:[],drops:[],
   facilityStairOpenings:new Set(),poiOutdoorGroundTone:()=>[1,1,1],poiSacredInteriorGrade:(_a,_x,_z,t)=>t};
 state.gl={deleteBuffer:b=>state.drops.push(b)};
 state.upload=m=>{const gpu={buf:{},count:m.p.length/3};state.uploads.push(gpu);return gpu};
 state.draw=gpu=>state.draws.push(gpu);
 state.quad=(m,a,b,c,d)=>m.p.push(...a,...b,...c,...a,...c,...d);
 vm.createContext(state);
 vm.runInContext(sec(h,'const POI_ADD_GROUND_LIMIT=','function poiOutdoorLandmark(')+sec(h,'function poiOutdoorGroundRuns(','function poiOutdoorGroundTone('),state);
 const source={id:'base',layout:{},world:[],width:128,height:182,terrain:new Map(),owns:(x,z)=>x>=0&&x<184&&z>=0&&z<184,index:{floors:new Map()}};
 Object.assign(state,{facilitySite:source.layout,world:source.world});
 return {c:state,source,frame:(stream=true,near=0)=>state.poiAddGroundFrame([],stream,'base',[54,119],[source],near),amount:()=>vm.runInContext('poiAddGroundBytes',state)};
}
test('published original allocation order stays exact; little spare never evicts or changes existing authored records',()=>{
 const {c,frame,amount}=setup(),e={bytes:1500};c.poiOutdoorCaches.set('snowpass:0,0',e);
 c.poiOutdoorFarBytes=786432;frame();a.equal(c.uploads.length,0);a.equal(amount(),0);
 c.poiOutdoorFarBytes=0;frame();a(amount()>0);
 const add=c.uploads[0].buf;
 c.poiAddGroundTrim(4194304,0);
 a.equal(amount(),0);a(c.drops.includes(add));a.equal(c.poiOutdoorCaches.get('snowpass:0,0'),e);
 const prev=sec(old,'function poiOutdoorLate(vp,stream){','// END OUTDOOR GEOGRAPHY LOD');
 const next=sec(h,'function poiOutdoorLate(vp,stream){','// END OUTDOOR GEOGRAPHY LOD');
 a.equal(next.replace('  if(poiAddGroundBytes&&bytes)poiAddGroundTrim(held,poiOutdoorFarBytes+bytes);\n','')
  .replace(' if(stream)poiAddGroundFrame(vp,stream,id,g,areas,held);\n else if(poiAddGroundPlan||poiAddGroundBytes)poiAddGroundClear();\n',''),prev);
});
test('normal stock, covered, indoor and edited shapes cannot draw additive terrain; no actor backing or invented shafts',()=>{
 const {c,source,frame,amount}=setup();
 const plan=c.poiAddGroundCells(source,54.5,119.5),k=plan[0].key;
 frame(false);a.equal(amount(),0);
 c.poiOverlandCommands=[{key:k}];c.poiOverlandGroundDrawn.set(k,[255]);
 frame();a(amount()>0);
 a(!vm.runInContext('poiAddGroundCache',c).has(k));a.equal(c.poiOverlandGroundDrawn.size,1);
 c.facilitySurfaceEdited=true;frame();a.equal(amount(),0);c.facilitySurfaceEdited=false;
 c.facilityVisibilityOwner=()=>3;frame();a.equal(amount(),0);c.facilityVisibilityOwner=()=>null;
 const q=plan[0];c.facilityStairOpenings.add(q.x0+','+q.z0+',0');
 const rebuilt=c.poiAddGroundBuild(q);a.equal(rebuilt.m.p.length/3>0,true);
 const runs=c.poiOutdoorGroundRuns(q,source,(x,z)=>source.owns(x,z)&&!c.facilityStairOpenings.has(x+','+z+',0'));
 a(!runs.some(([x,x1,z])=>z===q.z0&&x<=q.x0&&x1>q.x0));
});

test('normal URL identical to old, ineligible fast path untouched, stable specs from fresh area arrays reuse same-foot plan',()=>{
 const {c,source,amount}=setup();
 a.equal(sec(h,'function workshopResumePermitted(','function workshopResumeRead('),sec(old,'function workshopResumePermitted(','function workshopResumeRead('));
 a(!h.includes("'add-ground'")&&!h.includes('poiAddGroundDrawn')&&!h.includes('POI_ADD_GROUND='));
 source.layout.map={width:128,height:182};source.layout.id='base';c.poiOverlandSnow={map:{width:24,height:29,world:[]}};
 Object.assign(c,{poiOutdoorSpecs:new WeakMap(),POI_SNOW_FRONTAGE:[{id:'base',owns:source.owns},{id:'snowpass',owns:source.owns}],
  isFloor:()=>false,poiOutdoorLandmark:()=>false,poiOverlandSquareLocalOwn:(_r,x,z)=>source.owns(x,z)});
 vm.runInContext(sec(h,'function poiOutdoorSpec(id,layout,world){','function poiOutdoorCandidates('),c);
 const a1=c.poiOutdoorAreas('base'),a2=c.poiOutdoorAreas('base');
 a.notEqual(a1,a2);a.equal(a1[0],a2[0]);a.equal(a1[1],a2[1]);
 c.poiAddGroundFrame([],false,'base',[54,119],a1,0);
 a.equal(amount(),0);a.equal(vm.runInContext('poiAddGroundPlan',c),null);
 c.poiAddGroundFrame([],true,'base',[54,119],a1,0);const first=vm.runInContext('poiAddGroundPlan',c);a(first);
 c.poiAddGroundFrame([],true,'base',[54,119],a2,0);a.equal(vm.runInContext('poiAddGroundPlan',c),first);
 const portal=first.list[0],x=portal.x0,z=portal.z0;
 c.poiDavidTempleEnclosedAt=(_site,xx,zz)=>xx===x&&zz===z;
 const cut=c.poiAddGroundBuild(portal),full=c.poiOutdoorGroundRuns(portal,portal.a);
 a(full.some(([x0,x1,z0])=>x0<=x&&x<x1&&z===z0));
 a(!cut.m.p.some((v,i)=>i%3===0&&v===x&&cut.m.p[i+2]===z));
});
