const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const context=()=>{
 const lo=h.indexOf('// BEGIN UNIFORM SPLIT GROUND'),hi=h.indexOf('// END UNIFORM SPLIT GROUND');
 a(lo>=0&&hi>lo,'terrain and optional structure must have independent keys and pressure priority');
 const c=vm.createContext({POI_UNIFORM_SHELL:true,facilityParams:new URLSearchParams('uniform-split=1')});
 vm.runInContext(h.slice(lo,hi),c);return c;
};
test('all ground jobs have priority over nearer and more expensive landmarks',()=>{
 const c=context(),j=[{key:'a',d:2,kind:'props'},{key:'c',d:12,kind:'ground'},
  {key:'b',d:4,kind:'ground'},{key:'d',d:10,kind:'props'}];
 a.equal(Array.from(j.sort(c.poiSplitOrder).map(q=>q.key)).join(','),'b,c,a,d');
});
test('new optional prop may never evict required ground; required terrain can evict far props before ground',()=>{
 const c=context(),k=new Map([['near-ground',{kind:'ground',d:3}],['far-ground',{kind:'ground',d:40}],
  ['far-wall',{kind:'props',d:30}],['near-prop',{kind:'props',d:5}]]);
 a.equal(c.poiSplitVictim(k,'props',8),'far-wall');
 a.equal(c.poiSplitVictim(k,'ground',45),'far-wall');
 k.delete('far-wall');k.delete('near-prop');
 a.equal(c.poiSplitVictim(k,'props',5),null);
 a.equal(c.poiSplitVictim(k,'ground',45),null);
 a.equal(c.poiSplitVictim(k,'ground',7),'far-ground');
});
test('far roof and wall keep true height, footprint and roof underside while reducing triangles',()=>{
 const get=(x,y)=>h.slice(h.indexOf(x),h.indexOf(y,h.indexOf(x)));
 const cv=vm.createContext({facilitySite:{davidTemple:{ring:{x:24,z:158}}},
  tri:(m,x,y,z)=>m.push(x,y,z),quad:(m,w,x,y,z)=>m.push(w,x,y,w,y,z),
  cube:(m,x,y,z,w,h,d)=>m.push([x-w/2,y,z-d/2],[x+w/2,y+h,z+d/2])});
 vm.runInContext(get('function poiDavidRoundWall(','function poiDavidDomeGeometry(')+get('function poiDavidSacredRoofGeometry(','function poiDavidTunnelArt('),cv);
 const sizes=(f,at)=>[false,true].map(low=>{const m=[];f(m,...at,low);return {n:m.length,axis:[0,1,2].map(i=>{
  const v=m.map(p=>p[i]);return [Math.min(...v),Math.max(...v)];})}});
 for(const [f,origin] of [[cv.poiDavidRoundWall,[40.5,0,158.5]],[cv.poiDavidSacredRoofGeometry,[24.5,158.5]]]){
  const [d,l]=sizes(f,origin);a(l.n<d.n*.6,{d,l});
  for(let i=0;i<3;i++)for(let s=0;s<2;s++)a(Math.abs(d.axis[i][s]-l.axis[i][s])<.08,{d,l});
 }
});
