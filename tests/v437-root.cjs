const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2]||'candidate.html','utf8');
const fn=name=>{const m=s.match(new RegExp('^function '+name+'\\([^]*?^}','m'));a.ok(m,name);return m[0]}
for(const m of s.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(m[1]);
const check=(name,f)=>{try{f();console.log('PASS '+name)}catch(e){console.error('FAIL '+name+' '+e.message);process.exitCode=1}};
check('south lantern emitters use mounted centers, torch shader and scope',()=>{
 const mounts=[{x:159,y:-.36,z:80.5,dx:1,dz:0,stair:true},{x:162,y:.03,z:85,dx:0,dz:-1,stair:false}];
 const c=vm.createContext({facilitySite:{id:'frontier'},poiWalkActive:true,poiWalkLevel:0,poiWalkX:162,poiWalkZ:84,frontierSouthLampPoints:null,
  frontierSouthLanternMounts:()=>mounts,frontierSouthMouthView:(x,z)=>x>154&&x<168&&z>=74.8&&z<82.25,
  frontierSouthRuinsOwn:()=>true,frontierRuinsVisibleTorches:()=>[],frontierSmooth:()=>0,loc:{frontierTorchLights:1},
  gl:{uniform4fv:(_,p)=>c.last=Array.from(p)}});
 vm.runInContext(['frontierTorchPulse','frontierSouthLampVisible','frontierTorchFrame'].map(fn).join('\n'),c);
 c.frontierTorchFrame(0,160,73,.8);a.ok(c.last.every(x=>x===0));
 c.frontierTorchFrame(0,160,79,.8);a.ok(c.last[3]>0);a.ok(Math.abs(c.last[0]-159.29)<1e-4);a.equal(c.last[7],0);
 c.poiWalkLevel=-1;c.frontierTorchFrame(0,162,84,-.6);a.ok(c.last[3]>0&&c.last[7]>0);
 a.ok(c.last.slice(8).every(x=>x===0));
 c.frontierTorchFrame(0,162,84,-.6);const before=c.last;c.frontierTorchFrame(125,162,84,-.6);a.notEqual(before[3],c.last[3]);
 c.facilitySite={id:'base'};c.frontierTorchFrame(0,162,84,-.6);a.ok(c.last.every(x=>x===0));
});
check('the south gate dispatches recorded Orvas stone sounds, not wood or generic stone',()=>{
 const heard=[],allowed=()=>true;
 const c=vm.createContext({poiWalkActive:true,poiAudioEnabled:true,poiAudioAllowed:allowed,poiAudioStart:()=>{},poiAudioContext:{state:'running',currentTime:3},
 POI_WEAPON_SE:{},poiAudioLevels:{se:1,master:1},poiTryRecordedFoley:(name,at,gain)=>{heard.push({name,at,gain});return true},
 poiWalkLevel:0,poiWalkDoorOpen:null,poiWalkX:160,poiWalkZ:74,poiWalkFromX:160,poiWalkFromZ:73,
 facilitySite:{id:'frontier'},facilityHasDiningStoneLeaf:()=>false,world:[{x:160,z:74,y:0,type:'stonewallDoor'}]});
 vm.runInContext(fn('poiWalkDoorFoley')+'\n'+fn('poiSound'),c);
 c.poiWalkDoorFoley(c.world[0],0);c.poiWalkFromZ=74;c.poiWalkZ=75;c.poiWalkDoorFoley(null,0);
 a.deepEqual(heard.map(e=>e.name),['davidStoneExtractFirst','davidStoneExtractSecond']);
 a.ok(heard.every(e=>e.gain>0&&e.gain<=.60));
});
