const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
const vm=require('node:vm');
const {test}=require('node:test');
const html=readFileSync(process.argv[2]||'world-editor.html','utf8');
function analog(){
 const start=html.indexOf('// BEGIN LANDSCAPE ANALOG MATH');
 const end=html.indexOf('// END LANDSCAPE ANALOG MATH');
 assert.ok(start>=0&&end>start,'golden HTML declares testable stick math');
 return vm.runInNewContext(html.slice(start,end)+'; ({sample:poiAnalogSample,axes:poiAnalogAxes,carry:poiAnalogNextCarry})');
}
const json=x=>JSON.parse(JSON.stringify(x));
test('floating-stick dead zone, radial visual cap, and real camera-relative bearings',()=>{
 const {sample}=analog();
 assert.equal(sample(3,4,false,0),null);
 assert.deepEqual(json(sample(0,-400,false,0)),{dx:0,dz:-1,knobX:0,knobY:-44});
 assert.deepEqual(json(sample(0,-40,true,0)),{dx:0,dz:1,knobX:0,knobY:-40});
 const north=sample(0,-40,true,Math.PI/2);
 assert.ok(north.dx>0.99&&Math.abs(north.dz)<1e-8);
 const oblique=sample(28,-40,false,Math.PI/8);
 assert.ok(oblique.dx>0&&oblique.dz<0);
 assert.ok(Math.abs(Math.hypot(oblique.dx,oblique.dz)-1)<1e-8);
 assert.ok(Math.abs(Math.hypot(oblique.knobX,oblique.knobY)-44)<1e-8);
});
test('weighted cardinal substeps follow all angles without ever skipping cells',()=>{
 const {axes,carry}=analog();
 for(const [dx,dz] of [[1,0],[0,-1],[-1,0],[0,1],[3,-7],[-1,-1],[5,1],[-2,5]]){
  let c=.5,xs=0;
  for(let i=0;i<300;i++){
   const a=axes(dx,dz,c);
   assert.equal(Math.abs(a.primary[0])+Math.abs(a.primary[1]),1);
   if(a.alternate)assert.equal(Math.abs(a.alternate[0])+Math.abs(a.alternate[1]),1);
   if(a.primary[0]){xs++;assert.equal(a.primary[0],Math.sign(dx))}
   else assert.equal(a.primary[1],Math.sign(dz));
   c=carry(c,a.weight,a.primary[0]?'x':'z');
   assert.ok(c>=0&&c<=1);
  }
  assert.ok(Math.abs(xs-300*Math.abs(dx)/(Math.abs(dx)+Math.abs(dz)))<=1);
 }
 assert.equal(axes(1,.0001,.5).alternate,null,'a nominal cardinal direction does not slip sideways at a wall');
});
test('live Workshop uses the same walk transaction and captures independent touch ids',()=>{
 assert.match(html,/id="poiAnalogPad"[^>]*hidden/);
 assert.match(html,/function poiWalkStepWithFallback\(dx,dz,alternate=null\)/);
 assert.match(html,/poiWalkStepWithFallback\(\.\.\.choice\.primary,choice\.alternate\)/);
 assert.match(html,/poiAnalogPad\.setPointerCapture\(e\.pointerId\)/);
 assert.match(html,/\['pointerup','pointercancel','lostpointercapture'\]/);
});
