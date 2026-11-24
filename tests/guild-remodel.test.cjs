const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(p,q){const i=h.indexOf(p),j=h.indexOf(q,i+p.length);a(i>=0&&j>i,'actual source '+p);return h.slice(i,j)}
function rig(extra={}){
 const site=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+';buildFacilitySite("base")');
 const c=vm.createContext(extra);vm.runInContext(cut('// BEGIN TOWN GUILD REMODEL','// END TOWN GUILD REMODEL'),c);
 return {c,site};
}
test('actual fit-out keeps all metadata and collision footprints; adds only selective visible material and furniture moves',()=>{
 const {c,site}=rig(),before=JSON.stringify(site.map.world);
 const renovated=c.poiTownGuildRemodel(site),g=site.buildings.find(b=>b.id==='townGuild');
 a(renovated.guildRemodel);
 a.equal(JSON.stringify(site.map.world),before,'editor/stock source remains pristine');
 a.equal(renovated.buildings,site.buildings);a.equal(site.map.width,renovated.map.width);
 a.deepEqual([g.entrance.x,g.entrance.z],[56,38]);
 const key=o=>[o.x,o.z,o.y,o.type].join(','), collision=o=>!/^(?:woodfloor|benchWood)/.test(o.type);
 a.deepEqual(renovated.map.world.filter(collision).map(key),site.map.world.filter(collision).map(key));
 for(const p of [[56,28,0,'counterWood'],[56,38,0,'stonewallDoor'],[52,30,0,'guildWallQuestBoard'],[50,36,0,'guildStairUp'],[50,36,1,'guildStairDown'],[61,35,1,'guildStairUp'],[61,35,2,'guildStairDown']])
  a(renovated.map.world.some(o=>key(o)===p.join(',')),p.join());
 for(let z=30;z<38;z++)a(renovated.map.world.some(o=>o.x===56&&o.z===z&&o.y===0&&o.type==='woodfloorLight'));
 a(renovated.map.world.some(o=>o.x===51&&o.z===33&&o.y===0&&o.type==='benchWood'));
});
test('base alone has real warm cladding and an entry hood, without touching unrelated or sample art',()=>{
 const seen=[],{c,site}=rig({wallBlock:(...args)=>seen.push(['wall',args[1]]),deco:(...args)=>seen.push(['deco',args[1]]),
  cube:(...args)=>seen.push(['cube',args[2]]),quad:()=>seen.push(['quad']),naturalBranch:()=>seen.push(['branch']),
  terrainY:()=>0});
 c.facilitySite={...c.poiTownGuildRemodel(site),id:'base'};const bits={visible:[true,true,true,true],exterior:[true,true,true,true]};
 a(c.poiTownGuildCladding({p:[],c:[]},{x:56,z:38,y:1,type:'stonewall',rot:0},bits));
 a.deepEqual(seen[0],['wall','plasterwall']);
 a(c.poiTownGuildCladding({p:[],c:[]},{x:56,z:38,y:0,type:'stonewallDoor',rot:0},bits));
 a(seen.some(o=>o[0]==='quad'),'real rain hood has face geometry');
 a.equal(c.poiTownGuildCladding({p:[],c:[]},{x:65,z:38,y:0,type:'stonewall',rot:0},bits),false);
 c.facilitySite={...c.facilitySite,id:'guildsaved'};
 a.equal(c.poiTownGuildCladding({p:[],c:[]},{x:56,z:38,y:0,type:'stonewallDoor',rot:0},bits),false);
});
test('civic roof uses the same tile family and eaves with a modest real pitch, normalized lighting',()=>{
 const m={p:[],n:[]},neighbors=new Map();let called=false;
 const {c}=rig({terrainY:()=>0,residentialRoofGeometry(mesh,group,lookup,town){
  called=town&&lookup===neighbors;
  mesh.p.push(4,4.24,3,4,5.24,4);mesh.n.push(0,1,0,.6,.8,0);
 }});
 c.poiTownGuildRoof(m,[{x:4,z:3,y:3,type:'roofHip'}],neighbors);
 a.equal(called,true);a(Math.abs(m.p[1]-4.24)<1e-6);
 a(m.p[4]>5.5&&m.p[4]<5.8);a(Math.abs(Math.hypot(...m.n.slice(3))-1)<1e-6);
});
