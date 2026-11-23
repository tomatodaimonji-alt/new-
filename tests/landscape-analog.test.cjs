const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function analog(){
 const start=html.indexOf('// BEGIN LANDSCAPE ANALOG MATH');
 const end=html.indexOf('// END LANDSCAPE ANALOG MATH');
 assert.ok(start>=0&&end>start,'golden HTML declares testable stick math');
 return vm.runInNewContext(html.slice(start,end)+'; ({sample:poiAnalogSample})');
}
const json=x=>JSON.parse(JSON.stringify(x));
test('floating-stick dead zone, radial visual cap, and real camera-relative bearings',()=>{
 const {sample}=analog();
 assert.equal(sample(3,4,false,0),null);
 assert.deepEqual(json(sample(0,-400,false,0)),{dx:0,dz:-1,knobX:0,knobY:-44,power:1});
 assert.deepEqual(json(sample(0,-40,true,0)),{dx:0,dz:1,knobX:0,knobY:-40,power:31/35});
 const north=sample(0,-40,true,Math.PI/2);
 assert.ok(north.dx>0.99&&Math.abs(north.dz)<1e-8);
 const oblique=sample(28,-40,false,Math.PI/8);
 assert.ok(oblique.dx>0&&oblique.dz<0);
 assert.ok(Math.abs(Math.hypot(oblique.dx,oblique.dz)-1)<1e-8);
 assert.ok(Math.abs(Math.hypot(oblique.knobX,oblique.knobY)-44)<1e-8);
});
test('live Workshop uses the same walk transaction and captures independent touch ids',()=>{
 assert.match(html,/id="poiAnalogPad"[^>]*hidden/);
 assert.match(html,/function poiWalkStepWithFallback\(dx,dz,alternate=null\)/);
 assert.match(html,/return poiWalkEnterCell\(dx,dz,now\)/);
 assert.match(html,/poiWalkEnterCell\(x-fromX,z-fromZ,now,true,onDoorCue\)/);
 assert.match(html,/poiAnalogPad\.setPointerCapture\(e\.pointerId\)/);
 assert.match(html,/\['pointerup','pointercancel','lostpointercapture'\]/);
});

