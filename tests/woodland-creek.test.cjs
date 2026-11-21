const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),test=require('node:test');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function run(s,id){
 const a=s.indexOf('const FACILITY_SITES=Object.freeze('),b=s.indexOf('function workshopResumeDecode(',a);
 assert(a>=0&&b>a);
 return JSON.parse(JSON.stringify(vm.runInNewContext(s.slice(a,b)+';buildFacilitySite('+JSON.stringify(id)+')')));
}
const key=(x,z)=>x+','+z;
test('a continuous narrow woodland creek leaves the base, trail, other routes and building stamps intact',()=>{
 const site=run(html,'base');
 assert.ok(site.creek,'authored creek metadata missing');
 assert.deepEqual([site.map.width,site.map.height],[96,56]);
 const start=html.indexOf('  // Woodland creek:');
 const end=html.indexOf('  spawn={x:19,z:21};',start);
 const baseline=html.slice(0,start)+html.slice(end);
 for(const id of ['lodging','kitchen','workshop','artisan','stable','homes','toolshop']) assert.deepEqual(run(html,id),run(baseline,id),id);
 const old=run(baseline,'base');
 assert.deepEqual([site.buildings,site.spawn],[old.buildings,old.spawn]);
 const all=new Set(site.map.world.map(JSON.stringify));
 assert.deepEqual(old.map.world.filter(o=>!all.has(JSON.stringify(o))),[{x:68,z:38,type:'grassPebbles',rot:0,y:0}]);
 const cells=new Set(site.creek.deep.map(p=>key(p.x,p.z)));
 const stack=[site.creek.deep[0]],reached=new Set();
 while(stack.length){
  const {x,z}=stack.pop(),k=key(x,z);
  if(!cells.has(k)||reached.has(k))continue;
  reached.add(k);
  for(const [dx,dz] of [[0,1],[0,-1],[1,0],[-1,0]])stack.push({x:x+dx,z:z+dz});
 }
 assert.equal(reached.size,cells.size,'cardinally connected bends');
 assert(cells.size>=42&&cells.size<=52);
 assert(Object.values(Object.groupBy(site.creek.deep,o=>o.z)).every(row=>row.length<=2));
 assert(site.creek.deep.some(o=>o.x===73&&o.z===27),'water emerges between mossy stones');
 assert(site.creek.deep.some(o=>o.z===55),'water exits at the south edge');
 for(const {x,z} of site.creek.deep)assert(site.map.world.some(o=>o.x===x&&o.z===z&&o.y===0&&o.type==='river'));
 for(const [x,z] of [[67,38],[70,38],[71,38],[70,39],[69,40]])assert(!cells.has(key(x,z)));
});
test('level trail crosses low stone deck; dry wash apron has solid access without outdoor stair or raised terrain',()=>{
 const {creek,map}=run(html,'base');
 assert.ok(creek);
 assert.deepEqual(creek.crossings,[
  {x:68,z:38,type:'bridgeStoneEnd',rot:3},
  {x:69,z:38,type:'bridgeStoneEnd',rot:1}
 ]);
 for(const tile of creek.crossings)assert.deepEqual(map.world.filter(o=>o.x===tile.x&&o.z===tile.z&&o.y===0).map(o=>o.type),['river',tile.type]);
 assert.deepEqual(creek.wash,{x:69,z:40});
 assert.deepEqual(creek.sound,{x:68,z:39});
 assert(map.world.some(o=>o.x===69&&o.z===40&&o.y===0&&o.type==='roadCutStoneFull'));
 assert(!map.world.some(o=>o.x===70&&o.z===40&&o.y===0&&o.type==='terrainStairs'));
 assert.deepEqual(map.terrainHeights,[]);
 for(const x of [70,71])assert(map.world.some(o=>o.x===x&&o.z===38&&o.y===0&&o.type==='grassPebbles'));
 assert.equal(map.world.filter(o=>o.z===38&&o.y===0&&o.x>=67&&o.x<=71).length,7);
});
test('creek bridge has one unified deck with an open underside and never affects ordinary placements',()=>{
 const a=html.indexOf('function facilityWoodlandBridgeGeometry('),b=html.indexOf('function bridgeConnectedGeometry(',a);
 assert(a>=0&&b>a,'missing scoped creek bridge geometry');
 const primitive=html.slice(html.indexOf('function tri('),html.indexOf('function diamond('));
 const {creek}=run(html,'base'),crossings=creek.crossings.map(o=>({...o,y:0}));
 const ctx=vm.createContext({facilitySite:{id:'base',creek},mesh:{p:[],n:[],c:[]},crossings});
 const invoke=`(index,ok=true)=>facilityWoodlandBridgeGeometry(mesh,crossings[index],new Map(crossings.slice(0,ok?2:1).map(o=>[o.x+','+o.z,o])),new Map(crossings.map(o=>[o.x+','+o.z,'river'])))`;
 const draw=vm.runInContext(primitive+html.slice(a,b)+invoke,ctx);
 assert.equal(draw(1),true);
 assert.equal(ctx.mesh.p.length,0,'east bridge tile must not draw a duplicate deck');
 assert.equal(draw(0,false),false,'incomplete edited bridge uses normal rendering');
 ctx.facilitySite.id='kitchen';assert.equal(draw(0),false);
 ctx.facilitySite.id='base';assert.equal(draw(0),true);
 const points=[];for(let i=0;i<ctx.mesh.p.length;i+=3)points.push(ctx.mesh.p.slice(i,i+3));
 assert(points.length>100);
 assert(points.every(([x,y,z])=>x>=68&&x<=70&&y>=0&&z>=38&&z<=39));
 const underside=points.filter(([x,y])=>x>68.7&&x<69.3&&y<.13);
 assert(underside.length>0);
 assert(underside.every(([,y])=>y>.06),'arch must leave open air above the water center');
 assert(points.some(([,y])=>y===.14),'walkway top uses agreed avatar height');
 assert.match(html,/BRIDGE_IDS\.has\(o.type\)\)\{\s*if\(!facilityWoodlandBridgeGeometry\(m,o,bridgeLookup,floors\)\)/);
});
test('creek water is seamless, subdued and cheap without changing other water materials',()=>{
 const n=html.indexOf('function facilityWoodlandWater('),e=html.indexOf('function roadRect(',n);
 assert(n>=0&&e>n,'missing creek-only surface');
 const items=new Map([['68,38','river'],['69,38','river']]);
 const ctx=vm.createContext({items,Map,Set,surfaceNoise:(x,z)=>Math.abs(Math.sin(x*5+z*3)),near:new Set(items.keys())});
 const primitive=html.slice(html.indexOf('function tri('),html.indexOf('function diamond('));
 const draw=vm.runInContext(primitive+html.slice(n,e)+`;((x,z)=>{
 const m={p:[],n:[],c:[]};facilityWoodlandWater(m,x,z,items,near);return m;
 })`,ctx);
 const [a,b]=[draw(68,38),draw(69,38)];
 for(const m of [a,b]){
  assert(m.p.length>=18&&m.p.length<=36,'only the water plane and at most one flat ripple');
  assert(m.c.every(v=>v>=.12&&v<=.63),'subdued colors, not bright cyan');
 }
 const edge=(m,x,z)=>{for(let i=0;i<18;i+=3)if(m.p[i]===x&&m.p[i+2]===z)return Array.from(m.c.slice(i,i+3));return null;};
 for(const z of [38,39])assert.deepEqual(edge(a,69,z),edge(b,69,z),'neighboring tiles share both geometry and color at the edge');
 assert.match(html,/if\(woodlandRiver\(x,z\)\)facilityWoodlandWater/);
});
