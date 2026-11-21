const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function part(a,b){const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,a);return html.slice(x,y)}
const build=vm.runInNewContext(part('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite');
const transform=(b,x,z)=>{const w=b.turn%2?b.z2-b.z1+1:b.x2-b.x1+1,d=b.turn%2?b.x2-b.x1+1:b.z2-b.z1+1;
 const [rx,rz]=b.turn===1?[d-1-z,x]:b.turn===2?[w-1-x,d-1-z]:b.turn===3?[z,w-1-x]:[x,z];
 return [b.x1+rx,b.z1+rz]};
const cell=(map,b,x,z)=>{const [xx,zz]=transform(b,x,z);return map.world.filter(o=>o.x===xx&&o.z===zz&&o.y===0)};
const passable=o=>o.type==='earth'||o.type==='stone'||o.type.startsWith('road')||/floor/i.test(o.type)||
 o.type.endsWith('Door')||['chairClassic','chairWood','benchWood','stoolRound','poiWallSconce'].includes(o.type);
test('One visual bay spans the two stable doorway cells, with actual cart clearance and neither a center post nor door leaves',()=>{
 const boxes=vm.runInNewContext(part('function poiStableLoadingBayGeometry(','function facilityStableLoadingBayPart(')+`
 const mesh=[];function cube(m,x,y,z,w,h,d,color){m.push({x,y,z,w,h,d,color})}
 poiStableLoadingBayGeometry(mesh,0,0,0);mesh
 `);
 const overhead=boxes.filter(o=>o.w>1.65&&o.y>=1.15);
 assert.equal(overhead.length>=1,true,'continuous lintel');
 assert(!boxes.some(o=>o.y<1.15&&o.y+o.h>.07&&Math.abs(o.x)-o.w/2<.64),'wagon clearance at center');
 const tall=boxes.filter(o=>o.y<.14&&o.h>.8);
 assert.equal(tall.length,2);
 assert(tall.every(o=>Math.abs(o.x)>=.86));
 assert.match(html,/facilityStableLoadingBayPart\(o\)/);
 for(const id of ['stable','base']){
  const {map,buildings}=build(id),b=buildings.find(o=>o.id==='stable');
  for(const x of [6,7])assert(cell(map,b,x,8).some(o=>o.type==='woodwallDoor'));
  const can=(x,z)=>cell(map,b,x,z).every(passable);
  // Tile-width route tests a two-cell-wide square spanning the threshold and turning into the interior aisle.
  const seen=new Set(),q=[[6,9]];
  while(q.length){
   const [x,z]=q.shift(),k=x+','+z;
   if(x<4||x>7||z<3||z>10||seen.has(k))continue;
   if(![[0,0],[1,0],[0,1],[1,1]].every(([dx,dz])=>can(x+dx,z+dz)))continue;
   seen.add(k);q.push([x+1,z],[x-1,z],[x,z+1],[x,z-1]);
  }
  assert(seen.has('6,8')&&seen.has('5,4'),id+' unbroken two-wide cart access');
 }
});
test('Workshop has an accessible centered checkout, real wall-backed tool stations, and a parked cart outside',()=>{
 for(const id of ['workshop','base']){
  const {map,buildings}=build(id),b=buildings.find(o=>o.id==='workshop');
  for(const [x,z,type] of [[3,1,'table'],[4,1,'table'],[1,4,'table'],[1,7,'benchWood'],[3,7,'counterWood'],[4,7,'counterWood'],[4,7,'poiLedgerPapers']])
   assert(cell(map,b,x,z).some(o=>o.type===type),id+' workshop '+type+' at '+[x,z]);
  for(const [x,z] of [[3,6],[4,8],[5,8],[5,7],[5,6],[5,4],[5,2]])
   assert(cell(map,b,x,z).every(passable),id+' staff/public aisle '+[x,z]);
  assert(!map.world.some(o=>o.type.startsWith('handcart')&&b.footprint.some(p=>p.x===o.x&&p.z===o.z)));
  assert(cell(map,b,9,11).some(o=>o.type==='handcartLoaded'));
  assert(cell(map,b,9,11).some(o=>o.type.startsWith('road')));
  for(const [x,z,t] of [[6,2,'woodwallDoor'],[6,6,'woodwallDoor'],[9,5,'kitchenSink'],[9,7,'guildLatrine']])
   assert(cell(map,b,x,z).some(o=>o.type===t));
 }
});
test('Stable bay is scoped to the loading pair; removing either tile restores ordinary door rendering',()=>{
 const f=part('function facilityStableLoadingBayPart(','function facilityHasDiningStoneLeaf(');
 const outcome=vm.runInNewContext(f+`
  const rot2=(x,z,r)=>r===1?[-z,x]:[x,z];
  let facilitySite={buildings:[{id:'stable',turn:1,entrance:{x:15,z:6}}]};
  const left={x:15,z:6,y:0,type:'woodwallDoor',rot:1},right={...left,z:7},other={...left,x:14};
  const world=[left,right,other];
  const out=[facilityStableLoadingBayPart(left),facilityStableLoadingBayPart(right),facilityStableLoadingBayPart(other)];
  world.splice(1,1);out.push(facilityStableLoadingBayPart(left));facilitySite=null;
  out.push(facilityStableLoadingBayPart(other));out
 `);
 assert.deepEqual([...outcome],[1,2,0,0,0]);
});
test('The outer facade trim draws no leftover posts or thresholds in the merged stable bay',()=>{
 const source=part('function facilityStableLoadingBayPart(','function facilityHasDiningStoneLeaf(')
  +part('function facilityLodgingFacade(','const BRIDGE_IDS=');
 const result=vm.runInNewContext(source+`
  const rot2=(x,z)=>[x,z],isFloor=()=>false,terrainY=()=>0;
  const mesh=()=>({p:[],n:[],c:[]});
  const cube=(m,x,y,z)=>{m.p.push(x,y,z);m.n.push(0,1,0);m.c.push(0,0,0)};
  const {entrance}=({entrance:{x:10,z:41}});
  const facilitySite={buildings:[{id:'stable',turn:0,entrance}]};
  const a={x:10,z:41,y:0,rot:0,type:'woodwallDoor'},b={...a,x:11};
  const ordinary={...a,z:20};
  const world=[a,b,ordinary],both=mesh(),other=mesh(),single=mesh();
  houseFacadeDetails(both,[a,b]);houseFacadeDetails(other,[ordinary]);
  world.splice(1,1);houseFacadeDetails(single,[a]);
  [both.p.length,other.p.length,single.p.length]
 `);
 assert.deepEqual([...result],[0,12,12]);
});
