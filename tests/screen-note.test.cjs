const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const {test}=require('node:test');
const vm=require('node:vm');
const h=readFileSync(process.argv[2]||'world-editor.html','utf8');
function brush(){
 const a=h.indexOf('// BEGIN SCREEN NOTE BRUSH'),b=h.indexOf('// END SCREEN NOTE BRUSH',a);
 assert.ok(a>=0&&b>a,'screen-only annotation brush');
 return vm.runInNewContext(h.slice(a,b)+'; ({point:poiScreenNotePoint,segment:poiScreenNoteSegment})');
}
const iso=v=>JSON.parse(JSON.stringify(v));
test('pen maps the actual touch into the right canvas position and uses restrained pressure',()=>{
 const {point}=brush(),rect={left:20,top:9,width:480,height:300};
 assert.deepEqual(iso(point({clientX:260,clientY:159,pointerType:'touch',pressure:.5},rect)),{x:.5,y:.5,p:.5});
 assert.deepEqual(iso(point({clientX:1100,clientY:-7,pointerType:'touch',pressure:0},rect)),{x:1,y:0,p:.5});
 assert.equal(point({clientX:10,clientY:10,pointerType:'pen',pressure:.12},rect).p,.12);
});
test('midpoint-stabilized strokes are continuous and arrive at the last real touch point',()=>{
 const {segment}=brush(),points=[{x:.1,y:.2,p:.4},{x:.2,y:.7,p:.5},{x:.7,y:.4,p:.6},{x:.9,y:.9,p:.3}];
 const first=segment(points,1),next=segment(points,2),last=segment(points,3),tail=segment(points,points.length);
 assert.deepEqual(iso(first.start),iso(points[0]));
 assert.deepEqual(iso(first.end),iso(next.start));
 assert.deepEqual(iso(next.end),iso(last.start));
 assert.deepEqual(iso(last.end),iso(tail.start));
 assert.deepEqual(iso(tail.end),iso(points.at(-1)));
 assert(iso(last).weight>1&&iso(last).weight<3);
});
test('annotation is landscape-scoped and never calls save, upload, or picture delivery',()=>{
 assert.ok(h.includes('data-landscape-action="note">画面にメモする'));
 const render=h.slice(h.indexOf('function render(){'),h.indexOf(' poiTownClockFrame(now);poiWalkFrame(now);'));
 assert.match(render,/if\(poiScreenNoteFrozen\(\)\)\s*(?:return;|\{[^}]*return;\s*\})/);
 const a=h.indexOf('// BEGIN SCREEN NOTE UI'),b=h.indexOf('// END SCREEN NOTE UI',a);
 assert.ok(a>=0&&b>a);
 const code=h.slice(a,b);
 assert.match(code,/setPointerCapture\(e\.pointerId\)/);
 assert.match(code,/hasAttribute\('data-analog-play'\)/);
 assert.match(code,/poiScreenNoteStrokeList\.pop\(\)/);
 assert.doesNotMatch(code,/localStorage|sessionStorage|fetch\(|\btoDataURL\b|\bsave\w*\(/i);
});
