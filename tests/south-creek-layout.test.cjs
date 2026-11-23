const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),plain=s=>JSON.parse(JSON.stringify(s));
const build=vm.runInNewContext(h.slice(h.indexOf('const FACILITY_SITES=Object.freeze('),h.indexOf('function workshopResumeDecode('))+';buildFacilitySite');
const s=plain(build('base')),w=s.map.world,key=(x,z)=>x+','+z;
test('creek is a contiguous spring-to-border channel, not a pond or a straight trench',()=>{
 const c=s.southRoad.creek;assert(c);const water=new Set(c.water.map(({x,z})=>key(x,z)));
 assert(water.has('96,106')&&water.has('127,101'));assert(water.size>=35&&water.size<75);
 const q=[[96,106]],seen=new Set(['96,106']);
 for(let i=0;i<q.length;i++){const [x,z]=q[i];for(const [a,b] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
  const k=key(a,b);if(water.has(k)&&!seen.has(k)){seen.add(k);q.push([a,b]);}
 }}
 assert.equal(water.size,seen.size);
 for(const p of c.water)assert.equal(w.filter(o=>o.x===p.x&&o.z===p.z&&o.y===0&&o.type==='river').length,1);
 const old=w.slice(0,7578).map(o=>o.y===0&&o.x===101&&(o.z===104||o.z===105)?{...o,type:'roadGravelFull'}:o);
 assert.equal(createHash('sha256').update(JSON.stringify(old)).digest('hex'),'8fe11e1cf6f3fb771d952c85cbe32d78bf72d0632515637bf4c7c8a2869d21d4');
});
test('actual native bridge collision admits normal crossing and blocks side entry/open water',()=>{
 const slice=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)));
 const ctx=vm.createContext({facilitySite:{...s,id:"base"},world:w,facilityCreekIndex:null,poiWalkLevel:0,poiWalkActive:false,
  validPos:(x,z)=>x>=0&&x<128&&z>=0&&z<128,pineSuperVehicleType:()=>false,isFloor:t=>/^(?:earth|road\w+|river|grass\w*|woodfloor\w*|stone|brickfloor)$/.test(t),
  facilityFloorOwner:(x,z)=>s.buildings.some(b=>b.footprint.some(p=>p.x===x&&p.z===z))?0:null,poiWalkPassableDoor:t=>/wallDoor$/.test(t),bridgeSpanElevation:()=>0});
 vm.runInContext(slice('function facilityRefreshCreek(', 'function poiCreekPlayerHeight(')+slice('function poiWalkCanStep(', 'function poiWalkCamera('),ctx);
 ctx.facilityRefreshCreek();
 for(let z=104;z<=106;z++)assert(ctx.poiWalkCanStep(101,z,101,z-1),z);
 assert(!ctx.poiWalkCanStep(101,104,102,104));
 assert(!ctx.poiWalkCanStep(102,104,102,103));
 assert.equal(ctx.facilityCreekIndex.bridgeHeight.get('101,105'),.15);
 const road=s.southRoad,town=road.town;
 for(let i=1;i<road.path.length;i++){
  const a=road.path[i-1],b=road.path[i];
  assert(ctx.poiWalkCanStep(b.x,b.z,a.x,a.z),'journey crosses every authored step into town');
 }
 const canReach=(start,end)=>{
  const q=[start],seen=new Set([key(start.x,start.z)]);
  for(let i=0;i<q.length;i++){
   const {x,z}=q[i];if(x===end.x&&z===end.z)return true;
   for(const [xx,zz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
    const k=key(xx,zz);
    if(xx<94||xx>116||zz<108||zz>122||seen.has(k)||!ctx.poiWalkCanStep(xx,zz,x,z))continue;
    seen.add(k);q.push({x:xx,z:zz});
   }
  }
  return false;
 };
 for(const destination of [town.market.public,town.market.work,town.market.receiving.stand,town.inn.bedStand])
  assert(canReach(road.path.at(-1),destination),'walk into actual destination '+JSON.stringify(destination));

 ctx.world=w.filter(o=>o.type!=='bridgeStoneEnd'||o.x!==101||o.z!==105);ctx.facilityRefreshCreek();
 assert(!ctx.poiWalkCanStep(101,104,101,103),'missing fitted end invalidates whole bridge');
 const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
 assert.equal(hash(s.creek),'a109c69b3abb3d0586912343bf7f3b96d0489272d45e98907b7ef32ebab60750');
 assert.equal(hash(s.canal),'785de603c5a8e6e96b7fe0d5e10322f046a6c57db0364ccb09c325b896892b47');
});

test('the same native stone span renders exactly once, rotated on the two-tile north/south axis',()=>{
 const a=h.indexOf('function facilityCanalBridgeGeometry('),b=h.indexOf('function bridgeConnectedGeometry(',a);
 const mesh=()=>({p:[],n:[],c:[]});
 const quad=(m,...corners)=>{for(const v of corners.slice(0,4)){m.p.push(...v);m.n.push(0,1,0);m.c.push(.5,.5,.5)}};
 const cube=(m,x,y,z,w,height,depth)=>quad(m,[x-w/2,y,z-depth/2],[x+w/2,y+height,z+depth/2],[x,y,z],[x,y,z],[]);
 const ctx=vm.createContext({mesh,quad,cube,facilitySite:{...s,id:'base'}});
 vm.runInContext(h.slice(a,b),ctx);
 const pair=s.southRoad.creek.bridgePairs[0],lookup=new Map(pair.map(p=>[key(p.x,p.z),{...p,y:0}]));
 const floors=new Map(pair.map(p=>[key(p.x,p.z),'river'])),m=mesh();
 assert(ctx.facilityCanalBridgeGeometry(m,{...pair[0],y:0},lookup,floors));assert(m.p.length>250);
 const count=m.p.length;
 assert(ctx.facilityCanalBridgeGeometry(m,{...pair[1],y:0},lookup,floors));assert.equal(m.p.length,count);
 const axis=n=>m.p.filter((_,i)=>i%3===n);
 assert(Math.min(...axis(0))>=101&&Math.max(...axis(0))<=102,'lateral span stays within a tile');
 assert.equal(Math.min(...axis(2)),104);assert.equal(Math.max(...axis(2)),106);
});
