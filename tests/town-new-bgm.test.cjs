const a=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{createHash}=require('node:crypto'),{test}=require('node:test');
const h=fs.readFileSync(process.argv[2]||'world-editor.html','utf8'),old=process.argv[3]?fs.readFileSync(process.argv[3],'utf8'):null;
const sha=b=>createHash('sha256').update(b).digest('hex');
function range(s,a,b){const i=s.indexOf(a),j=s.indexOf(b,i+a.length);if(i<0||j<0)throw Error(a);return s.slice(i,j)}
const scoreMark='const POI_ORCHESTRAL_SCORES=\n',scoreEnd='// END ORIGINAL ORCHESTRA SCORE',clipMark='const POI_ZONE_RECORDINGS=',clipEnd='// BEGIN RECORDED ZONE TRANSPORT';
const score=s=>JSON.parse(range(s,scoreMark,scoreEnd).slice(scoreMark.length).trim().replace(/;$/,''));
const recording=s=>vm.runInNewContext(range(s,clipMark,clipEnd)+'\n({clips:POI_ZONE_RECORDINGS,ends:POI_ZONE_ENDS})');
test('only approved town cue, town loop and version stamps change',()=>{
 function mask(s){return s.replace(range(s,scoreMark,scoreEnd),'').replace(range(s,clipMark,clipEnd),'')}
 const s=score(h);
 if(old){
  a.equal(mask(h).replaceAll('v345','v344'),mask(old),'game code, music transport and protected audio unchanged');
  const o=score(old);a.deepEqual(Object.keys(s),Object.keys(o));
  for(const k of Object.keys(o))if(k!=='town')a.deepEqual(s[k],o[k],k);
  a.notDeepEqual(s.town.tracks,o.town.tracks);
 }
 a.equal(s.town.title,'朝靄の灯');
 a.deepEqual(Object.keys(s.town.tracks).sort(),['cello','flute','harp','strings']);
 a.equal(Math.round(32000*60*s.town.beats/s.town.bpm),1974857);
 const f=recording(h);
 if(old){
  const r=recording(old);a.deepEqual(Object.keys(f.clips),Object.keys(r.clips));
  for(const k of Object.keys(r.clips))if(k!=='town'){a.equal(f.clips[k],r.clips[k],k);a.equal(f.ends[k],r.ends[k],k)}
 }
 a.equal(f.ends.town,1974857/32000);
 const bytes=Buffer.from(f.clips.town,'base64');
 a.equal(bytes.length,271615);a.equal(sha(bytes),'382224a6779f0d96daea010e4abf65ff8d7cb728eade78b7d7f305938b7634c7');
});
test('rejecting the ordinary town recording uses the new harp-first fallback instead of the old oboe',()=>{
 const c=vm.createContext({});
 const s=range(h,scoreMark,scoreEnd)+range(h,clipMark,clipEnd)+
  range(h,'function poiOrchestraScore(','function poiOrchestraRoomStart(')+
  range(h,'const poiRecordedZoneCache=','function poiOrchestraSnapshot(')+`
  let townDecodeRejections=0,played=[];
  const POI_ORCHESTRA_INSTRUMENTS={harp:{},strings:{},cello:{},flute:{},oboe:{}};
  const poiAudioContext={state:'running',decodeAudioData:(bytes,ready,fail)=>{townDecodeRejections++;fail()}};
  const poiAudioStartupReady=()=>true,poiWalkActive=true,poiAudioEnabled=true,poiAudioAllowed=()=>true,poiAudioLevels={master:80,bgm:70};
  const poiOrchestraScene=()=>'town',poiOrchestraScoreCache=new Map(),poiOrchestraDeck={index:0,cycle:0,start:0,score:poiOrchestraScore('town')};
  const poiOrchestraActivate=()=>poiOrchestraDeck,poiOrchestraVoice=(d,e)=>played.push(e.instrument);
  const POI_ORCHESTRA_LOOKAHEAD=.12,atob=()=>'',nowStep=.06;
  for(let n=0;n<300;n++)poiOrchestraTick(n*nowStep);
  const result={townDecodeRejections,played,entries:poiOrchestraDeck.score.events.map(e=>e.instrument)};
  JSON.stringify(result);
 `;
 // Preserve real rejection routing and score scheduler; only audio transport,
 // decoder failure and clock are simulated in this unit check.
 const r=JSON.parse(vm.runInContext(s,c));a.equal(r.townDecodeRejections,1);
 a.equal(r.played[0],'harp');a.deepEqual([...new Set(r.entries)].sort(),['cello','flute','harp','strings']);
 a(r.played.includes('flute')&&!r.played.includes('oboe'));
});
