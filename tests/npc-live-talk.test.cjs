const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(x,z){
 const s=html.indexOf('// BEGIN NPC LIVE TALK'),e=html.indexOf('// END NPC LIVE TALK');
 a(s>=0&&e>s);
 const cort=(k,j)=>html.slice(html.indexOf(k),html.indexOf(j));
 const actor={x:1,z:0,y:0,shown:{x,z,y:0}};
 const c={poiTownNpcActors:[actor],poiTownNpcVisualPosition:a=>a.shown,
  poiAimWall:()=>c.wall,poiMonsterStates:new Map(),wall:()=>true,poiTownNpcGraph:()=>({cells:c.cells}),poiTownNpcKey:(x,z,y)=>[x,z,y].join(','),cells:new Map()};
 const choose=vm.runInNewContext(cort('// BEGIN ANGULAR COMBAT MATH','// END ANGULAR COMBAT MATH')+html.slice(s,e)+';poiTownDialogueLiveTarget',c);
 return {actor,c,choose};
}
test('live float bodies talk from oblique reach, rather than snapped cardinal next square',()=>{
 const f=fixture(.8,1),o={x:.2,z:.15,y:0,dir:{x:.6,z:.8}};
 a.equal(f.choose(o,10,()=>true,null),f.actor);
 f.actor.shown.x=1.9;a.equal(f.choose(o,10,()=>true,null),null);
});
test('relaxed side greeting still rejects rear, occupied rays and blocked exact diagonal corner',()=>{
 const f=fixture(1,1),o={x:0,z:0,y:0,dir:{x:0,z:1}};
 f.c.wall=(x,z)=>x!==0||z!==1;
 a.equal(f.choose(o,10,()=>true,null),null);
 f.c.wall=()=>true;f.actor.shown.z=-1;
 a.equal(f.choose(o,10,()=>true,null),null);
 f.actor.shown={x:0,z:1.4,y:0};f.c.poiMonsterStates.set({y:0},{x:0,z:1,hp:10});
 a.equal(f.choose(o,10,()=>true,null),null);
});
test('open conversation is retained as facing drifts, but not through a wall or between floors',()=>{
 const f=fixture(.8,1),o={x:0,z:0,y:0,dir:{x:0,z:-1}};
 a.equal(f.choose(o,10,()=>true,f.actor),f.actor);
 f.c.wall=()=>false;a.equal(f.choose(o,10,()=>true,f.actor),null);
 f.c.wall=()=>true;f.actor.y=1;a.equal(f.choose(o,10,()=>true,f.actor),null);
});

test('flexible street greeting cannot circumvent the authored countertop exception',()=>{
 const f=fixture(1.3,0),o={x:0,z:0,y:0,dir:{x:1,z:0}};
 f.c.cells.set('1,0,0',['counterLuxury']);a.equal(f.choose(o,10,()=>true,null),null);
 f.c.cells.delete('1,0,0');a.equal(f.choose(o,10,()=>true,null),f.actor);
});
