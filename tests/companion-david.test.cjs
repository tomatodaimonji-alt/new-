const {test}=require('node:test'),a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
function setup(){
 const f=h.indexOf('// BEGIN COMPANION DAVID'),t=h.indexOf('// END COMPANION DAVID');
 a(f>=0&&t>f,'actual companion David seam');
 const ally={x:24,z:104,y:0},o={type:'monsterStoneDavid',x:24,z:104,y:0},s={x:24,z:106,hp:99,david:{awake:true}};
 const b={y:0},hits=[],c=vm.createContext({poiCompanionActor:ally,poiWalkX:24,poiWalkZ:105,poiWalkLevel:0,
  poiMonsterStates:new Map([[o,s]]),poiDavidMatch:q=>q===o?b:null,poiCompanionAllowed:()=>true,
  poiCompanionSame:()=>true,poiCompanionPlace:()=>({}),poiCompanionPose:q=>q,
  poiDavidIn:(_b,p)=>p.y===0&&p.z>=94&&p.z<=120,poiDavidLine:()=>true,poiDavidArea:()=>true,
  poiCompanionHurt:n=>{hits.push(n);return true},POI_DAVID_PATTERNS:{stomp:{damage:[21]},double:{damage:[20,22]}},
  POI_DAVID_BEAM_WIDTH:.56,poiDavidBeamRay:()=>({x:0,z:-1}),poiDavidBeamReach:()=>14});
 vm.runInContext(h.slice(f,t),c);return {ally,o,s,b,c,hits};
}
test('only live canonical awakened David, with short dodge loose tether then actual separation',()=>{
 const {c,ally,o,s}=setup();
 a.equal(c.poiCompanionDavidTarget(ally,o,s),true);
 ally.davidFocus=s;c.poiWalkZ=113;a.equal(c.poiCompanionDavidTarget(ally,o,s),true);
 c.poiWalkZ=114;a.equal(c.poiCompanionDavidTarget(ally,o,s),false);
 c.poiWalkZ=105;s.david.returning=true;a.equal(c.poiCompanionDavidTarget(ally,o,s),false);
 s.david.returning=false;a.equal(c.poiCompanionDavidTarget(ally,{...o},s),false);
});
test("optional awakening blocks ally damage and targeting until true battle",()=>{
 const {c,ally,o,s,b,hits}=setup(); const q={y:0,kind:"stomp",sx:24,sz:106,dx:0,dz:-1};
 c.poiDavidBattleActive=now=>now>=2440;
 a.equal(c.poiCompanionDavidTarget(ally,o,s),false);
 a.equal(c.poiCompanionDavidImpact(o,s,b,q,0,2439),false);
 c.performance={now:()=>2440}; a.equal(c.poiCompanionDavidTarget(ally,o,s),true);
 a(c.poiCompanionDavidImpact(o,s,b,q,0,2440)); a.deepEqual(hits,[21]);
});
test('real impact/beam damages once per ordinal, respects floor and wall for each independent check',()=>{
 const {c,ally,o,s,b,hits}=setup(),q={y:0,kind:'double',sx:24,sz:106,dx:0,dz:-1};
 a(c.poiCompanionDavidImpact(o,s,b,q,0,300));
 a.equal(c.poiCompanionDavidImpact(o,s,b,q,0,301),false);
 c.poiDavidLine=()=>false;a.equal(c.poiCompanionDavidImpact(o,s,b,q,1,400),false);
 c.poiDavidLine=()=>true;ally.y=1;a.equal(c.poiCompanionDavidImpact(o,s,b,q,1,401),false);
 ally.y=0;a(c.poiCompanionDavidImpact(o,s,b,q,1,402));
 q.kind='beam';a(c.poiCompanionDavidBeam(o,s,b,q,0,.1,500));
 a.equal(c.poiCompanionDavidBeam(o,s,b,q,0,.1,501),false);
 a.deepEqual(hits,[20,22,36]);
});
test('real David area misses the dodging player yet hits the ally; leap radius and arena ray share same landing',()=>{
 const {c,ally,o,s,b,hits}=setup();
 const i=h.indexOf('function poiDavidArea('),j=h.indexOf('function poiDavidCease(',i);
 // Some generations insert the leap implementation between the two functions;
 // use only the exact existing ordinary area definition in this isolated VM.
 const end=h.indexOf('\n}',i)+2;
 a(i>=0&&end<=j);vm.runInContext(h.slice(i,end),c);
 c.poiWalkZ=98;c.POI_DAVID_SWEEP_FORWARD=6;c.POI_DAVID_SWEEP_SIDE=3;
 const stomp={y:0,kind:'stomp',sx:24,sz:106,dx:0,dz:-1};
 a.equal(c.poiDavidArea(stomp,{x:24,z:98,y:0}),false);
 a(c.poiCompanionDavidImpact(o,s,b,stomp,0,500));
 const leap={...stomp,kind:'leap'};c.POI_DAVID_LEAP_RADIUS=8;c.POI_DAVID_LEAP_DAMAGE=34;
 c.poiAimWall=()=>null;c.poiDavidRoomRay=()=>1;
 a.equal(c.poiCompanionDavidImpact(o,s,b,leap,0,700),false);
 c.poiDavidRoomRay=()=>8;a(c.poiCompanionDavidImpact(o,s,b,leap,0,701));
 a.deepEqual(hits,[21,34]);
});
