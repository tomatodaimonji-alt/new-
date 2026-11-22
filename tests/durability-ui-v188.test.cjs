const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const slice=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)));
test('actual equipment only gets a non-interactive thin meter and exact percentage label',()=>{
 const nodes=[],m=()=>({dataset:{},style:{setProperty(k,v){this[k]=v}},setAttribute(k,v){this[k]=v},remove(){nodes.splice(nodes.indexOf(this),1)}});
 const host={querySelector:k=>k==='.poiDurabilityMeter'?nodes[0]:null,append:n=>nodes.push(n)};
 const c={document:{createElement:()=>m()},poiEquipmentDurabilityPercent:cell=>cell?.type==='kitchenKnife'?cell.p:null};
 vm.runInNewContext(slice('function poiInventoryDurabilityMeter(','function poiInventoryPresentItem('),c);
 const draw=p=>c.poiInventoryDurabilityMeter(host,{type:'kitchenKnife',p});
 for(const [p,tone] of [[100,'good'],[51,'good'],[50,'warn'],[26,'warn'],[25,'low'],[1,'low']]){
  draw(p);assert.equal(nodes.length,1);
  assert.equal(nodes[0].dataset.durabilityBand,tone);assert.equal(nodes[0].dataset.durabilityPercent,String(p));
  assert.equal(nodes[0].style['--durability-progress'],p+'%');assert.equal(nodes[0]['aria-hidden'],'true');
 }
 c.poiInventoryDurabilityMeter(host,{type:'healingHerb',count:4});assert.equal(nodes.length,0);
 assert.match(html,/\.poiDurabilityMeter\{position:absolute;[^}]*height:3px;[^}]*pointer-events:none/);
 assert.match(html,/poiInventoryPresentItem\(button,cell,true\)/);
 assert.match(html,/耐久.*percent\+'%'/);
});
test('equipment-break cue is distinct dry bounded PCM through the existing effect bus',()=>{
 const c={};vm.runInNewContext(slice('function poiEquipmentBreakPcm(','const poiSurfaceFoleyCache='),c);
 const wood=c.poiSurfaceFoleyPcm('breakWood',24000),metal=c.poiSurfaceFoleyPcm('breakMetal',24000),cloth=c.poiSurfaceFoleyPcm('breakCloth',24000);
 for(const pcm of [wood,metal,cloth]){
  const peak=Math.max(...pcm.map(Math.abs));
  assert(pcm.length>=.09*24000&&pcm.length<.19*24000);
  assert(peak>.12&&peak<.70);assert(Math.abs(pcm.at(-1))<.001);
 }
 assert.notDeepEqual(wood,metal);assert.notDeepEqual(wood,cloth);
 assert.match(html,/kind==='equipment-break'[\s\S]{0,330}poiPlayImpactBuffer\(poiSurfaceFoley\(material\),now\+\(material==='breakCloth' \? \.055 : \.145\),\.66\)/);
});
