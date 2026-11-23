const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm'), path=require('node:path');
const canonical=path.join(__dirname,'../world-editor.html');
const input=process.env.GAME||process.env.HTML||process.argv[2]||(fs.existsSync(canonical)?canonical:path.join(__dirname,'../score/orchestral-scores.js'));
const s=fs.readFileSync(input,'utf8');
const score=s.includes('// BEGIN ORIGINAL ORCHESTRA SCORE')?
 s.slice(s.indexOf('// BEGIN ORIGINAL ORCHESTRA SCORE'),s.indexOf('// END ORIGINAL ORCHESTRA SCORE')):s;
const scenes=['town','indoor','outside','market','mine','chapel','otherworld','northFort','battle'];
const lead={town:'oboe',indoor:'flute',outside:'flute',market:'oboe',mine:'cello',chapel:'oboe',otherworld:'flute',northFort:'horn',battle:'horn'};
const read=()=>vm.runInNewContext(score+';POI_ORCHESTRAL_SCORES');
test('nine authored original tunes have section-length progression and bounded internal polyphony',()=>{
 const data=read();
 for(const key of scenes){
  const {bpm,beats,tracks}=data[key];const sec=beats*60/bpm;
  assert(sec>=33&&sec<70,key+' is a 33–70s composition, not a short cue or repeated bar');
  assert(beats>=64&&beats%16===0,key);
  assert(Object.keys(tracks).length>=4,key+' uses layered orchestra');
  assert(tracks.cello?.length&&tracks.strings?.length,key+' has bass and string harmony');
  let notes=[];
  for(const [instrument,ns] of Object.entries(tracks)){
   assert(ns.length&&ns.length<=160,key+' '+instrument+' scheduling density');
   let last=-1;
   for(const n of ns){
    assert.equal(n.length,4,key+' every event is beat/pitch/length/dynamic');
    assert(n.every(Number.isFinite),key);
    const [at,pitch,len,dynamic]=n;
    assert(at>=last&&at>=0&&at<beats&&len>0&&at+len<beats+.5,key+' sorted within loop with short musical release only');
    assert(Number.isInteger(pitch)&&pitch>=24&&pitch<=91&&dynamic>0&&dynamic<=1,key);
    notes.push(n);last=at;
   }
  }
  const event=notes.flatMap(([at,_pitch,len])=>[[at,1],[at+len,-1]]).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  let live=0,peak=0;for(const row of event){live+=row[1];peak=Math.max(peak,live)}
  assert(peak<=10,key+' supports low-polyphony mobile playback');
 }
 assert.equal(new Set(Object.keys(data)).size,scenes.length);
});
test('lead melodies do not reduce to key/tempo changes or reruns of one phrase; instrument roles vary by scene',()=>{
 const data=read(),themes=new Set();
 for(const key of scenes){
  const {tracks,beats}=data[key],ns=tracks[lead[key]];
  assert(ns.length>=28,key);
  const phrases=[];
  for(let lo=0;lo<beats;lo+=16){
   const section=ns.filter(([beat])=>beat>=lo&&beat<lo+16);
   assert(section.length>=5,key+' has a continuous written lead in each phrase');
   const first=section[0]?.[1]??0;
   phrases.push(section.map(([at,pitch,len])=>[at-lo,pitch-first,len]).join(';'));
  }
  assert(new Set(phrases).size>=3,key+' development is independent of key transposition');
  themes.add(phrases[0]);
 }
 assert.equal(themes.size,scenes.length);
 assert(data.battle.tracks.snare.length>30&&data.battle.tracks.timpani.length>15);
 assert(!data.town.tracks.snare&&!data.indoor.tracks.snare);
 assert(data.town.tracks.oboe.length>data.town.tracks.flute.length);
 assert(data.indoor.tracks.flute.length>data.indoor.tracks.oboe.length);
});
