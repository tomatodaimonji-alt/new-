const {readFileSync}=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=readFileSync(process.env.HTML??'world-editor.html','utf8');
const base=readFileSync(process.env.BASELINE??'/workspace/shared/workshop-next-port-catch/release.html','utf8');
const cut=(s,e,t=h)=>{const i=t.indexOf(s),j=t.indexOf(e,i+1);a(i>=0&&j>i);return t.slice(i,j)};
test('released role gate uses two authenticated owned canonical source footprints, not user history/location/opt-in',()=>{
 const c=vm.createContext({POI_OUTDOOR_FAR_OUT:48,POI_OUTDOOR_FAR_SLOTS:160,isFloor:()=>false});
 vm.runInContext(cut('const POI_OVERLAND_ORIGINS=','function poiOverlandIndex(')+
 h.match(/^const POI_SNOW_PASS=.*$/m)[0]+
 cut('const POI_SQUARE_FIELD_SIDE=','// END SQUARE FIELD')+
 cut('const POI_OVERLAND_PATCHES=','// END SPARSE OVERLAND SQUARE')+
 cut('function poiOutdoorCandidates(', 'function poiOutdoorCrown(')+
 cut('function poiSeamRoleSources(', 'function poiSeamRoleBegin(')+`
 const draft=(id,width,height)=>({id,davidTemple:{depth:1},map:{width,height,world:[]}});
 const snow=draft('snowpass',24,29),home=draft('base',128,182);
 const make=(layout)=>({layout,id:layout.id,world:layout.map.world,width:layout.map.width,height:layout.map.height,owns:(x,z)=>poiOverlandSquareLocalOwn(layout.id,x,z)});
 const b=make(home),s=make(snow),areas=[b,s];
 let facilitySite=home,world=b.world,poiOverlandSnow=snow,poiSnowPassBase=null;
 const at=(id,x,z,testAreas=areas)=>poiSeamRoleSources(id,testAreas,poiOutdoorCandidates(testAreas,x,z));
 `,c);
 const checks=vm.runInContext(`[
 at('base',72,149),at('base',60,137),at('base',48,160),
 at('base',88,64),at('base',180,180),at('base',72,149,[b]),
 (poiOverlandSnow=draft('snowpass',24,29),at('base',72,149)),(poiOverlandSnow=snow,world=[],at('base',72,149)),
 (facilitySite=snow,poiSnowPassBase={site:home,world:b.world,edited:true},at('snowpass',71,149)),
 (poiSnowPassBase.edited=false,at('snowpass',71,149)),
 (poiSnowPassBase=null,at('snowpass',71,149))
 ]`,c);
 a.equal(JSON.stringify(checks),JSON.stringify([true,true,true,false,false,false,false,false,false,true,false]));
 a(!h.includes("const POI_SEAM_ROLES="));a(!h.includes("get('seam-roles')"));
});
test('classic vertex shader, focus, mesh, caps, assets and old visibility predicates unchanged',()=>{
 for(const [x,y] of [['function poiOverlandUpload(', 'function poiOverlandBakeFrame('],
  ['function draw(mesh,vp','function layout('],['function poiOutdoorMesh(q){','const POI_SEAM_STRIDE=20;'],
  ['function poiOutdoorLodMayRun()', '// Exterior residency is data-only']]){
  const end=y==='const POI_SEAM_STRIDE=20;'?'function poiOutdoorDrop(key){':y;
  a.equal(cut(x,y),cut(x,end,base),x);
 }
 a.equal(h.match(/^const VERT=.*$/m)[0],base.match(/^const VERT=.*$/m)[0]);
 a.equal(h.match(/^const POI_OVERLAND_GPU_LIMIT=.*$/m)[0],base.match(/^const POI_OVERLAND_GPU_LIMIT=.*$/m)[0]);
 a.equal(h.match(/^const POI_OUTDOOR_FAR_PEAK=.*$/m)[0],base.match(/^const POI_OUTDOOR_FAR_PEAK=.*$/m)[0]);
 const assets=s=>[...s.matchAll(/[a-zA-Z0-9+/=]{5000,}/g)].map(m=>m[0]);
 a.deepEqual(assets(h),assets(base));
 a.equal([...h.matchAll(/v334/g)].length,4);
});
