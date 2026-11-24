const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const s=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const c=vm.createContext({isFloor:()=>false,rot2:(x,z,r)=>[[x,z],[z,-x],[-x,-z],[-z,x]][r],RESIDENTIAL_ROOFS:new Set,AUTO_ROOFS:new Set,isWallId:t=>t.endsWith('Wall'),terrainY:()=>0});
vm.runInContext(s.slice(s.indexOf('// v102: Baked floor contact shading'),s.indexOf('// v102: a single lightweight')),c);
const white=[.4,.4,.4];
const sample=(objs,x,z,y=0)=>{
 const {lamps,blockers}=c.pineFloorLightingSources(objs),m={p:[x,0,z],c:white.slice()};
 c.pineBakeFloorLighting(m,Math.floor(x),Math.floor(z),y,blockers,lamps);return m.c;
};
const street={x:0,z:0,y:0,type:'poiStreetLamp'},candle={x:0,z:0,y:0,type:'candleStand'},wall={x:1,z:0,y:0,type:'stoneWall'};
test('street and candle spill have visible amber energy, exact floor and a bounded radius',()=>{
 const street1=sample([street],1.65,.5),candle1=sample([candle],1.48,.5);
 assert.ok(street1[0]-.4>.15&&street1[0]-street1[2]>.12,JSON.stringify(street1));
 assert.ok(candle1[0]-.4>.12&&candle1[0]-candle1[2]>.09,JSON.stringify(candle1));
 assert.deepEqual(sample([street],4.75,.5),white);
 const lantern={...street,type:'lantern'};
 assert.deepEqual(sample([lantern],.5,.5,1),white);
});
test('an opaque partition stops warm spill without removing existing contact shading',()=>{
 const bare=sample([wall],2.05,.5),shadow=sample([wall,street],2.05,.5);
 assert.deepEqual(shadow,bare);assert.ok(sample([street],2.05,.5)[0]>white[0]);
});
test('only visible wall face receives bounced amber',()=>{
 const w={x:1,z:0,y:0,type:'stoneWall'},data=c.pineFloorLightingSources([street,w]);
 const m={p:[1.02,.85,.5,1.98,.85,.5],n:[-1,0,0,1,0,0],c:[...white,...white]};
 assert.equal(typeof c.pineBakeWallWarmth,'function');
 c.pineBakeWallWarmth(m,0,w,data.blockers,data.lamps);
 assert.ok(m.c[0]-white[0]>.11,JSON.stringify(m.c));assert.deepEqual(m.c.slice(3),white);
});
test('a wall-mounted temple candle has the authored emitting side and does not light another storey',()=>{
 const mount={x:1,z:0,y:1,type:'poiDavidCandleSconce',rot:0};
 const w={...mount,y:0,type:'poiDavidWallRound'};
 const data=c.pineFloorLightingSources([mount,w]);
 assert.equal(data.lamps.length,1);
 const [l]=c.pineWarmNear(data.lamps,2,0,0);assert.ok(l.x>2&&l.x<2.2);
 const bare=sample([w],.62,.50),shadow=sample([w,mount],.62,.50);
 assert.deepEqual(shadow,bare);
 assert.ok(sample([w,mount],2.33,.50)[0]>.62);
 assert.deepEqual(sample([w,mount],2.33,.50,-1),white);
 assert.deepEqual(sample([w,mount],2.33,.50,1),white);
});
