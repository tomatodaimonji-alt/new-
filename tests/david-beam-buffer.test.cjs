const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
test('successive real beam renders reuse and release a real upload handle, not a mesh descriptor',()=>{
 const live=new Set(),frames=[],deletes=[];let id=0;
 const q={kind:'beam',sx:24,sz:104,y:0,dx:0,dz:-1,start:0,hits:[1000],cursor:0,lastContactAt:null,sweep:null};
 const boss={x:24,z:104,y:0,room:{minX:13,maxX:35,minZ:93,maxZ:115,arena:{x:24,z:104,radius:16.95,minZ:93.5}}},s={hp:1050,david:{attack:q}},o={};
 const c={poiDavidActive:{o,s},poiDavidMatch:()=>boss,poiEnemyThreatEnabled:()=>true,poiWalkLevel:0,poiAimOrigin:()=>({x:24,z:101,y:0}),poiWalkDoorOpen:null,world:[],poiEnemyCueReduced:null,
  poiDavidBeamRay:(_,angle)=>({x:Math.sin(angle),z:-Math.cos(angle)}),poiDavidBeamReach:()=>8,
  poiAimWall:()=>()=>true,poiAimWallLimit:(_p,_q,n)=>n,poiEnemyCuePoint:(x,z,y)=>[x,y,z],terrainY:()=>0,
  mesh:()=>({p:[],n:[],c:[]}),quad(m,p,q,r,s,col){for(const v of [p,q,r,r,s,p]){m.p.push(...v);m.n.push(0,1,0);m.c.push(...col)}},
  tri(m,p,q,r,col){for(const v of [p,q,r]){m.p.push(...v);m.n.push(0,1,0);m.c.push(...col)}},
  gl:{STATIC_DRAW:1,DYNAMIC_DRAW:2,ARRAY_BUFFER:3,
   createBuffer(){const b={id:++id};live.add(b);return b;},
   bindBuffer(_,b){a(live.has(b),'WebGL expects the live WebGLBuffer, not the GPU mesh descriptor');},
   bufferData(){},blendColor(){},enable(){},disable(){},blendFunc(){},depthMask(){},
   deleteBuffer(b){a(live.delete(b),'releases each buffer once');deletes.push(b)}
  },
  draw:m=>{if(m.coreCount)frames.push(m.buf);},
 };
 const upload=h.split('\n').find(line=>line.startsWith('function upload(m,reuse=null,usage=gl.STATIC_DRAW)'));
 a(upload,'use actual application uploader');
 const paint=vm.runInNewContext(upload+'\n'+cut('const POI_DAVID_SWEEP_FORWARD=','function poiDavidLine(')+cut('const POI_DAVID_BEAM_GROW=','function poiDavidBeamAdvance(')+cut('// BEGIN DAVID TEMPLE CUES','// END DAVID TEMPLE CUES')+'\npoiDrawDavidCue',c);
 paint(930,[]);
 q.cursor=1;q.lastContactAt=1000;q.sweep={side:1,tell:1000,start:null,end:null,angle:0,done:false};
 paint(1250,[]);
 q.sweep.start=1450;q.sweep.end=2130;q.sweep.angle=.2;paint(1500,[]);
 q.sweep.angle=.6;paint(1700,[]);
 a.equal(frames.length,8,'core and sheath submit native geometry in growing, held, and two moving frames');a(frames.every(b=>b===frames[0]));a.equal(deletes.length,0);
 c.poiDavidActive=null;paint(1750,[]);
 a.equal(live.size,0);a(deletes.includes(frames[0]));
});
