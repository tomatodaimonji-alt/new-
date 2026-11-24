const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);return i>=0&&j>i?h.slice(i,j):''}
test('portable optical filaments start at live eye sockets, end at original impact, and clip nearer new obstruction',()=>{
 const f=cut('function poiOrvasPortableBeamVisual(','function poiDrawOrvasPlayerBeam(');
 a(f,'portable has a live mounted-socket renderer rather than the archived initial shot mesh');
 const tubes=[],ctx={mesh:()=>({p:[]}),poiAimWall:()=>()=>true,poiAimWallLimit:(_o,_d,max)=>max,
  poiOrvasWallContact:()=>null,poiOrvasDualTube:(_m,x,z,d,_from,L,y,H)=>tubes.push([x,y,z,x+d.x*L,H,z+d.z*L])};
 vm.createContext(ctx);vm.runInContext(f,ctx);
 const effect={rays:[{x:5,z:5,h:1,visualLimit:12,visualEnd:10,visualHeight:.2},{x:5,z:5.31,h:1,visualLimit:12,visualEnd:9,visualHeight:.5}],d:{x:1,z:0},level:0};
 const sockets=[[5.6,1.7,5.45],[5.76,1.7,5.73]];
 ctx.poiOrvasPortableBeamVisual(effect,sockets);
 a.deepEqual(tubes.map(r=>r.slice(0,3)),sockets);
 for(const [i,end] of [[0,[15.5,.2,5.5]],[1,[14.5,.5,5.81]]])for(let j=0;j<3;j++)a(Math.abs(tubes[i][j+3]-end[j])<1e-9);
 ctx.poiOrvasWallContact=()=>({at:2});tubes.length=0;
 ctx.poiOrvasPortableBeamVisual(effect,sockets);
 for(const [i,r] of tubes.entries())a(Math.abs(Math.hypot(r[3]-sockets[i][0],r[5]-sockets[i][2])-1.992)<1e-9);
});
test('visible eye sockets share the rigid mount and stay behind normal depth-test order',()=>{
 const source=cut("if(weapon==='equipOrvasHead'){"," const prop=mesh();");
 a(source.includes('m.orvasEyeSockets=')&&source.includes('poiOrvasTrophyBase'));
 const scene=h.indexOf('if(!poiPlayerDeath||poiPlayerDeath.relocated)poiDrawWalkAvatar(p.vp,now)');
 a(scene>=0&&h.indexOf('poiDrawOrvasPlayerBeam(now,p.vp);',scene)>scene);
 const beam=cut('function poiDrawOrvasPlayerBeam(','const POI_PLAYER_WEAPON');
 a(!beam.includes('gl.disable(gl.DEPTH_TEST)'));
});
