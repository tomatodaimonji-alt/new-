const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const exact=(first,last)=>{const x=h.indexOf(first),y=h.indexOf(last,x+first.length);a(x>=0&&y>x,first);return h.slice(x,y)};
test('all metal/flame masters are embedded exactly once with bounded 24kHz mono duration and clean tails',()=>{
 const table=vm.runInNewContext(exact('const POI_RECORDED_FOLEY={','const poiRecordedFoleyCache')+';POI_RECORDED_FOLEY');
 const items={
  davidBladeSweep:[9600,'d2460f6fe00ae14e4f6fb7ce908f45cfcb12f47739a07bdd9da21d6ced7dc59a'],
  davidSwordFirst:[6480,'26c5aff60be181dad9bbcabffe29d2d3e33fb4dda6490ceb5a09e3924a00cfcd'],
  davidSwordSecond:[8400,'465cfa3222349c9f04f711225a9e03eb5a53e0466143eacf32501013489e5655'],
  davidHeavyStomp:[17040,'e2fe0fa1cf523de16f58561679bebd3d64f8269f7a9f761960ff9c3c119d2f09'],
  wandFlameLaunch:[7200,'104bb2d01a7d706c7ad91377ad3e7f9996950c36596cde1c6ad728d519aa1c14']
 };
 for(const [key,[len,sha]] of Object.entries(items)){
  const bytes=Buffer.from(table[key]||'','base64');
  a.equal(bytes.length,len*2,key);a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha,key);
  a.equal(bytes.readInt16LE(0),0);a.equal(bytes.readInt16LE(bytes.length-2),0);
  const samples=[];for(let i=0;i<len;i++)samples.push(bytes.readInt16LE(i*2)/32768);
  const peak=samples.reduce((n,v)=>Math.max(n,Math.abs(v)),0);
  a(peak>.66&&peak<.81,key+' peak');
 }
});
test('real accepted wand cast starts one jet sound even without contact; cooldown, unpaid, muted and hidden casts do not duplicate it',()=>{
 let now=1000,charges=2,events=[],shots=0,visible=true;
 const c={console,performance:{now:()=>now},document:{get hidden(){return !visible},querySelector:()=>null},poiWalkActive:true,poiInventoryAllowed:()=>true,
  poiPlayerWeaponProfile:()=>({ready:610}),poiPlayerWeaponPending:null,poiAttackReady:0,poiWalkX:24,poiWalkZ:100,poiWalkLevel:0,poiWalkFacing:0,
  poiPlayerWeaponFlightBegin:()=>{shots++},poiWalkAvatar:()=>{},poiAudioEnabled:true,poiAudioAllowed:()=>true,poiAudioStart:()=>{},
  poiAudioContext:{state:'running',currentTime:3},poiAudioLevels:{master:1,se:1},POI_WEAPON_SE:{},facilitySite:{id:'base'},
  poiTryRecordedFoley:(...args)=>events.push(args),
  poiInventorySpendFireWand:()=>charges>0?(charges--,true):false};
 const cast=vm.runInNewContext(exact('function poiSound(','function poiAudioSyncLifecycle')+exact('function poiPlayerCastFireWand(','function poiPlayerFlightMs(')+';poiPlayerCastFireWand',c);
 a.equal(cast(0).ok,true);a.equal(cast(0).reason,'cooldown');
 a.deepEqual(events,[['wandFlameLaunch',3,.52]]);a.equal(shots,1);
 now=1800;visible=false;a.equal(cast(0).reason,'unavailable');a.equal(charges,1);
 visible=true;c.poiAudioLevels.se=0;a.equal(cast(0).ok,true);
 now=2500;a.equal(cast(0).reason,'storage');
 a.equal(shots,2);a.equal(events.length,1);a.equal(charges,0);
});
