const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const stock=fs.readFileSync(process.env.STOCK||'stock.html','utf8'),h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(s,x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+x.length);a(i>=0&&j>i,x);return s.slice(i,j)};
const get=s=>vm.runInNewContext(cut(s,'const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+
 ';const b=buildFacilitySite("base");b.id="base";poiSnowPassSeam(b,b.map.world);({base:b,snow:poiSnowPassMap(),route:typeof poiSnowSleeveRoute==="function"?poiSnowSleeveRoute():[],link:poiSnowPassLink,own:typeof poiSnowSleeveOwn==="function"?poiSnowSleeveOwn:null})');
const old=get(stock),q=get(h),key=o=>o.x+','+o.z+','+o.y;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const world=vm.runInNewContext(cut(h,'// BEGIN OVERLAND STREAM PLANNING','// END OVERLAND STREAM PLANNING')+';({p:poiOverlandGlobal,l:poiOverlandLocal,queue:poiOverlandQueue})');
test('new east sleeve keeps every published tile and real old snow coordinate',()=>{
 a.equal(digest(q.base.map.world.slice(0,old.base.map.world.length)),digest(old.base.map.world));
 a.equal(digest(q.snow),digest(old.snow));
 const add=q.base.map.world.slice(old.base.map.world.length);
 a.equal(add.length,176);a(add.every(o=>o.y===0&&q.own(o.x,o.z)));
 a.equal(new Set(add.map(key)).size,add.length);
 const route=[{x:49,z:127,y:0},...q.route];
 a.deepEqual([...Object.values(route.at(-1))],[60,138,0]);
 for(let i=1;i<route.length;i++){
  const p=route[i],prev=route[i-1];a.equal(Math.abs(p.x-prev.x)+Math.abs(p.z-prev.z),1);
  a(add.some(o=>key(o)===key(p)&&o.type==='roadGravelFull'));
 }
});
test('projected physical Snow rectangle is disjoint even versus the sacred ground, reciprocal exit unchanged region semantics',()=>{
 const own=(x,z)=>z<128||x<48||q.own(x,z),occupied=new Set(q.base.map.world.map(o=>o.x+','+o.z));
 for(let z=0;z<q.snow.map.height;z++)for(let x=0;x<q.snow.map.width;x++){
  const pos=world.p('snowpass',x,z);a(!own(...pos));a(!occupied.has(pos.join(',')));a.equal(world.l('snowpass',...pos).join(','),x+','+z);
 }
 a.equal(world.p('snowpass',12,0).join(','),'60,139');
 a.equal(q.link('base',60,138,0,60,139).region,'snowpass');a.equal(q.link('snowpass',12,0,0,12,-1).x,60);
 a.equal(q.link('snowpass',12,0,0,12,-1).z,138);a.equal(q.link('base',49,127,0,49,128),null);
 a.equal(q.link('base',60,138,-1,60,139),null);
 const areas=[{id:'base',width:128,height:182,owns:own},{id:'snowpass',width:24,height:29}],tiles=world.queue(areas,60,138);
 a(tiles.some(t=>t.id==='snowpass')&&tiles.some(t=>t.id==='base'));
 a(tiles.filter(t=>t.id==='base').every(t=>own(t.x0,t.z0)));
});
test('stored snow local coordinates (including old west shoulder) and scoped new base saves decode distinctly',()=>{
 const f=vm.runInNewContext(cut(h,'const FACILITY_SITES=Object.freeze(','function workshopResumePermitted(')+';workshopResumeDecode',{MAX_MAP:128,MAX_LEVEL:9,POI_SACRED_DEPTH_H:182,POI_SACRED_DEPTH_W:48});
 const read=(x,z,region,y=0)=>f(JSON.stringify({version:1,route:'facility',id:'base',play:true,region,position:{x,z,y,facing:0},townLayout:5,townMapHeight:182}));
 a.equal(read(0,12,'snowpass').position.x,0);a.equal(read(0,12,'snowpass').region,'snowpass');
 for(const p of [[49,127],[60,138],[24,158]])a.equal(read(...p).position.z,p[1]);
 for(const p of [[65,138],[60,139],[48,140],[60,128,undefined,-1]])a.equal(read(...p).position,null);
});
