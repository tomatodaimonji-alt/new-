const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const h=fs.readFileSync(process.env.WORLD_HTML||'world-editor.html','utf8');
const cut=(a,b)=>{const i=h.indexOf(a),j=h.indexOf(b,i+a.length);assert(i>=0&&j>i,a);return h.slice(i,j)};
test('visible soul command vocabulary is exact and never uses a modal/dialog input grab',()=>{
 const panel=cut('<section id="poiCompanionCommands"','<dialog id="poiItemDetail"');
 assert.deepEqual([...panel.matchAll(/data-companion-command="([^"]+)"[^>]*>([^<]+)<\/button>/g)].map(x=>x.slice(1,3)),
 [['fight','戦いを優先'],['follow','追尾優先'],['dismiss','魂に戻す'],['back','戻る']]);
 assert.match(panel,/aria-modal="false" hidden/);
 assert.match(panel,/data-companion-command="summon" hidden/);
 const helpers=cut('function poiCompanionUiOpen(','function poiCompanionHudSync(');
 assert.doesNotMatch(helpers,/showModal|poiStopRepeat|poiWandDisarm/);
});
function setup(active=null,mode=null){
 const cells=Array(27).fill(null);cells[2]={type:'slimeSoul',durability:19,count:1};cells[5]={type:'orvasSoul',durability:87,count:1};
 const base={weapon:'equipIronSword',slots:cells,worn:{torso:'starterTunic'},companionSoul:{version:1,pending:'skeletonSoul',active,mode}};
 const c=vm.createContext({
  p:base,poiCompanionAllowed:()=>true,poiHotbarRead:()=>c.p,poiInventorySlots:k=>k.slots,
  poiCompanionType:x=>typeof x==='string'&&x.endsWith('Soul')?{hp:111}:null,poiEconomyWrite:k=>(c.p=k,true),
  poiCompanionActor:null,poiCompanionTarget:null,performance:{now:()=>300},
  poiCompanionUse:(k,i)=>(assert.equal(k.companionSoul.active,k.slots[i].type),c.p={...k,companionSoul:{...k.companionSoul,active:null}},{ok:true}),
 });
 vm.runInContext(cut('function poiCompanionNormalizeMode(','function poiCompanionReconcile(')+cut('const POI_COMPANION_MODES=','function poiCompanionTethered('),c);
 return {c,base};
}
test('old aliases normalize while no unrecognized command changes the active token',()=>{
 const {c}=setup('slimeSoul','flee');
 for(const [raw,mode] of [['escape','follow'],['flee','follow'],['follow','follow'],['auto','fight'],['fight','fight']])
  assert.equal(c.poiCompanionDecode({version:1,active:'slimeSoul',mode:raw}).mode,mode);
 assert.equal(c.poiCompanionMode(),'follow');
 assert.equal(c.poiCompanionCommand('invalid',300,'orvasSoul').ok,false);
 assert.equal(c.p.companionSoul.active,'slimeSoul');
});
test('only explicit summon can activate exact selected token, dismiss preserves equipment and durability',()=>{
 const {c,base}=setup('slimeSoul','flee');
 assert.equal(c.poiCompanionCommand('follow',300,'orvasSoul').ok,false);
 assert.equal(c.poiCompanionCommand('summon',300,'orvasSoul').ok,true);
 assert.equal(c.p.companionSoul.active,'orvasSoul');
 assert.equal(c.p.companionSoul.mode,'fight');
 assert.equal(c.poiCompanionCommand('follow',300,'orvasSoul').ok,true);
 assert.equal(c.p.companionSoul.mode,'follow');
 assert.equal(c.p.companionSoul.pending,'skeletonSoul');
 assert.equal(c.p.weapon,'equipIronSword');assert.equal(c.p.slots,base.slots);
 assert.equal(c.poiCompanionCommand('dismiss',300,'slimeSoul').ok,false);
 assert.equal(c.poiCompanionCommand('dismiss',300,'orvasSoul').ok,true);
 assert.equal(c.p.companionSoul.active,null);assert.equal(c.p.slots[5].durability,87);
});
