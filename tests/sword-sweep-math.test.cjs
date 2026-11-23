const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync(process.env.SWORD_TEST_HTML||require('node:path').join(__dirname,'../world-editor.html'),'utf8');
const ang=html.slice(html.indexOf('// BEGIN ANGULAR COMBAT MATH'),html.indexOf('// END ANGULAR COMBAT MATH'));
function invoke(expression){return vm.runInNewContext(ang+'\n'+expression);}
test('sword reaches the requested flanks and forward boundary, not behind or just beyond',()=>{
 const hits=invoke(`typeof poiSwordSweepContains==='function'&&[
  [.2,-1.48],[1.29,1.49],[1.30,0],[-.02,0],[1.31,0],[.8,1.51],[.8,-1.51]
 ].map(([z,x])=>poiSwordSweepContains({x:0,z:0},{x:0,z:1},{x,z}))`);
 assert.deepEqual(JSON.parse(JSON.stringify(hits)),[true,true,true,false,false,false,false]);
});
test('the sweep envelope rotates with analog aim rather than keeping map-facing axes',()=>{
 const hits=invoke(`typeof poiSwordSweepContains==='function'&&[
  {x:2.8,z:2.99},{x:3.01,z:2.9},{x:1.35,z:1.36}
 ].map(p=>poiSwordSweepContains({x:1,z:2},{x:.8,z:.6},p))`);
 assert.deepEqual(JSON.parse(JSON.stringify(hits)),[false,false,false]);
 const diagonal=invoke(`poiSwordSweepContains({x:1,z:2},{x:.8,z:.6},{x:2.87,z:1.53})`);
 assert.equal(diagonal,true);
});
