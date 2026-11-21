const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const source=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)?.[0];assert(source);
const build=vm.runInNewContext(source+'\n;buildFacilitySite');
const hard=o=>!/(?:floor(?:Light|Dark)?|stone|earth|Door)$/.test(o.type);
const dirs=[[0,1],[-1,0],[0,-1],[1,0]],key=(x,z)=>x+','+z;
function plan(site,id){
 const {map,buildings}=build(site),b=buildings.find(o=>o.id===id);assert(b);
 const d=b.z2-b.z1,w=b.x2-b.x1;
 const tx=(x,z)=>[b.x1+(b.turn===1?w-z:b.turn===2?w-x:b.turn===3?z:x),b.z1+(b.turn===1?x:b.turn===2?d-z:b.turn===3?d-x:z)];
 const at=(x,z)=>{const [a,c]=tx(x,z);return Array.from(map.world.filter(o=>o.x===a&&o.z===c&&o.y===0),o=>({...o,rot:(o.rot+4-b.turn)%4}));};
 const room=new Set(Array.from(b.footprint,p=>key(p.x,p.z)));
 const walk=(x,z,stop)=>{const q=[[x,z]],seen=new Set([key(x,z)]);
  for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
   const a=q[i][0]+dx,c=q[i][1]+dz,k=key(a,c);
   if(k===stop||seen.has(k)||!room.has(key(...tx(a,c)))||at(a,c).some(hard))continue;
   seen.add(k);q.push([a,c]);
  }
  return seen;
 };
 const fixture=(x,z,type)=>{const o=at(x,z).find(p=>p.type===type);assert(o,site+' '+id+' '+type+' '+[x,z]);return o;};
 const front=(x,z,type,expected)=>{const o=fixture(x,z,type),[dx,dz]=dirs[o.rot];assert.deepEqual([x+dx,z+dz],expected,type+' actual geometry front');};
 return {at,fixture,front,walk};
}
test('all three homes align toilet bowl and sink usable face to clear reach, not the wall, including rotated stamp',()=>{
 const facs={cottage:{door:[4,6],wc:[[1,1,[1,2]],[2,1,[2,2]]],bed:[5,1,0]},
  rowhouse:{door:[4,6],wc:[[4,1,[4,2]],[5,1,[5,2]]],bed:[2,1,0]},
  gardener:{door:[2,6],wc:[[5,3,[4,3]],[5,5,[4,5]]],bed:[1,3,3]}};
 for(const site of ['homes','base'])for(const [id,{door,wc,bed}] of Object.entries(facs)){
  const p=plan(site,id),reach=p.walk(...door);
  for(const [i,[x,z,front]] of wc.entries()){
   p.front(x,z,i?'kitchenSink':'guildLatrine',front);
   assert.ok(reach.has(key(...front)),site+' '+id+' WC approach '+front);
  }
  const [x,z,r]=bed;assert.equal(p.fixture(x,z,'bed').rot,r);
  const [dx,dz]=dirs[r];assert.ok(reach.has(key(x+dx,z+dz)),site+' '+id+' bed foot accessible');
 }
});
test('artisan cooking line and bed face the open interior, not a wall or locked furniture',()=>{
 for(const scope of ['artisan','base']){
  const p=plan(scope,'artisan'),seen=p.walk(4,7);
  for(const [x,t] of [[4,'kitchenStove'],[5,'kitchenSink'],[6,'kitchenCounter']]){
   p.front(x,1,t,[x,2]);assert.ok(seen.has(key(x,2)));
  }
  p.front(6,3,'bed',[5,3]);assert.ok(seen.has(key(5,3)));
 }
});
test('toolshop bed is behind the completed partition, with preserved stock circulation and separate WC',()=>{
 for(const scope of ['toolshop','base']){
  const p=plan(scope,'toolshop'),seen=p.walk(4,8);
  p.fixture(4,1,'woodwall');p.fixture(4,2,'woodwallDoor');p.fixture(4,3,'woodwall');
  p.front(3,1,'bed',[3,2]);p.front(1,1,'wardrobe',[1,2]);
  for(const square of [[3,2],[4,2],[5,2],[6,2],[6,3],[6,4],[4,6],[1,6],[2,7]])assert.ok(seen.has(key(...square)),scope+' access '+square);
  assert.ok(!p.walk(4,8,'4,2').has('3,2'),'private room can only be reached through its own door');
  for(const [x,z,t] of [[5,1,'displayShelf'],[6,1,'displayShelf'],[7,1,'barrel'],[7,2,'crate'],[7,3,'crate'],[5,3,'sack'],[7,5,'displayShelf'],[7,7,'displayShelf']])p.fixture(x,z,t);
 }
});
test('house cooking, shelves and seats use actual front axes while preserving their approaches',()=>{
 for(const site of ['homes','base']){
  const c=plan(site,'cottage'),r=plan(site,'rowhouse'),g=plan(site,'gardener');
  const cr=c.walk(4,6),rr=r.walk(4,6),gr=g.walk(2,6);
  for(const [p,reached,x,z,type,front] of [
   [c,cr,1,5,'fireplace',[2,5]],[c,cr,4,1,'wardrobe',[4,2]],
   [r,rr,1,4,'fireplace',[2,4]],[r,rr,1,3,'bookshelf',[2,3]],[r,rr,4,4,'wardrobe',[4,3]],
   [g,gr,1,2,'fireplace',[2,2]],[g,gr,1,4,'wardrobe',[2,4]],[g,gr,4,1,'displayShelf',[4,2]]
  ]){
   p.front(x,z,type,front);
   assert.ok(reached.has(key(...front)),site+' '+type+' approach '+front+' is not obstructed');
  }
  c.front(5,3,'chairWood',[5,4]);c.fixture(5,4,'table');
  r.front(1,2,'chairClassic',[1,1]);r.fixture(1,1,'table');
 }
});
test('long wall-backed beds in the revised homes draw flush without burying the pillow or shifting stored coordinates',()=>{
 const a=html.indexOf('function facilityHomeBedOffset('), b=html.indexOf('function makeScene(',a+1);
 assert(a>=0&&b>a,'missing on-wall bed draw adjustment');
 const adjust=vm.runInNewContext(html.slice(a,b)+`
 const rot2=(x,z,r)=>r===1?[-z,x]:[x,z];
 const isWallId=t=>t==='woodwall';
 const isFloor=t=>t==='woodfloor';
 let facilitySite={buildings:[{id:'artisan'}]},world=[];
 const facilityFloorOwner=()=>0;
 const step=(rot,x,z,behind,front,id='artisan')=>{
  facilitySite={buildings:[{id}]};
  const bed={x,z,y:0,type:'bed',rot};
  const map=new Map([[behind.x+','+behind.z,behind]]);
  world=[bed,...(front?[front]:[])];
  return {bed,offset:facilityHomeBedOffset(bed,{layers:new Map([[0,map]])})};
 };
 ({step})
 `);
 const south=adjust.step(0,5,5,{x:5,z:4,type:'woodwallWindow'},null);
 assert.deepEqual({...south.offset},{x:0,z:.29});
 assert.deepEqual({...south.bed},{x:5,z:5,y:0,type:'bed',rot:0});
 const west=adjust.step(1,5,5,{x:6,z:5,type:'woodwall'},null);
 assert.deepEqual({...west.offset},{x:-.29,z:0});
 assert.equal(adjust.step(0,5,5,{x:5,z:4,type:'woodwall'},{x:5,z:6,y:0,type:'wardrobe'}).offset,null);
 assert.equal(adjust.step(0,5,5,{x:5,z:4,type:'woodwall'},null,'lodging').offset,null);
 assert.match(html,/else if\(o\.type==='bed'\)\{\s*const offset=facilityHomeBedOffset\(o,wallLookup\)/);
});
