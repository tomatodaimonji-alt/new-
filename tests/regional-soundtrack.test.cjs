const assert=require('node:assert/strict');
const {test}=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const {createHash}=require('node:crypto');
const [path='world-editor.html',prev,manifestPath='docs/recorded-region-bgm-manifest.json']=process.argv.slice(2);
const game=fs.readFileSync(path,'utf8'), old=prev&&fs.readFileSync(prev,'utf8');
const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
const idx='const POI_ORCHESTRAL_SCORES=\n', end='// END ORIGINAL ORCHESTRA SCORE', rec='const POI_ZONE_RECORDINGS=', tr='// BEGIN RECORDED ZONE TRANSPORT';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const section=(s,a,b)=>s.slice(s.indexOf(a),s.indexOf(b,s.indexOf(a)+a.length));
const read=s=>({scores:JSON.parse(section(s,idx,end).slice(idx.length).trim().replace(/;$/,'')),
 ...vm.runInNewContext(section(s,rec,tr)+'\n({clips:POI_ZONE_RECORDINGS,ends:POI_ZONE_ENDS});')});
const current=read(game);
const revised=['indoor','mine','otherworld','chapel','northFort','battle'];
test('six distinct original remasters and their bounded no-oboe fallback scores',()=>{
 assert.equal(current.scores.mine.title,'霧の向こうの気配');
 assert.equal(current.scores.town.title,'朝靄の灯');
 assert.equal(sha(Buffer.from(current.clips.town,'base64')),'382224a6779f0d96daea010e4abf65ff8d7cb728eade78b7d7f305938b7634c7');
 const seen=new Set(); const available=new Set(manifest.sources.map(s=>s.id));
 let size=0;
 for(const [key,m] of Object.entries(manifest.scenes)){
  const bytes=Buffer.from(current.clips[key],'base64'), score=current.scores[key];
  assert.equal(bytes.subarray(0,4).toString(),'OggS');assert.equal(sha(bytes),m.sha256);
  assert.equal(bytes.length,m.bytes);size+=bytes.length;
  assert.equal(current.ends[key],m.frames/32000);
  assert.equal(m.frames,Math.round(score.beats*60*32000/score.bpm));
  assert.equal(score.title,m.title); assert(!seen.has(m.title));seen.add(m.title);
  assert(!score.tracks.oboe);assert(m.lufs>-25&&m.lufs<-21);
  assert(m.maxTruePeakDB<-9&&m.loopStep.every(x=>x<.012));
  assert(Object.values(m.parts).every(v=>v.events>0&&v.sources.every(x=>available.has(x))));
 }
 assert.equal(size,manifest.encodedBytes);assert(size<=2550000);
});
test('outside, snow, temple, game routing, geometry, transport, SFX and town remain byte-exact', {skip:!old},()=>{
 const parent=read(old);
 const isolate=s=>s.replace(section(s,idx,end),'').replace(section(s,rec,tr),'');
 const stripped=isolate(game);
 const versionStamps=['工房（v346）',"editorVersion:'v346'","width+'×'+height+'　v346'"];
 assert.equal(versionStamps.reduce((r,k)=>r.replaceAll(k,k.replace('v346','v345')),stripped),isolate(old));
 assert.deepEqual(Object.keys(current.scores),Object.keys(parent.scores));
 assert.deepEqual(Object.keys(current.clips),Object.keys(parent.clips));
 for(const k of Object.keys(parent.scores))
  if(revised.includes(k)){assert.notDeepEqual(current.scores[k],parent.scores[k]);assert.notEqual(current.clips[k],parent.clips[k]);}
  else{
   assert.deepEqual(current.scores[k],parent.scores[k]);
   assert.equal(current.clips[k],parent.clips[k]);assert.equal(current.ends[k],parent.ends[k]);
  }
});
