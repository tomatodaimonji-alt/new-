const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const test=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function fixture(){
 const map={format:'forest-world-v1',version:1,width:30,height:30,world:[],models:[],prefabs:[],checks:[{x:6,y:2,z:5,color:'#62bdf0'}]};
 for(let y=0;y<=2;y++)for(let z=6;z<=20;z++)for(let x=7;x<=22;x++){
  if(x===7||x===22||z===6||z===20)map.world.push({x,y,z,type:x===14&&z===20&&y===0?'stonewallDoor':'stonewall',rot:0});
  else map.world.push({x,y,z,type:'woodfloor',rot:0});
 }
 for(const [x,z,y,type] of [[8,18,0,'guildStairUp'],[8,18,1,'guildStairDown'],[19,17,1,'guildStairUp'],[19,17,2,'guildStairDown']])map.world.push({x,z,y,type,rot:0});
 return {id:'poi-adventurers-guild-v102',name:'冒険者ギルド',map};
}
function api(records){
 const src=html.slice(html.indexOf('function pineGuildRenewalSite('),html.indexOf('function pineGuildRenewalCutOwner('));
 assert(src.includes('function pineGuildRenewalSite('),'v111 isolated source builder missing');
 const before=JSON.stringify(records);
 const runtime=vm.runInNewContext(src+';pineGuildRenewalSite',{
   localStorage:{getItem(){return before},setItem(){throw Error('write forbidden')}},
   PINE_CUSTOM_POI_KEY:'world-workshop-pois-v1',PINE_ADVENTURERS_GUILD_ID:'poi-adventurers-guild-v102',
   PINE_ADVENTURERS_GUILD_NAME:'冒険者ギルド',
   pineValidateWorldData(m){return {newW:m.width,newH:m.height}},
   isFloor:t=>t.endsWith('floor'),
   pineGuildDesignUpperFloors:world=>world.map(t=>t.y===1&&t.x===9&&t.z===9?{...t,type:'stone'}:{...t})
 });
 return {runtime,before};
}
test('needs full shell and paired stair contract, produces a detached preview',()=>{
 const r=fixture();const {runtime,before}=api([r]);
 const site=runtime();
 assert(site);assert.equal(site.map.world.find(t=>t.x===9&&t.y===1&&t.z===9).type,'stone');
 assert.equal(JSON.stringify([r]),before);assert.equal(site.buildings.length,1);
 assert.equal(runtime().map.world.find(t=>t.x===9&&t.y===0&&t.z===9).type,'woodfloor');
 assert.equal(runtime().map.checks.length,1);
});
test('missing canonical, ambiguous same ID, missing 3F shell or upper stair fails closed',()=>{
 const r=fixture();
 assert.equal(api([]).runtime(),null);
 assert.equal(api([r,{...r,name:'他のPOI'}]).runtime(),null);
 const noShell=fixture();noShell.map.world=noShell.map.world.filter(o=>!(o.x===7&&o.z===8&&o.y===2));
 assert.equal(api([noShell]).runtime(),null);
 const noStair=fixture();noStair.map.world=noStair.map.world.filter(o=>o.type!=='guildStairDown'||o.y!==2);
 assert.equal(api([noStair]).runtime(),null);
});
test('separate user action and level-aware cache, legacy loader unused for this route',()=>{
 assert.match(html,/guildRenewalPreview/);
 assert.match(html,/guildRenewalRequested\?\(pineGuildRenewalSite\(\)/);
 assert.match(html,/facilitySite\.id==='guildrenewal'\?poiWalkLevel/);
 assert.match(html,/!guildRenewalRequested&&[^\n]*pineRepairDuplicateGuildPOIs\(\)/);
});
test('stock fallback uses the dormant starter geometry without touching persistent storage',()=>{
 const a=html.indexOf('function pineGuildDesignUpperFloors('),b=html.indexOf('function pineGuildRenewalCutOwner(');
 assert(a>=0&&b>a);
 const create=vm.runInNewContext(html.slice(a,b)+';pineGuildRenewalSample',{
  localStorage:{getItem(){throw Error('storage not allowed')},setItem(){throw Error('storage not allowed')}},
  pineValidateWorldData(m){return {newW:m.width,newH:m.height}}
 });
 const sample=create();
 assert(sample);assert.equal(sample.guildRenewalSource,'sample');
 assert(sample.map.world.some(o=>o.x===14&&o.z===20&&o.y===0&&o.type==='stonewallDoor'));
 assert(sample.map.world.some(o=>o.x===14&&o.z===9&&o.y===2&&o.type==='poiLedgerPapers'));
 assert(!sample.map.world.some(o=>o.x===14&&o.z===14&&o.y===1&&o.type==='woodfloor'));
 assert(sample.buildings[0].floorFootprints[1].some(o=>o.x===14&&o.z===14),'atrium remains under roof ownership but has no landing');
});
