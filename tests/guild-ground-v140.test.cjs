const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
const src=html.match(/const FACILITY_SITES[\s\S]*?(?=function facilityNavigate\()/)[0];
const {sample,design,build}=vm.runInNewContext(src+';({build:buildFacilitySiteLegacyFrame,sample:pineGuildSampleMap,design:pineGuildDesignUpperFloors})');
const site=build('base'),guild=site.buildings.find(b=>b.id==='townGuild');
const loc=JSON.parse(JSON.stringify(site.map.world.filter(o=>o.x>=guild.x1&&o.x<=guild.x2&&o.z>=guild.z1&&o.z<=guild.z2).map(o=>({...o,x:o.x-20,z:o.z+4}))));
const inside=o=>o.x>7&&o.x<22&&o.z>6&&o.z<20;
const protectedPart=o=>o.y!==0||!inside(o)||/^woodfloor|^guildStair/.test(o.type);
const signature=rows=>Array.from(rows,o=>[o.x,o.z,o.y,o.type,o.rot].join(',')).sort();
const at=(x,z,type,rot)=>loc.some(o=>o.y===0&&o.x===x&&o.z===z&&o.type===type&&(rot===undefined||o.rot===rot));
test('the editable town guild alone rearranges furniture, never the original sample, exterior, floors, or stairs',()=>{
 const past=design(sample().world).filter(o=>o.x>=7&&o.x<=22&&o.z>=6&&o.z<=20&&!/^grass/.test(o.type));
 assert.deepEqual(signature(loc.filter(protectedPart)),signature(past.filter(protectedPart)));
 assert(at(10,12,'guildWallQuestBoard',0));
 assert(at(11,12,'woodwall'), 'two-tile board rests on both supported timber tiles');
 assert(at(13,9,'chairWood',0)&&at(15,9,'chairWood',0));
 assert(at(13,10,'poiLedgerPapers',0)&&at(15,10,'poiLedgerPapers',0));
 assert(at(8,14,'benchWood',3)&&at(8,16,'benchWood',3)&&at(21,16,'benchWood',1));
 assert(at(18,14,'chairWood',3)&&at(20,14,'chairWood',1));
 assert(at(21,7,'guildLatrine',0)&&at(21,9,'kitchenSink',1));
 assert.match(html,/if\(facilitySite\?\.id==='base'\)return;\s*\/\/ Remove the old automatic rear-wall quest board/);
});
test('occupied chairs and benches still leave reception flanks, notices, workroom, toilet, and both stair approach tiles reachable',()=>{
 const blocking=loc.filter(o=>o.y===0&&!/^woodfloor|Door$|^guildStair|^guildFacadeSign$/.test(o.type));
 const can=(x,z)=>x>=8&&x<=21&&z>=7&&z<=19&&!blocking.some(o=>o.x===x&&o.z===z);
 const keys=new Set(['14,19']),q=[[14,19]];
 for(let i=0;i<q.length;i++)for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const x=q[i][0]+dx,z=q[i][1]+dz,k=x+','+z;
  if(!keys.has(k)&&can(x,z)){keys.add(k);q.push([x,z]);}
 }
 for(const [x,z] of [[14,11],[17,10],[14,8],[11,8],[10,8],[9,8],[9,10],[10,13],[9,14],[9,16],[8,18],[8,19],[18,8],[19,8],[21,8],[20,9],[20,16],[19,13],[19,15]])
  assert(keys.has(x+','+z),'inaccessible '+x+','+z);
 const room=loc.filter(o=>o.y===0&&o.type==='woodwallDoor');
 assert.deepEqual(signature(room),['11,8,0,woodwallDoor,3','18,8,0,woodwallDoor,1']);
 for(const o of loc.filter(o=>o.y===0&&o.type==='poiWallSconce'))
  assert(loc.some(p=>p.x===o.x&&p.z===o.z&&p.y===0&&/^(?:woodwall|stonewall)$/.test(p.type)),'lamp mounted on solid wall');
});
