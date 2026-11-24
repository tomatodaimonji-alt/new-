const {test}=require('node:test'),a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8'),optional=process.env.STOCK&&fs.readFileSync(process.env.STOCK,'utf8');
const cut=(s,x,y)=>{const i=s.indexOf(x),j=s.indexOf(y,i+x.length);a(i>=0&&j>i,x);return s.slice(i,j)};
function get(s){
 return vm.runInNewContext(cut(s,'const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+
  ';const base=buildFacilitySite("base");base.id="base";const fixed=base.map.world.slice();poiSnowPassSeam(base,base.map.world);'+
  '({base,fixed,snow:poiSnowPassMap(),link:poiSnowPassLink,neighbors:poiOverlandAdjacentEdge,open:poiSnowEdgeWalkable})',
  {isFloor:t=>/^(grass|road|earth|poiSnowGround|water|river|sea)/.test(t)});
}
const q=get(h),old=optional?get(optional.replace('function poiSnowPassLink(region','function poiOverlandAdjacentEdge(){} function poiSnowEdgeWalkable(){} function poiSnowPassLink(region')):null;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
test('all genuinely walkable north and west landings are reciprocal, obstacles and void remain solid',()=>{
 const {base,snow,link,open}=q;
 let north=0,west=0;
 for(let x=48;x<72;x++){
  const s=link('base',x,138,0,x,139);a.equal(s.x,x-48);a.equal(s.z,0);a.equal(s.facing,2);
  const b=link('snowpass',s.x,s.z,0,s.x,-1);a.deepEqual([b.x,b.z,b.facing],[x,138,0]);
  a(open(base.map.world,x,138));
  if(open(snow.map.world,s.x,0))north++;
 }
 for(let z=139;z<168;z++){
  const s=link('base',47,z,0,48,z);a.deepEqual([s.x,s.z,s.facing],[0,z-139,1]);
  const b=link('snowpass',s.x,s.z,0,-1,s.z);a.deepEqual([b.x,b.z,b.facing],[47,z,3]);
  if(open(base.map.world,47,z)&&open(snow.map.world,0,z-139))west++;
 }
 a.equal(north,23);a.equal(west,29);
 a(open(snow.map.world,7,0),'real open Snow x7 is reachable straight across from Base x55');
 a(snow.map.world.some(o=>o.x===15&&o.z===0&&o.y===0&&o.type==='rockMossy'));
 a(!open(snow.map.world,15,0),'Base x63 points at an actual blocking Snow rock, not an invented entrance');
 for(const args of [['base',72,138,0,72,139],['base',47,168,0,48,168],['base',49,138,1,49,139],['base',48,138,0,49,139]])
  a.equal(link(...args),null);
 a.deepEqual(JSON.parse(JSON.stringify(link('snowpass',23,3,0,24,3))),{region:'base',x:72,z:142,y:0,facing:1});
 a.deepEqual(JSON.parse(JSON.stringify(link('snowpass',2,28,0,2,29))),{region:'base',x:50,z:168,y:0,facing:2});
 const custom=[{id:'a',ox:0,oz:0,owns:(x,z)=>x===0&&z===0},{id:'b',ox:0,oz:1,owns:(x,z)=>x===0&&z===0}];
 a.equal(q.neighbors(custom,'a',0,0,0,0,1).region,'b');
 a.equal(open([{type:'poiSnowGround',x:0,z:0,y:0},{type:'rockMossy',x:0,z:0,y:0}],0,0),false);
 a.equal(open([{type:'water',x:0,z:0,y:0}],0,0),false);
});
test('legacy snow authored content and its bounds are exact; stock base outside frontage untouched',()=>{
 if(old){a.equal(hash(q.fixed),hash(old.fixed));a.equal(hash(q.snow),hash(old.snow));}
 a.equal(hash(q.snow),'daa1dbdd951646dc3ba4d4562158508051300f5dd16f2a4ddd6a0dfbf11af253');
 a.deepEqual([q.snow.map.width,q.snow.map.height],[24,29]);
 a(!h.includes('poiSnowHorizonMesh')&&!h.includes('facilityDrawSnowHorizon'),'no fictional mountain geometry');
 a.match(h,/poiSnowTempleNeighborDraw\(p.vp\)/);
});
test('actual biome edge colors have shared coordinates and unsnapped light at both borders',()=>{
 const c=vm.createContext({smoothSurfaceNoise:()=>.5});
 vm.runInContext(cut(h,'function poiSnowFrostAmount(','function poiTownSceneLight('),c);
 const b=[.4,.5,.37],s=[.86,.91,.96],t=(region,x,z,kind,stock)=>c.poiSnowGroundEdgeTint(region,x,z,kind,null)(x,z,stock);
 for(const [gx,gz,sx,sz] of [[60,139,12,0],[68,139,20,0],[48,150,0,11],[48,165,0,26]])
  a.equal(JSON.stringify(t('base',gx,gz,'grass',b)),JSON.stringify(t('snowpass',sx,sz,'poiSnowGround',s)));
 a.equal(c.poiSnowBiomeLightWeight(12,-.5),0);a.equal(c.poiSnowBiomeLightWeight(-.5,12),0);
 a(c.poiSnowBiomeLightWeight(12,3)>.3&&c.poiSnowBiomeLightWeight(12,3)<.7);
 a.equal(c.poiSnowBiomeLightWeight(12,13),1);
});
