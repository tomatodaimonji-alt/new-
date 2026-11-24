const a=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const get=()=>{
 const i=h.indexOf('// BEGIN LOCAL MINI CORE'),j=h.indexOf('// END LOCAL MINI CORE',i+1);
 a.ok(i>=0&&j>i,'local survey core is present');
 const c=vm.createContext({btoa,atob});
 return vm.runInContext(h.slice(i,j)+';({poiLocalCrop,poiLocalRay,poiLocalBits,poiLocalMark,poiLocalKnown,poiLocalEncode,poiLocalDecode,poiLocalView,poiLocalProject,poiLocalSightRadius})',c);
};
const copy=x=>JSON.parse(JSON.stringify(x));
test('crop stays player-centered with fixed 41 tiles next to world boundaries and shuffled view',()=>{
 const c=get();a.deepEqual(copy(c.poiLocalCrop(1,178)),{x1:-19,z1:158,x2:21,z2:198});
 const fixed=c.poiLocalCrop(20,50),left=c.poiLocalView(4,-999,-999),right=c.poiLocalView(4,999,999);
 a.deepEqual(copy(fixed),{x1:0,z1:30,x2:40,z2:70});
 a.deepEqual(copy(left),{zoom:4,x:0,z:0});a.deepEqual(copy(right),{zoom:4,x:30.75,z:30.75});
 a.deepEqual(copy(c.poiLocalProject(fixed,left)),{x1:0,z1:30,x2:10.25,z2:40.25});
 a.deepEqual(copy(c.poiLocalProject(fixed,right)),{x1:30.75,z1:60.75,x2:41,z2:71});
});
test('wall and closed door can be registered but cells beyond and clipped corners stay black',()=>{
 const c=get(),blocked=(x,z)=>x===3&&z===3;
 a.equal(c.poiLocalRay(2,3,3,3,blocked),true);
 a.equal(c.poiLocalRay(2,3,4,3,blocked),false);
 a.equal(c.poiLocalRay(2,3,3,4,blocked),false);
 a.equal(c.poiLocalRay(2,3,4,3,()=>false),true);
 a.equal(c.poiLocalSightRadius(false,0),8);a.equal(c.poiLocalSightRadius(true,0),6);a.equal(c.poiLocalSightRadius(false,.75),5);
});
test('packed survey observes extent, map/floor isolation and untrusted malformed saves',()=>{
 const c=get(),s=new Map(),bits=c.poiLocalBits();
 a.equal(c.poiLocalMark(bits,-1,1),false);a.equal(c.poiLocalMark(bits,128,9),false);
 a.equal(c.poiLocalMark(bits,47,160),true);a.equal(c.poiLocalMark(bits,47,160),false);
 c.poiLocalMark(bits,47,181);s.set('base:0:surface',bits);
 a.equal(c.poiLocalMark(bits,0,182),false);
 const encoded=c.poiLocalEncode(s),read=c.poiLocalDecode(encoded);
 a.ok(encoded.length<4200);
 a.equal(c.poiLocalKnown(read.get('base:0:surface'),47,160),true);
 a.equal(c.poiLocalKnown(read.get('base:0:surface'),47,159),false);
 a.equal(c.poiLocalKnown(read.get('base:-1:mine'),47,160),false);
 a.equal(c.poiLocalKnown(read.get('snowpass:0:surface'),47,160),false);
 a.equal(c.poiLocalDecode('{"version":1,"scopes":{"base:0:surface":"oops", "<img>":"a"}}').size,0);
});
test('HUD is a touch activation control and the expanded map is a native modal, not editor mode',()=>{
 a.match(h,/<button id="poiMiniOpen"[^>]+aria-controls="poiLocalMapDialog"/);
 a.match(h,/<dialog id="poiLocalMapDialog"/);
 a.match(h,/id="poiLocalMapZoomIn"/);a.match(h,/id="poiLocalMapZoomOut"/);
});
