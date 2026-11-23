const assert=require('node:assert/strict'),{test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function cut(a,b){const x=html.indexOf(a),y=html.indexOf(b,x+1);assert(x>=0&&y>x,a);return html.slice(x,y)}
const main=vm.runInNewContext(cut('const FACILITY_SITES=Object.freeze(','function workshopResumeDecode(')+";buildFacilitySite('base')");
const point=p=>[p.x,p.z,p.y];
const clock=minute=>({minute,absoluteMinute:1440+minute});
function setup({camp=true,hold=false}={}){
 const site={...main,id:'base',northTrail:{...main.northTrail,scoutCamp:camp?{stand:{x:67,z:2,y:0},entry:{x:66,z:4,y:0}}:null}};
 const steps=[],c={facilitySite:site,poiTownNpcActors:[],poiTownNpcVersion:0,POI_TOWN_RESIDENT_TICK:380,
  POI_TOWN_WAKE:360,POI_TOWN_CLOSE:1080,POI_TOWN_OPEN:450,
  poiTownNpcExistsBed:()=>true,poiTownNpcStance:()=>true,
  poiTownNpcHere:(a,b)=>a.x===b.x&&a.z===b.z&&a.y===b.y,
  poiTownNpcMove:(a,p,label)=>{steps.push({id:a.role.id,p:point(p),label});if(hold||c.hold)return false;Object.assign(a,p);return true;},
  poiTownNpcAct:(a,label)=>{a.activity=label},poiTownNpcReleaseHunt:()=>{},
  poiTownNpcVisitorRoutine:()=>{}};
 let source=cut('const POI_TOWN_RESIDENT_ROLES=','function poiTownNpcAttackPower(')+
 cut('const POI_TOWN_INN=','const POI_TOWN_RESIDENT_TICK=')+
 cut('function poiTownNpcVisiting(','function poiTownNpcBedOwner(')+
 cut('function poiTownNpcRoutine(','// BEGIN TOWN DIALOGUE');
 vm.runInNewContext(source,c);
 const init=m=>{c.poiTownNpcActors=[];c.poiTownNpcInit(clock(m));return c.poiTownNpcActors};
 const one=(m,id)=>init(m).find(a=>a.role.id===id);
 return {c,init,one,steps};
}
test('friendly gate duty is off the traversal lane, with visible day/night shifts including midnight',()=>{
 const f=setup();
 assert.equal(main.map.world.find(o=>o.type==='poiFortGate'&&o.z===22).x,34);
 for(let m=0;m<1440;m++){
  const duties=f.init(m).filter(a=>a.role.role==='watch');
  assert.equal(duties.length,2);
  assert(duties.some(a=>!a.recessed),'coverage at minute '+m);
  assert(duties.every(a=>a.y===0&&!(a.z===22&&a.x>=33&&a.x<=35)));
 }
 const guard=f.one(700,'northgatekeeper');assert.deepEqual(point(guard),[36,23,0]);assert.equal(guard.facing,3);
 assert.equal(f.one(1320,'northwatchworker').recessed,false);
});
test('one scout physically follows town, gate, trail, camp and reverse; waits when the regular move cannot advance',()=>{
 const {c,one,steps}=setup(),scout=one(480,'northscout');
 assert(scout);assert.deepEqual(point(scout),[34,30,0]);
 c.hold=true;c.poiTownNpcRoutine(scout,clock(500),0,{plans:1});
 assert.deepEqual(point(scout),[34,30,0]);assert.deepEqual(steps.at(-1).p,[35,22,0]);
 c.hold=false;
 for(let t=1;t<=4;t++)c.poiTownNpcRoutine(scout,clock(500),380*t,{plans:1});
 assert.deepEqual(steps.slice(-4).map(e=>e.p),[[35,22,0],[39,4,0],[66,4,0],[67,2,0]]);
 assert.equal(scout.activity,'scout-camp');
 for(let t=5;t<=8;t++)c.poiTownNpcRoutine(scout,clock(940),380*t,{plans:1});
 assert.deepEqual(steps.slice(-4).map(e=>e.p),[[66,4,0],[39,4,0],[35,22,0],[34,30,0]]);
 assert.equal(scout.activity,'scout-report');
 assert.deepEqual(point(one(660,'northscout')),[67,2,0]);
 assert(!setup({camp:false}).one(660,'northscout'));
});
test('adding town life never changes the six normal keeper homes/shops or civilian beds',()=>{
 const f=setup(),night=f.init(0),day=f.init(630);
 for(const id of ['guildkeeper','innkeeper','diningkeeper','workshopkeeper','toolkeeper','stablekeeper']){
  assert.deepEqual(point(day.find(a=>a.role.id===id)),point(day.find(a=>a.role.id===id).role.work));
  assert.notEqual(night.find(a=>a.role.id===id)?.role.role,'watch');
 }
 assert.equal(night.find(a=>a.role.id==='guestadventurer').bedId,'inn-west');
 assert(night.filter(a=>a.role.role==='watch').every(a=>a.bedId===null));
});
