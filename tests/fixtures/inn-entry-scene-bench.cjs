const fs=require('node:fs'),vm=require('node:vm'),{performance}=require('node:perf_hooks'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.argv[2],'utf8');
const scripts=Array.from(h.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g),m=>m[1]);
let count=0,id=0,bufBytes=0,bound=null,partialCount=0,partialBytes=0;const uploads=new Map();
const stub=()=>{};
let E;
const v={width:390,height:740,length:0,getBoundingClientRect:()=>({width:390,height:740,left:0,top:0}),getContext:k=>k==='webgl'?gl:E,classList:{add:stub,remove:stub,toggle:stub,contains:()=>false},querySelector:()=>E,getElementById:()=>E,querySelectorAll:()=>[],createElement:()=>E,
 matches:()=>false,getItem:()=>null,setItem:stub,addEventListener:stub,style:{setProperty:stub},options:[],dataset:{},value:'0'};
v.documentElement=v;v.body=v;
E=new Proxy(v,{get:(o,k)=>k in o?o[k]:stub});
const gl=new Proxy({createBuffer:()=>++id,bindBuffer:(target,id)=>{bound=id},deleteBuffer:id=>uploads.delete(id),bufferData:(t,data)=>{count++;bufBytes+=data.byteLength||0;if(bound!==null)uploads.set(bound,data)},bufferSubData:(t,offset,data)=>{partialCount++;partialBytes+=data.byteLength;uploads.get(bound).set(data,offset/4)},getShaderParameter:()=>true,getProgramParameter:()=>true,getAttribLocation:()=>1,STATIC_DRAW:1,getExtension:()=>process.env.NO_INDEX?null:{},ELEMENT_ARRAY_BUFFER:34963},{get:(o,k)=>o[k]??stub});
const media={matches:false,addEventListener:stub};
const sandbox={window:null,self:null,document:E,localStorage:E,navigator:{userAgent:'Node'},location:{href:'https://test.example/world-editor.html',search:'?facility=base'},history:{},console,Math,URL,URLSearchParams,performance,matchMedia:()=>media,
 requestAnimationFrame:stub,setTimeout:stub,clearTimeout:stub,setInterval:stub,clearInterval:stub,ResizeObserver:undefined,HTMLElement:class{},addEventListener:stub,screen:{width:390,height:740},innerWidth:390,innerHeight:740,
 getComputedStyle:()=>({display:'block',getPropertyValue:()=>0})};
function digest(mesh,signs){
 const d=createHash('sha256'),write=(m,a,b)=>{
  const arr=uploads.get(m.buf),slice=arr.subarray(a*9,b*9);
  d.update(Buffer.from(slice.buffer,slice.byteOffset,slice.byteLength));
 };
 if(mesh.ground)write(mesh.ground,0,mesh.ground.count);
 if(mesh.indices){
  const source=uploads.get(mesh.buf),indices=uploads.get(mesh.indices),result=new Float32Array(indices.length*9);
  for(let i=0;i<indices.length;i++)result.set(source.subarray(indices[i]*9,(indices[i]+1)*9),i*9);
  d.update(Buffer.from(result.buffer));
 }else{
  let i=0;for(const [a,b] of mesh.hiddenSpans||[]){write(mesh,i,a);i=b}write(mesh,i,mesh.count);
 }
 const ranges=k=>{
  const packed=Array.from(mesh[k]||[],r=>{
   const {start,end,...rest}=r;const meta={...rest};
   // Rear watchtower surface coordinates are invariant even when VBO offsets shift.
   if(meta.rearGeometry){const {start,end,...rear}=meta.rearGeometry;meta.rearGeometry=rear}
   const arr=uploads.get(mesh.buf).subarray(start*9,end*9);
   return [meta,createHash('sha256').update(Buffer.from(arr.buffer,arr.byteOffset,arr.byteLength)).digest('hex')];
  });
  return createHash('sha256').update(JSON.stringify(packed)).digest('hex');
 };
 const signHash=createHash('sha256');
 for(const {id,buf} of signs){
  signHash.update(id);const a=uploads.get(buf);signHash.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));
 }
 return {indexBytes:uploads.get(mesh.indices)?.byteLength??0,geometry:d.digest('hex'),walls:ranges('wallFade'),storeys:ranges('storeyFade'),signs:signHash.digest('hex')};
}
sandbox.measure=()=>[count,bufBytes,partialCount,partialBytes];sandbox.digest=digest;sandbox.flush=process.argv[3]==='edited';sandbox.finish=rows=>console.log(JSON.stringify(rows,null,2));
sandbox.window=sandbox;sandbox.self=sandbox;sandbox.pineStartup={start:f=>f(),failed:false,loading:false};
const c=vm.createContext(sandbox);
const bench=`(()=>{
 facilitySite={...buildFacilitySite('base'),id:'base'}; MAP_W=facilitySite.map.width;MAP_H=facilitySite.map.height;
 world=facilitySite.map.world;terrainHeights=new Map((facilitySite.map.terrainHeights||[]).map(o=>[o.x+','+o.z,o.h]));poiWalkActive=true;hideUpper=false;facilityHasCellar=true;
 facilityPrepareFloorMasks();facilityRefreshStairs();facilityInvalidateScenes();signProgram={};
 if(flush==='edited'&&typeof facilitySurfaceEdited!=='undefined')facilitySurfaceEdited=true;
 if(flush)world=[...world,{x:53,z:29,y:1,type:'lantern',rot:0}];
 const rows=[];
 for(const [name,x,z,y] of [["surface",41,43,0],["main-approach",41,34,0],["main-door",41,33,0],["main-inside",41,32,0],["main-exit",41,34,0],["main-repeat",41,33,0],["south-approach",107,116,0],["south-door",108,116,0],["south-inside",109,116,0]]){
  const [before,beforeBytes,beforePartial,beforePartialBytes]=measure();
  poiWalkX=x;poiWalkZ=z;poiWalkLevel=y;level=y;
  const owner=facilityVisibilityOwner(),t=performance.now(),bundle=facilityRenderScene(),mesh=bundle.mesh,ms=performance.now()-t;
  rows.push({name,x,z,y,owner,building:facilitySite.buildings[owner]?.id??null,roof:facilitySite.buildings[facilityHiddenRoof()]?.id??null,ms,uploads:measure()[0]-before,bytes:measure()[1]-beforeBytes,partial:measure()[2]-beforePartial,partialBytes:measure()[3]-beforePartialBytes,spans:mesh.hiddenSpans?.length??0,verts:mesh.count,grade:mesh.ground?.count??0,variants:facilityScenes.size,...digest(mesh,bundle.signs)});
 }
 return rows;
})()`;
try{
 const anchor="const workshopResume=workshopResumeRead();",body=scripts.find(x=>x.includes(anchor));
 if(!body.includes(anchor))throw Error('missing harness injection');
 const legacy=process.argv[3]==='legacy',needle="function facilitySharedSurfaceAllowed(cut){";
 if(legacy&&!body.includes(needle))throw Error('missing legacy override');
 const source=legacy?body.replace(needle,needle+"if(facilitySite.buildings[cut]?.id==='lodging')return false;"):body;
 vm.runInContext(source.replace(anchor,'finish('+bench+');return;'+anchor),c,{filename:'bench.html'});
 console.error(JSON.stringify({count,bufBytes}));
}catch(e){console.error(e);process.exitCode=1}
