const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const rolesFile=process.env.ROLES;
const src=html.slice(html.indexOf('const FACILITY_SITES=Object.freeze('),html.indexOf('function workshopResumeDecode('));
const map=vm.runInNewContext(src+';buildFacilitySite("base")');
const data=rolesFile?fs.readFileSync(rolesFile,'utf8'):html.slice(html.indexOf('const POI_TOWN_RESIDENT_ROLES='),html.indexOf('const POI_TOWN_INN_BEDS=')+'const POI_TOWN_INN_BEDS=POI_TOWN_INN.beds;'.length);
const {roles,inn}=vm.runInNewContext(data+';({roles:POI_TOWN_RESIDENT_ROLES,inn:POI_TOWN_INN})');
const things=new Map(),K=(x,z,y)=>[x,z,y].join(',');
for(const o of map.map.world){
 const k=K(o.x,o.z,o.y);
 if(!things.has(k))things.set(k,[]);things.get(k).push(o.type);
}
const at=({x,z,y})=>things.get(K(x,z,y))||[];
const ground=/^(?:woodfloor(?:Dark|Light)?|brickfloor|plasterfloor|stone|earth|road\w+|grass\w*|moss)$/;
const free=/Door$|^(?:guildStair(?:Up|Down)|poiFortGate|poiCanalQuay|lantern|chairWood|chairClassic|stoolRound|benchWood|flowerField|bushFlower|tallGrass|guildFacadeSign)$/;
const water=new Set([...map.creek.deep,...map.canal.water].map(({x,z})=>K(x,z,0)));
for(const crossing of [...map.creek.crossings,...map.canal.bridgePairs.flat()])water.delete(K(crossing.x,crossing.z,0));
const deck=/^bridgeStone(?:End)?$/;
function open(x,z,y){
 if(x<0||z<0||x>=map.map.width||z>=map.map.height||water.has(K(x,z,y)))return false;
 const cell=things.get(K(x,z,y))||[];
 if(y!==0&&!cell.some(o=>ground.test(o)||/^guildStair/.test(o)))return false;
 const door=cell.some(o=>/Door$/.test(o));
 return cell.every(o=>ground.test(o)||free.test(o)||deck.test(o)||door&&o==='poiWallSconce'||o==='river'&&cell.some(t=>deck.test(t)));
}
function connected(from,to){
 const start=[from.x,from.z,from.y],target=K(to.x,to.z,to.y);
 const waiting=[start],seen=new Set([K(...start)]);
 for(let i=0;i<waiting.length;i++){
  const [x,z,y]=waiting[i];if(K(x,z,y)===target)return true;
  const cell=things.get(K(x,z,y))||[],n=[[x-1,z,y],[x+1,z,y],[x,z-1,y],[x,z+1,y]];
  for(const [up,down,dy] of [['guildStairUp','guildStairDown',1],['guildStairDown','guildStairUp',-1]]){
   if(cell.includes(up)&&(things.get(K(x,z,y+dy))||[]).includes(down))n.push([x,z,y+dy]);
  }
  for(const next of n)if(!seen.has(K(...next))&&open(...next)){seen.add(K(...next));waiting.push(next);}
 }
 return false;
}
test('actual built map has eight distinct usable resident anchor pairs, including both paired inn stairs',()=>{
 assert.equal(roles.length,8);
 assert.equal(roles.filter(r=>r.role==='keeper').length,6);
 assert.equal(new Set(roles.map(r=>K(r.bed.x,r.bed.z,r.bed.y))).size,8);
 for(const r of roles){
  assert(at(r.bed).includes('bed'),r.id);
  assert.equal(r.bed.y,r.home.y,r.id);
  assert.equal(Math.abs(r.bed.x-r.home.x)+Math.abs(r.bed.z-r.home.z),1,r.id);
  for(const point of [r.home,r.work,r.public])assert(open(point.x,point.z,point.y),r.id+' has a blocked station');
  assert(connected(r.home,r.work),r.id+' has no home to work route');
 }
});
test('the inn uses a genuine checkout and keeps one upstairs guest bed available without using the host’s bed',()=>{
 const host=roles.find(r=>r.id===inn.hostId);
 assert(open(inn.desk.x,inn.desk.z,inn.desk.y));
 assert(at({x:inn.desk.x,z:inn.desk.z-1,y:0}).includes('counterWood'));
 assert(inn.beds.every(b=>b.y===1&&at(b).includes('bed')&&K(b.x,b.z,b.y)!==K(host.bed.x,host.bed.z,host.bed.y)));
 assert.equal(inn.beds.filter(b=>!b.residentId).length,1);
 for(const bed of inn.beds)assert(connected(inn.desk,bed.stand),bed.id);
});
