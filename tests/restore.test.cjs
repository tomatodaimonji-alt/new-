const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const test=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function span(a,b){
 const i=html.indexOf(a),j=html.indexOf(b,i+a.length);
 assert(i>=0&&j>i,a);return html.slice(i,j);
}
function api(){
 const context={MAX_MAP:128,MAX_LEVEL:9,URLSearchParams};
 return vm.runInNewContext(span('function workshopResumeDecode(', 'function workshopResumeRead(')+
  ';({decode:workshopResumeDecode,allows:workshopResumePermitted})',context);
}
test('cold starts allow a bounded checkpoint; explicit target or arbitrary query wins',()=>{
 const {allows}=api();
 for(const v of ['', 'revision=17600000', 'resume=1&test=1'])assert(allows(new URLSearchParams(v)),v);
 for(const v of ['facility=lodging','facility-return=1','editor=1','facility=kitchen&resume=1','test=1','other=1','resume=0','revision=arbitrary'])assert(!allows(new URLSearchParams(v)),v);
});
test('metadata sanitizer rejects unknown modes and unsafe positions, drops all map payloads',()=>{
 const {decode}=api();const make=o=>decode(JSON.stringify({version:1,route:'facility',id:'base',play:true,position:{x:7,z:9,y:-1,facing:2},...o}));
 assert.equal(make({world:[{type:'junk'}]}).world,undefined);
 assert.equal(make({}).position.y,-1);
 assert.equal(make({position:{x:-1,z:9,y:0,facing:2}}).position,null);
 assert.equal(make({position:{x:5,z:7,y:50,facing:2}}).position,null);
 assert.equal(make({route:'https://elsewhere.test/'}),null);
 assert.equal(decode('x'.repeat(1601)),null);
});
test('ordinary resume cannot rewrite the saved guild through old startup migrations',()=>{
 assert.match(html,/!workshopResume&&[^\n]+pineRepairDuplicateGuildPOIs\(\)/);
 assert.match(html,/!workshopResume&&[^\n]+!pineDuplicatePOIBackups\.length/);
 assert.match(html,/function workshopResumeRestorePosition/);
 assert.match(html,/world-workshop-resume-v1/);
});
