const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
const actor={x:2,z:4,y:0,fromX:1,fromZ:4,fromY:0,moveAt:100};
function fixture(){
 const m=html.match(/\/\/ BEGIN TOWN WALK VISUAL\n([\s\S]*?)\/\/ END TOWN WALK VISUAL/);assert.ok(m,'visual interpolation is present');
 const c=vm.createContext({POI_TOWN_RESIDENT_TICK:380,poiWalkX:2,poiWalkZ:4,poiWalkLevel:0});
 vm.runInContext(m[1],c);return c;
}
test('walker keeps moving through the old 340ms stop without overshoot',()=>{
 const c=fixture();
 const p=t=>c.poiTownNpcVisualPosition(actor,t);
 assert.equal(p(100).x,1);assert.equal(p(290).x,1.5);
 assert.ok(p(469).x>p(450).x&&p(469).x<2);
 assert.equal(p(480).x,2);assert.equal(p(881).x,2);
 assert.equal(actor.x,2);
});
test('stair and non-adjacent teleports never glide, close walk samples faster than distant',()=>{
 const c=fixture();
 assert.equal(c.poiTownNpcVisualPosition({...actor,y:1},250).x,2);
 assert.equal(c.poiTownNpcVisualPosition({...actor,x:8},250).x,8);
 assert.equal(c.poiTownNpcVisualCadence(actor,250),33);
 c.poiWalkX=20;assert.equal(c.poiTownNpcVisualCadence(actor,250),66);
 c.poiWalkX=40;assert.equal(c.poiTownNpcVisualCadence(actor,250),0);
});
test('successive cardinal steps alternate leg lead and return to neutral',()=>{
 const c=fixture(),next={...actor,x:3,fromX:2,moveAt:480};
 const a=c.poiTownNpcVisualStride(actor,.5),b=c.poiTownNpcVisualStride(next,.5);
 assert.ok(Math.abs(a)>.1); assert.equal(a,-b);
 assert.equal(c.poiTownNpcVisualStride(actor,1),0);assert.equal(c.poiTownNpcVisualStride(next,0),0);
});
