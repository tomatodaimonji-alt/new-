const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{createHash}=require('node:crypto'),{test}=require('node:test');
const base=fs.readFileSync(process.argv[2],'utf8'),next=fs.readFileSync(process.argv[3],'utf8');
const manifest=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
const keys=['town','indoor','mine','otherworld','chapel','northFort','battle'];
const sha=v=>createHash('sha256').update(v).digest('hex');
const scoreMark='const POI_ORCHESTRAL_SCORES=\n',endMark='// END ORIGINAL ORCHESTRA SCORE',zoneMark='const POI_ZONE_RECORDINGS=Object.freeze({',zoneEnd='// BEGIN RECORDED ZONE TRANSPORT';
function span(t,start,end){
 const a=t.indexOf(start),b=t.indexOf(end,a+start.length);if(a<0||b<=a)throw Error(start);
 return [a,b,t.slice(a,b)];
}
function score(t){
 const raw=span(t,scoreMark,endMark)[2].slice(scoreMark.length);
 return JSON.parse(raw.trim().replace(/;$/,''));
}
function data(t){
 return vm.runInNewContext(span(t,zoneMark,zoneEnd)[2]+'\n({clips:POI_ZONE_RECORDINGS,ends:POI_ZONE_ENDS})');
}
test('only seven scoped scores/recordings, loop endpoints and four stamps change',()=>{
 const remove=t=>{for(const [start,end] of [[zoneMark,zoneEnd],[scoreMark,endMark]]){const [x,y]=span(t,start,end);t=t.slice(0,x)+t.slice(y)}return t};
 a.equal(remove(next).replaceAll('v338','v337'),remove(base));
 const old=score(base),fresh=score(next);
 a.deepEqual(Object.keys(fresh),Object.keys(old));a.deepEqual(Object.keys(manifest.scenes),keys);
 for(const n of Object.keys(old)){
  if(!keys.includes(n)){a.deepEqual(fresh[n],old[n]);continue;}
  a.notDeepEqual([fresh[n].bpm,fresh[n].beats],[old[n].bpm,old[n].beats]);
  a.notDeepEqual(fresh[n].tracks,old[n].tracks);
  a.deepEqual([fresh[n].bpm,fresh[n].beats],[manifest.scenes[n].bpm,manifest.scenes[n].beats]);
  const notes=Object.values(fresh[n].tracks).flat();a(notes.length>30&&notes.every(e=>e.length===4&&e.every(Number.isFinite)));
 }
});
test('seven different real-sample Oggs match independently verified source and precise loop endpoints',()=>{
 const {clips,ends}=data(next),old=data(base);a.deepEqual(Object.keys(clips),keys);a.deepEqual(Object.keys(ends),keys);
 const ids=new Set(manifest.sources.map(v=>v.id));a(ids.size>=12);
 for(const v of manifest.sources){a.equal(v.ref,'440300901dfe9275fd84e0b7763af1f8443ae62e');a.match(v.blob,/^[a-f\d]{40}$/);}
 let total=0;for(const k of keys){const m=manifest.scenes[k],p=Buffer.from(clips[k],'base64');
   a.notEqual(clips[k],old.clips[k]);a.equal(p.subarray(0,4).toString(),'OggS');
   a.equal(sha(p),m.sha256);a.equal(p.length,m.bytes);a.equal(ends[k],m.frames/32000);a(ends[k]>=35&&ends[k]<60);
   for(const part of Object.values(m.parts))a(part.sources.length&&part.sources.every(id=>ids.has(id)));
   total+=p.length;
 }
 a.equal(total,manifest.encodedBytes);a(total<2_100_000);
});
