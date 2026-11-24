const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const ix=(t)=>h.indexOf(t);
test('committed discovery stays integer, live HUD follows same interpolated world position before draw',()=>{
 a.match(h,/poiLocalFrame=poiLocalCapture\(poiWalkX,poiWalkZ,floor,/);
 a.match(h,/poiWalkFrame\(now\);if\(typeof poiMiniMotionFrame==='function'\)poiMiniMotionFrame\(\)/);
 a.match(h,/poiLocalOverlay=\{frame:\{\.\.\.poiLocalFrame,marker:poiLocalMotionPoint\(poiLocalFrame\)\},view:/);
});
test('fractional camera uses the same global point on either side of logical tile commit',()=>{
 const i=ix('function poiLocalHudProjection('),j=ix('function poiLocalHudTerrain(');a(i>=0&&j>i);
 const c=vm.createContext({});vm.runInContext(h.slice(i,j),c);
 const a0={x:49,z:119,crop:{x1:29,z1:99}},a1={x:50,z:120,crop:{x1:30,z1:100}},hud={shift:32,scale:144/41};
 const q={x:49.5,z:119.5},first=c.poiLocalHudProjection(a0,hud,q),last=c.poiLocalHudProjection(a1,hud,q);
 for(const key of ['x1','z1','dx','dz'])a(Number.isFinite(first[key]));
 a.equal(first.x1,last.x1);a.equal(first.z1,last.z1);a(Math.abs(first.dx-last.dx-hud.scale)<1e-10);a(Math.abs(first.dz-last.dz-hud.scale)<1e-10);
 const third=c.poiLocalHudProjection(a0,hud,{x:49.2,z:119.3});a(third.x1>29&&third.x1<29.5&&third.z1>99&&third.z1<99.5);
});
