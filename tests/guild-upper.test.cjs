const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{test}=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const implementation=html.match(/function pineGuildDesignUpperFloors\([\s\S]*?\/\* end guild upper floor design \*\//)?.[0];
assert(implementation,'pure guild upper floor design not found');
const design=vm.runInNewContext(implementation+'\n;pineGuildDesignUpperFloors');
const coords=(x,z)=>x+','+z;
const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
const perimeter=(x,z)=>x===7||x===22||z===6||z===20;
const inside=o=>o.x>7&&o.x<22&&o.z>6&&o.z<20;
const floor=o=>o.type==='woodfloor'||o.type==='woodfloorDark'||o.type==='woodfloorLight';
const wall=o=>/wall(?:Door|Window)?$/.test(o.type);
function starter(){
 const w=[];
 const add=(x,z,type,y=0,rot=0)=>w.push({x,z,type,y,rot});
 for(let y=0;y<=3;y++)for(let x=7;x<=22;x++)for(let z=6;z<=20;z++){
  if(y===3){add(x,z,'roofHip',y);continue}
  if(y===0||((x+z)%2===0))add(x,z,'woodfloor',y);
  if(perimeter(x,z))add(x,z,y===0&&x===14&&z===20?'stonewallDoor':'stonewall',y);
 }
 add(8,18,'guildStairUp',0);add(8,18,'guildStairDown',1);
 add(19,17,'guildStairUp',1);add(19,17,'guildStairDown',2);
 add(14,20,'guildFacadeSign');add(13,18,'counterWood');
 add(9,9,'table',1);add(18,10,'benchWood',2);
 add(3,3,'treeOak');add(5,5,'table',1);
 return w;
}
const known=starter();
const at=(arr,x,z,y)=>arr.filter(o=>o.x===x&&o.z===z&&o.y===y);
function walk(arr,y,x,z,blockDoors=false){
 const accessible=(x,z)=>{const c=at(arr,x,z,y);
  return c.some(o=>floor(o)||o.type.startsWith('guildStair'))&&
    !c.some(o=>!floor(o)&&!(o.type.startsWith('guildStair')||o.type==='chairWood'||!blockDoors&&o.type.endsWith('Door')));
 };
 const q=[[x,z]],seen=new Set([coords(x,z)]);
 for(let i=0;i<q.length;i++)for(const [dx,dz] of dirs){
  const nx=q[i][0]+dx,nz=q[i][1]+dz,k=coords(nx,nz);
  if(!seen.has(k)&&accessible(nx,nz)){seen.add(k);q.push([nx,nz]);}
 }
 return seen;
}
test('design only replaces canonical guild interior of floors 2 and 3, preserving exterior, roof, and source',()=>{
 const before=JSON.stringify(known), next=design(known);
 assert.ok(next);assert.equal(JSON.stringify(known),before);
 const unchanged=o=>!inside(o)||![1,2].includes(o.y)||o.type.startsWith('guildStair');
 assert.equal(JSON.stringify(next.filter(unchanged)),JSON.stringify(known.filter(unchanged)));
 assert.equal(design(known.filter(o=>!(o.x===19&&o.z===17&&o.y===2&&o.type==='guildStairDown'))),null);
 assert.equal(design(known.filter(o=>!(o.x===7&&o.z===11&&o.y===1&&o.type==='stonewall'))),null);
 assert.equal(design(known.filter(o=>!(o.x===14&&o.z===20&&o.y===0&&o.type==='stonewallDoor'))),null);
 assert.equal(JSON.stringify(design(next)),JSON.stringify(next));
});
test('2F atrium has a clear uninterrupted floor rim with no duplicate authored railing',()=>{
 const next=design(known);
 for(let x=12;x<=17;x++)for(let z=11;z<=16;z++)assert.equal(at(next,x,z,1).length,0);
 for(let x=11;x<=18;x++)for(const z of [10,17])assert.ok(at(next,x,z,1).some(floor)&&at(next,x,z,1).every(floor));
 for(let z=10;z<=17;z++)for(const x of [11,18])assert.ok(at(next,x,z,1).some(floor)&&at(next,x,z,1).every(floor));
 assert.ok(!at(next,8,18,1).some(floor));
 const gallery=walk(next,1,8,17);
 for(const p of [[10,9],[19,8],[19,18],[19,17],[15,18],[9,15],[12,10],[11,14],[18,14]])assert.ok(gallery.has(coords(...p)),String(p));
});
test('3F has no gaps except stair and a closed guildmaster office reached from its own door',()=>{
 const next=design(known);
 for(let x=8;x<=21;x++)for(let z=7;z<=19;z++)assert.equal(at(next,x,z,2).some(floor),x!==19||z!==17);
 assert.ok(at(next,14,14,2).some(o=>o.type==='woodwallDoor'));
 assert.ok(at(next,14,9,2).some(o=>o.type==='counterLuxury')&&at(next,14,9,2).some(o=>o.type==='poiLedgerPapers'));
 assert.ok(at(next,14,8,2).some(o=>o.type==='chairWood'));
 const office=walk(next,2,14,12,true), open=walk(next,2,19,16);
 assert.ok(office.size>=20&&!office.has(coords(19,16)));
 for(const p of [[19,16],[14,15],[14,14],[14,12],[14,10],[13,8]])assert.ok(open.has(coords(...p)),String(p));
});
