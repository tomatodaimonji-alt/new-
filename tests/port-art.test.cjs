const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+1);a(i>=0&&j>i,x);return h.slice(i,j)};
const art=['poiPortSkiff','poiPortNet','poiPortFishStall'];
function renderer(){
 const c={mesh:()=>({p:[],n:[],c:[]}),POI_FORT_PARTS:new Set(),MATCHED_COUNTER_IDS:new Set(),MATCHED_OPENING_IDS:new Set(),
  MATERIAL_FIXTURE_IDS:new Set(),models:[],isWallId:()=>false,oldTownShopDetails:()=>false};
 vm.createContext(c);
 const dispatch=slice('function decoBase(','switch(id){').split(' if(oldTownShopDetails')[0]+'}';
 vm.runInContext(slice('function tri(','function addPart(')+slice('// BEGIN FISHING PORT ART','// END FISHING PORT ART')+
  '\n'+dispatch+'\n'+slice('// BEGIN DAVID TEMPLE ARCHITECTURE','// END DAVID TEMPLE ARCHITECTURE')+
  '\n'+slice('function deco(','// Deterministic micro-variation:'),c);
 return (id,r)=>{const mesh=c.mesh();c.deco(mesh,id,.5,0,.5,r);return mesh};
}
function positions(m){const p=[];for(let i=0;i<m.p.length;i+=3)p.push(m.p.slice(i,i+3));return p}
test('port props are unique catalog entries and real lightweight WebGL geometry in all four rotations',()=>{
 const get=renderer();
 for(const id of art){
  a.equal((h.match(new RegExp("id:'"+id+"',name:'[^']+'",'g'))||[]).length,1);
  const m=get(id,0),start=positions(m);a(m.p.length>=360&&m.p.length<3000,id+' modest vertex budget');
  a.equal(m.p.length,m.c.length);a.equal(m.p.length,m.n.length);a(m.p.every(Number.isFinite));
  a(m.c.every(v=>v>=0&&v<=1));
  a(m.n.every((v,i)=>i%3||Math.abs(Math.hypot(v,m.n[i+1],m.n[i+2])-1)<1e-6));
  const cc=new Set(positions({p:m.c}).map(p=>p.join()));a(cc.size>=8,id+' sculpted painted facets');
  for(let r=1;r<4;r++){
   const other=get(id,r),ps=positions(other);a.equal(ps.length,start.length);
   a.deepEqual(other.c,m.c);
   for(let i=0;i<ps.length;i++){
    const [x,y,z]=start[i],[u,w]=[null,[-z+1,x],[-x+1,-z+1],[z,-x+1]][r];
    a(Math.abs(ps[i][0]-u)<1e-6&&Math.abs(ps[i][2]-w)<1e-6&&ps[i][1]===y);
   }
  }
 }
});
test('skiff is long with a tapered raised north prow and visible waterline; market props stay within their own tile',()=>{
 const get=renderer(),bob=positions(get('poiPortSkiff',0));
 const min=(p,i)=>Math.min(...p.map(x=>x[i])),max=(p,i)=>Math.max(...p.map(x=>x[i]));
 a(min(bob,1)<0&&max(bob,1)>.4,'water intersects the lower hull');
 a(max(bob,2)-min(bob,2)>2.1&&max(bob,0)-min(bob,0)<.98);
 const bow=bob.filter(x=>x[2]<-.57);a(bow.length>0&&bow.every(x=>Math.abs(x[0]-.5)<.08));a(max(bow,1)>.4);
 const stern=bob.filter(x=>x[2]>1.51);a(stern.length>0&&max(stern,0)-min(stern,0)>.48);
 for(const id of art.slice(1)){
  const p=positions(get(id,0));a(min(p,0)>=0&&max(p,0)<=1&&min(p,2)>=0&&max(p,2)<=1,id+' does not obstruct neighbor tile');
 }
 a(max(positions(get('poiPortFishStall',0)),1)<.91,'low fish display not a canopy');
});
