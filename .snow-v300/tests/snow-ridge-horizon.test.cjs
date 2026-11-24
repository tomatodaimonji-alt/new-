const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function b(x,y){const i=h.indexOf(x),j=h.indexOf(y,i+1);if(i<0||j<0)throw Error('snow horizon not authored');return h.slice(i,j)}
test('snow is a sparse south-aligned outdoor skyline and hands off before the true snow seam',()=>{
 const c=vm.createContext({});vm.runInContext(b('// BEGIN SOUTH SNOW HORIZON','// END SOUTH SNOW HORIZON')+
 b('function mult(a,b)','function draw(mesh,vp')+b('function perspective(', 'function '),c);
 const style=()=>({p:[],n:[],c:[]}),tri=(m,...v)=>m.p.push(...v[0],...v[1],...v[2]);
 c.mesh=style;c.tri=tri;
 const g=c.poiSnowHorizonMesh();a.ok(g.p.length/3>=30&&g.p.length/3<=192);
 const points=[];for(let j=0;j<g.p.length;j+=3)points.push(g.p.slice(j,j+3));
 a(points.every(([x,y,z])=>x>=44&&x<=78&&y>=-1&&y<=15&&z>=148&&z<=165));
 a(points.some(([x,y])=>Math.abs(x-60)<3&&y>=11));
 a.equal(c.poiSnowHorizonOpacity('base',0,true,49,108),.87);
 a(c.poiSnowHorizonOpacity('base',0,true,60,129)<.87);
 for(const args of [['base',0,true,60,136],['snowpass',0,true,49,108],['base',-1,true,49,108],['base',0,false,49,108]])a.equal(c.poiSnowHorizonOpacity(...args),0);
 const vp=(eye,target)=>c.mult(c.perspective(Math.PI/3,2,.45,200),c.look(eye,target));
 a(c.poiSnowHorizonInFrame(vp([50,2,94],[50,1,103])));
 a(!c.poiSnowHorizonInFrame(vp([50,2,103],[50,1,94])));
 a(!c.poiSnowHorizonInFrame(vp([50,2,100],[90,1,100])));
});
