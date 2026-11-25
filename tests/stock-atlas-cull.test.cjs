const a=require('node:assert/strict'),{test}=require('node:test'),{readFileSync}=require('node:fs'),vm=require('node:vm');
const h=readFileSync(process.env.ATLAS_HTML??'world-editor.html','utf8');
test('exact default guard keeps every noneligible drawing owner on original path',()=>{
 const idx=h.indexOf('function stockAtlasSceneOmissions(');
 a(idx>=0); const src=h.slice(idx,h.indexOf('function poiDrawSceneOcclusion(',idx));
 const state={facilitySite:{id:'base'},poiWalkActive:true,poiWalkLevel:0,poiThirdPerson:true,cameraTopDown:false,pineAIActive:false,poiOverlandDrawing:false,
  facilitySurface:{stockAtlasBounds:[1],count:100},stockAtlasOmitted:()=>[[0,24]]};
 const c=vm.createContext({...state});vm.runInContext(src,c);
 const vp=new Float32Array(16).fill(1),m=state.facilitySurface;const omit=()=>c.stockAtlasSceneOmissions(m,vp);
 a.deepEqual(omit(),[[0,24]]);
 for(const [key,value]of Object.entries({facilitySite:{id:'snowpass'},poiWalkActive:false,poiWalkLevel:-1,poiThirdPerson:false,cameraTopDown:true,pineAIActive:true,poiOverlandDrawing:true,facilitySurface:{...m}})){
  c[key]=value;a.equal(omit(),null,key);c[key]=state[key];
 }
 m.indices={};a.equal(omit(),null);delete m.indices;
 m.hiddenSpans=[[0,12]];a.equal(omit(),null);delete m.hiddenSpans;
 vp[0]=NaN;a.equal(omit(),null);vp[0]=1;
 c.stockAtlasOmitted=()=>[[0,9]];a.equal(omit(),null);
 a.doesNotMatch(h,/__stockAtlasProbe|__stockAtlasFrame|__stockAtlasStartup|__atlasForcedOld/);
});
