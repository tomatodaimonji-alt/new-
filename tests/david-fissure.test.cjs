const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
function harness(){
 const b={x:24,z:104,y:0,room:{minX:16,maxX:31,minZ:96,maxZ:112}},logs=[],live=new Set(),c={
  facilitySite:{id:'base',davidTemple:{boss:b}},poiWalkActive:true,poiWalkLevel:0,poiEnemyCueReduced:{matches:false},
  document:{hidden:false,querySelector:()=>null},poiAimOrigin:()=>({x:24,z:107,y:0}),poiDavidLine:()=>true,
  poiAimWall:()=>((x,z)=>!c.wall(x,z)),wall:()=>false,terrainY:(x,z)=>x===23?.25:0,
  mesh:()=>({p:[],c:[]}),quad(m,p,q,r,s,col){for(const v of [p,q,r,r,s,p]){m.p.push(...v);m.c.push(...col)}},
  gl:{enable(){},disable(){},depthMask(){},blendFunc(){},blendColor(...args){c.alpha=args[3]},deleteBuffer(buf){a(live.delete(buf));}},
  upload(m,buf){if(!buf){buf={};live.add(buf);c.uploads++}else a(live.has(buf));return {buf,count:m.p.length/3};},uploads:0,
  draw(_g,_vp,_start,n){logs.push([n,c.alpha])},POI_AIM_EPS:1e-7
 };
 const decal=h.includes('// BEGIN DAVID GROUND FISSURE')?cut('// BEGIN DAVID GROUND FISSURE','// END DAVID GROUND FISSURE'):'';
 const api=vm.runInNewContext(cut('const POI_DAVID_SWEEP_FORWARD=','function poiDavidLine(')+cut('function poiAimWallLimit(','function poiAimChooseLock(')+
  cut('// BEGIN DAVID STOMP IMPACT','function poiDavidDustGeometry')+decal+
  ';({stomp:poiDavidImpactStomp,draw:typeof poiDrawDavidFissure==="function"?poiDrawDavidFissure:null,geom:typeof poiDavidFissureGeometry==="function"?poiDavidFissureGeometry:null,reset:poiDavidClearHeavyFeedback})',c);
 return {api,c,b,logs,live};
}
test('the actual stomp generates a growing, fading fissure with one buffer, rejects leap and cleans up',()=>{
 const {api,c,logs,live}=harness(),q={kind:'stomp',sx:24,sz:104,y:0,dx:0,dz:1};a(api.draw,'no ground fracture visual');
 api.draw(999,[]);a.equal(logs.length,0);
 a(api.stomp(q,1000));
 api.draw(1040,[]);api.draw(1190,[]);api.draw(1400,[]);api.draw(1690,[]);
 a.equal(c.uploads,1);a.equal(live.size,1);a(logs[1][0]>logs[0][0]&&logs[2][0]>=logs[1][0]);
 a(logs[3][1]<logs[2][1]&&logs[2][1]<logs[0][1]);api.draw(1780,[]);a.equal(live.size,0);
 api.stomp({...q,davidLeapImpact:true},2000);api.draw(2100,[]);a.equal(logs.length,4);
 api.stomp(q,3000);api.draw(3075,[]);api.reset();api.draw(3080,[]);a.equal(live.size,0);
});
test('submitted cracks hug authored ground and never cross real wall, room/floor or six-tile reach',()=>{
 const {api,c,b}=harness();a(api.geom,'no ground fracture mesh');const e={x:24.94,z:104.70,sx:24,sz:104,y:0};
 const normal=api.geom(e,b);a(normal.p.length>=300&&normal.p.length<4400);
 c.wall=(x,z)=>z===106;const blocked=api.geom(e,b);a(blocked.p.length<normal.p.length);
 for(let i=0;i<blocked.p.length;i+=3){
  const [x,y,z]=blocked.p.slice(i,i+3);a(Math.hypot(x-24.5,z-104.5)<=6&&z<=106+1e-8);
  a(y>=.021&&y<=.272+1e-8);a(Math.abs(y-(Math.floor(x)===23?.25:0)-.021)<.002);
 }
 const none=api.geom({...e,y:1},b);a.equal(none.p.length,0);
});
