const {readFileSync}=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=readFileSync(process.argv[2]??'candidate.html','utf8');
function fixture(){
 const b=h.slice(h.indexOf('function poiOverlandUpload('),h.indexOf('const poiOverlandPrimedMusic='));
 const meta=h.match(/^const poiOverlandRejected=.*$/m)?.[0]??'';
 const c=vm.createContext({performance:{now:()=>0},poiOverlandEngaged:false,poiOverlandBake:null,poiOverlandStats:{builds:0,maxBakeMs:0},
  POI_OVERLAND_GPU_LIMIT:4*1024*1024,poiOverlandMeshes:new Map(),calls:[],trim:[],serial:0});
 vm.runInContext(meta+`
 const upload=()=>({buf:++serial});
 const poiOutdoorTrimForDetailed=(...input)=>trim.push(input);
 function* poiOverlandChunkRows(q,area){
  calls.push([q.key,area.name]);
  const p=new Array(q.bytes/12).fill(0);yield;
  return {p,propsFirst:p.length/3,groundRows:[255]};
 }`+b,c);
 const area={id:'base',name:'A'},second={id:'base',name:'B'};
 const q=(key,bytes)=>({id:'base',key,bytes});
 const frames=(list,n=1,src=area)=>{for(let k=0;k<n;k++)c.poiOverlandBakeFrame(list,[src],true)};
 return {c,area,second,q,frames};
}
test('replay exact upload/bake: rejects heavy immutable first candidate once, then smaller real mesh; existing original object/priority unchanged',()=>{
 const {c,q,frames}=fixture(),left=c.POI_OVERLAND_GPU_LIMIT-432,near={bytes:left,buf:99};
 c.poiOverlandMeshes.set('existing',near);
 const large=q('base:4,5',864),small=q('base:5,5',216);
 frames([large,small],6);
 a.deepEqual(c.calls.map(v=>v[0]),[large.key,small.key]);
 a.equal(c.poiOverlandMeshes.get('existing'),near);a.equal(c.poiOverlandMeshes.get(small.key)?.bytes,216);
 a.equal(c.poiOverlandMeshes.has(large.key),false);a.equal(c.trim.length,1);a.equal(c.trim[0][0],216);
});
test('capacity threshold, source identity, removed keys and empty generator output',()=>{
 const {c,q,area,second,frames}=fixture(),large=q('base:4,5',864),zero=q('base:6,5',0);
 c.poiOverlandMeshes.set('existing',{bytes:c.POI_OVERLAND_GPU_LIMIT-432});
 frames([large],3);a.equal(c.calls.length,1);
 c.poiOverlandMeshes.get('existing').bytes-=216;frames([large],3);a.equal(c.calls.length,1);
 c.poiOverlandMeshes.get('existing').bytes-=216;frames([large],3);a.equal(c.calls.length,2);
 a.equal(c.poiOverlandMeshes.get(large.key)?.bytes,864);
 frames([zero],2);a.equal(c.calls.length,3);
 frames([zero],2,second);a.equal(c.calls.length,4);
 frames([],2,second);frames([zero],2,second);a.equal(c.calls.length,5);
});
test('real invalidation hooks and unchanged production upload/presentation',()=>{
 const old=readFileSync(process.argv[3]??'/workspace/shared/workshop-next-port-catch/release.html','utf8');
 const cut=(t,l,r)=>t.slice(t.indexOf(l),t.indexOf(r,t.indexOf(l)+l.length));
 a.equal(cut(h,'function poiOverlandUpload(','function poiOverlandBakeFrame('),cut(old,'function poiOverlandUpload(','function poiOverlandBakeFrame('));
 a.equal(cut(h,'function poiOverlandPresent(','function poiOverlandInspect('),cut(old,'function poiOverlandPresent(','function poiOverlandInspect('));
 const c=vm.createContext({poiOverlandBake:{},poiAddGroundPlan:null,poiAddGroundBytes:0,poiOutdoorCaches:new Map(),poiOutdoorProbe:{}});
 vm.runInContext(h.match(/^const poiOverlandRejected=.*$/m)[0]+
  'let poiStockOutdoorWarm=null,poiOutdoorPlan=null,poiOutdoorFrame=null;'+
  cut(h,'function poiStockOutdoorWarmClear(','function poiStockOutdoorWarmBlock('),c);
 for(const reason of ['map-edit','map-load','region-change','context-loss','page-hide','active-source-changed']){
  a.deepEqual(vm.runInContext(`poiOverlandRejected.set('base:1,1',{});poiOverlandBake={};poiStockOutdoorWarmClear('${reason}');[poiOverlandRejected.size,poiOverlandBake]`,c).join(','),'0,');
 }
});
