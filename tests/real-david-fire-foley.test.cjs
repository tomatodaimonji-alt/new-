const a=require('node:assert/strict'),{test}=require('node:test'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const exact=(first,last)=>{const x=h.indexOf(first),y=h.indexOf(last,x+first.length);a(x>=0&&y>x,first);return h.slice(x,y)};
test('all metal/flame masters are embedded exactly once with bounded 24kHz mono duration and clean tails',()=>{
 const table=vm.runInNewContext(exact('const POI_RECORDED_FOLEY={','const poiRecordedFoleyCache')+';POI_RECORDED_FOLEY');
 const items={
  davidBladeSweep:[9600,'d2460f6fe00ae14e4f6fb7ce908f45cfcb12f47739a07bdd9da21d6ced7dc59a'],
  davidSwordFirst:[6480,'26c5aff60be181dad9bbcabffe29d2d3e33fb4dda6490ceb5a09e3924a00cfcd'],
  davidSwordSecond:[8400,'465cfa3222349c9f04f711225a9e03eb5a53e0466143eacf32501013489e5655'],
  davidHeavyStomp:[27600,'b393593ad1d31dafb370fc06413a7a96f64240936ff0fb006066c91f2c46dde8'],
  davidLeapStomp:[35040,'9232ab36dc816826bf640724486ca6f8fa090eb5b6733a12390d31b6d0962317'],
  wandFlameLaunch:[4128,'5d4cdb5dd4abd03069a825a73fb6ef88ffdc2cb46570f1c398befd996db9b81a']
 };
 for(const [key,[len,sha]] of Object.entries(items)){
  const bytes=Buffer.from(table[key]||'','base64');
  a.equal(bytes.length,len*2,key);a.equal(crypto.createHash('sha256').update(bytes).digest('hex'),sha,key);
  a.equal(bytes.readInt16LE(0),0);a.equal(bytes.readInt16LE(bytes.length-2),0);
  const samples=[];for(let i=0;i<len;i++)samples.push(bytes.readInt16LE(i*2)/32768);
  const peak=samples.reduce((n,v)=>Math.max(n,Math.abs(v)),0);
  a(key==='wandFlameLaunch'?peak>.45&&peak<.47:peak>.66&&peak<(key==='davidLeapStomp'?.83:.81),key+' peak');
 }
});
test('real accepted wand cast starts one short flare sound even without contact; cooldown, unpaid, muted and hidden casts do not duplicate it',()=>{
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
