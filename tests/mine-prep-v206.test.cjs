const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const {beforeChapelApproach}=require('./mine-history-v165.cjs');
const site=beforeChapelApproach(JSON.parse(JSON.stringify(build('base')))),world=site.map.world;
const key=(x,z)=>x+','+z,dirs=[[1,0],[-1,0],[0,1],[0,-1]],floor=/^(?:stone|moss|road\w+)$/;
const at=(x,z)=>world.filter(o=>o.y===-1&&o.x===x&&o.z===z);
test('western preparation pocket changes one old wall, keeping the exact prior world in place',()=>{
 const m=site.mine,p=m.prep,old=world.slice(0,7356);
 assert.deepEqual(old[5975],{x:97,z:61,y:-1,type:'ruinDoorBroken',rot:1});
 old[5975]={x:97,z:61,y:-1,type:'mosswall',rot:0};
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'d869940ace969d8698a3257054a6d95fe19253e9f618bffba5cc561e2e23e114');
 assert.deepEqual(p.originalBounds,{x1:97,x2:125,z1:41,z2:67,y:-1});
 assert.deepEqual(m.preBossSupply,{id:'mine-preboss-mace',x:94,z:62,y:-1,type:'equipStoneMace',count:1,durability:100});
 assert.deepEqual(at(94,62).map(o=>o.type),['stone']);assert(!build('kitchen').mine);
 assert(world.slice(7356).every(o=>o.y===-1&&o.x>=86&&o.x<=97&&o.z>=59&&o.z<=66));
});
test('the optional road to the work station can loop and retreat without opening the treasure gate',()=>{
 const m=site.mine,p=m.prep,b=m.bounds,cell=new Map();
 for(const o of world.filter(o=>o.y===-1&&o.x>=b.x1&&o.x<=b.x2&&o.z>=b.z1&&o.z<=b.z2)){
  const k=key(o.x,o.z);if(!cell.has(k))cell.set(k,[]);
  cell.get(k).push(o.type);
 }
 const can=(x,z)=>{const t=cell.get(key(x,z))||[];return t.some(v=>floor.test(v))&&t.every(v=>floor.test(v)||/^(?:guildStairUp|ruinDoorBroken|monster\w+|benchWood|poiWallSconce)$/.test(v))};
 const reach=(x,z,avoid=[])=>{
  const q=[[x,z]],seen=new Set([key(x,z)]);
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const x=q[i][0]+dx,z=q[i][1]+dz,k=key(x,z);
   if(can(x,z)&&!seen.has(k)&&!avoid.includes(k)){seen.add(k);q.push([x,z]);}
  }return seen;
 };
 const y=reach(116,62);
 const newCount=p.cells.filter(p=>y.has(key(p.x,p.z))).length;
 assert(newCount>=25&&newCount<=45,newCount);
 assert(y.has('94,62'));assert(!y.has(key(m.vault.stand.x,m.vault.stand.z)));
 assert(reach(96,61,['91,62']).has('88,63')&&reach(96,61,['91,64']).has('88,63'),'two different inner links');
});
test('short-cut walls join cardinally and bracket lamps point into real dry floor',()=>{
 const walls=new Set(world.filter(o=>o.y===-1&&o.x>=86&&o.x<=98&&o.z>=58&&o.z<=67&&/^(?:stone|moss)wall$/.test(o.type)).map(o=>key(o.x,o.z)));
 for(const k of walls){
  const [x,z]=k.split(',').map(Number);assert(!at(x,z).some(o=>floor.test(o.type)));
  for(const dz of [-1,1])if(walls.has(key(x+1,z+dz)))assert(walls.has(key(x+1,z))||walls.has(key(x,z+dz)),k);
 }
 const facing=[[0,1],[-1,0],[0,-1],[1,0]];
 for(const o of world.slice(7356).filter(o=>o.type==='poiWallSconce')){
  const [dx,dz]=facing[o.rot];
  assert(walls.has(key(o.x,o.z))&&at(o.x+dx,o.z+dz).some(o=>floor.test(o.type)));
 }
});
