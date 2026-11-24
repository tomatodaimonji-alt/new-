const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const i=h.indexOf('// BEGIN SNOW PASS PROTOTYPE'),j=h.indexOf('// END SNOW PASS PROTOTYPE',i);
a.ok(i>=0&&j>i,'sector contract is installed');
const c=vm.runInNewContext(h.slice(i,j)+';({link:poiSnowPassLink,decode:poiSnowPassDecode,map:poiSnowPassMap})'),plain=v=>JSON.parse(JSON.stringify(v));
test('only exact directed edge can activate another local region and land in bounds',()=>{
 a.deepEqual(plain(c.link('base',49,127,0,49,128)),{region:'snowpass',x:12,z:0,y:0,facing:2});
 a.deepEqual(plain(c.link('snowpass',12,0,0,12,-1)),{region:'base',x:49,z:127,y:0,facing:0});
 for(const q of [['base',48,127,0,48,128],['base',49,127,-1,49,128],['base',48,127,0,49,128],['base',49,127,0,49,126],['snowpass',12,0,0,12,1],['unknown',12,0,0,12,-1]])a.equal(c.link(...q),null);
});
test('legacy/unknown/invalid version-1 resumes do not activate the snow sector',()=>{
 const initial={version:1,route:'facility',id:'base',play:true},p={x:14,z:12,y:0,facing:2},snow={...initial,region:'snowpass',regionHp:41};
 a.deepEqual(plain(c.decode(initial,p)),{});a.deepEqual(plain(c.decode(snow,p)),{region:'snowpass',regionHp:41});
 for(const [s,q] of [[{...snow,region:'capital'},p],[{...snow,play:false},p],[snow,{...p,z:29}],[snow,{...p,y:-1}]])a.deepEqual(plain(c.decode(s,q)),{position:null});
});
test('small pass has real cardinal route, exact return landing, no actors or remote content',()=>{
 const {map,snowRoute}=c.map();a.deepEqual([map.width,map.height],[24,29]);a.ok(map.world.length<800&&snowRoute.length>30);
 for(let i=0;i<snowRoute.length;i++){
  const q=snowRoute[i];a.equal(map.world.filter(o=>o.x===q.x&&o.z===q.z).map(o=>o.type).join(','),'roadGravelFull');
  if(i){const p=snowRoute[i-1];a.equal(Math.abs(p.x-q.x)+Math.abs(p.z-q.z),1)}
 }
 a.ok(map.world.every(o=>!o.type.startsWith('monster')));
});

test('ground save encoding separates exact same coordinates in base and snow',()=>{
 const begin=h.indexOf('// BEGIN SNOW GROUND NAMESPACE'),end=h.indexOf('// END SNOW GROUND NAMESPACE',begin);
 const env={facilitySite:{id:'base'}};
 const bag=vm.runInNewContext(h.slice(begin,end)+';({read:poiSnowGroundDecode,write:poiSnowGroundSave,match:poiSnowGroundMatch})',env);
 const herb={x:12,z:2,y:0,type:'healingHerb'},snow={...herb,count:2},other={...herb,x:24};
 const list=bag.read([herb],[snow,other]);a.equal(list.length,2);
 a.deepEqual(plain(list.filter(bag.match)),[herb]);
 env.facilitySite={id:'snowpass'};
 a.deepEqual(plain(list.filter(bag.match)),[{...snow,region:'snowpass'}]);
 const coins=bag.read([{x:12,z:2,y:0,amount:1}],[{x:12,z:2,y:0,amount:3}]);
 a.deepEqual(plain(bag.write(list,coins)),{drops:[herb],snowDrops:[snow],groundGold:[{x:12,z:2,y:0,amount:1}],snowGroundGold:[{x:12,z:2,y:0,amount:3}]});
});
