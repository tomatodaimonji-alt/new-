const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function runtime(){
 const start=h.indexOf('// BEGIN UNIFORM OUTDOOR POLICY');
 const end=h.indexOf('// END UNIFORM OUTDOOR POLICY');
 a.ok(start>=0&&end>start,'private prototype introduces a common real-region policy');
 const c=vm.createContext({poiSquareFieldAt:(x,z)=>x>=128||z>=182||x>=72&&z>=128||x>=48&&z>=168});
 vm.runInContext(h.slice(start,end),c);return c;
}
test('same global foot radius produces the same class blend irrespective of realm origin or camera',()=>{
 const c=runtime();
 assertRank(0,[1,0,0]);assertRank(18,[1,0,0]);assertRank(21,[.5,.5,0]);
 assertRank(24,[0,1,0]);assertRank(30,[0,1,0]);assertRank(42,[0,0,1]);assertRank(48,[0,0,0]);
 function assertRank(d,weights){a.deepEqual(Array.from(c.poiUniformOutdoorWeights(48,139,48+d,139)),weights)}
 a.deepEqual(Array.from(c.poiUniformOutdoorWeights(48,139,36,155)),Array.from(c.poiUniformOutdoorWeights(48,139,60,123)));
});
test('stock Base only backs real unrepresented field; same-region streamed gaps and foreign chunk gaps need backing',()=>{
 const c=runtime(), covered=new Set(['base:10,16','snowpass:0,0']);
 a.equal(c.poiUniformOutdoorMissing('base','base',false,covered,'base:10,15',85,126),false);
 a.equal(c.poiUniformOutdoorMissing('base','base',false,covered,'base:10,17',85,137),true);
 a.equal(c.poiUniformOutdoorMissing('base','base',true,covered,'base:10,17',85,137),true);
 a.equal(c.poiUniformOutdoorMissing('base','base',true,covered,'base:10,16',85,131),false);
 a.equal(c.poiUniformOutdoorMissing('base','snowpass',false,covered,'snowpass:0,0',0,0),false);
 a.equal(c.poiUniformOutdoorMissing('snowpass','base',true,covered,'base:10,17',85,137),true);
});
