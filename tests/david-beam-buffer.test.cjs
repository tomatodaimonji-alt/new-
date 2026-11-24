const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(x,y)=>{const i=h.indexOf(x),j=h.indexOf(y,i+x.length);a(i>=0&&j>i,x);return h.slice(i,j)};
test('successive real beam renders reuse and release a real upload handle, not a mesh descriptor',()=>{
 const live=new Set(),frames=[],deletes=[];let id=0;
 const q={kind:'beam',sx:24,sz:104,y:0,dx:0,dz:-1,start:0,hits:[1000],cursor:1,lastContactAt:1000,sweep:{side:1,start:1450,end:2130,angle:.2,done:false}};
 const boss={room:{minX:16,maxX:31,minZ:96,maxZ:112}},s={hp:1050,david:{attack:q}},o={};
 const c={poiDavidActive:{o,s},poiDavidMatch:()=>boss,poiEnemyThreatEnabled:()=>true,poiWalkLevel:0,poiDavidIn:()=>true,poiAimOrigin:()=>({}),poiWalkDoorOpen:null,world:[],poiEnemyCueReduced:null,
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
  draw:m=>frames.push(m.buf),
 };
 const upload=h.split('\n').find(line=>line.startsWith('function upload(m,reuse=null,usage=gl.STATIC_DRAW)'));
 a(upload,'use actual application uploader');
 const paint=vm.runInNewContext(upload+'\n'+cut('// BEGIN DAVID TEMPLE CUES','// END DAVID TEMPLE CUES')+'\npoiDrawDavidCue',c);
 paint(1500,[]);
 q.sweep.angle=.6;paint(1700,[]);
 a.equal(frames.length,4,'core and sheath each submit native geometry');a(frames.every(b=>b===frames[0]));a.equal(deletes.length,0);
 c.poiDavidActive=null;paint(1750,[]);
 a.equal(live.size,0);a(deletes.includes(frames[0]));
});
