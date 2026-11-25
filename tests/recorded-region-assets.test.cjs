const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{createHash}=require('node:crypto'),{test}=require('node:test');
const before=fs.readFileSync(process.argv[2],'utf8'),after=fs.readFileSync(process.argv[3],'utf8');
const manifest=JSON.parse(fs.readFileSync(process.argv[4],'utf8'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const head='// VSCO 2 Community Edition (CC0-1.0), see docs/recorded-region-bgm.md.';
const transport='// BEGIN RECORDED ZONE TRANSPORT',point='function poiOrchestraTick(now){';
test('all protected media, scene routing, mixer, movement, camera and game code are byte-identical outside two exact insertions',()=>{
 const i=after.indexOf(head),j=after.indexOf(point,i);a(i>0&&j>i);
 let reverted=after.slice(0,i)+after.slice(j);
 const hook=' if(poiRecordedZoneTry(scene,deck,now))return;\n';
 a.equal(reverted.split(hook).length,2);reverted=reverted.replace(hook,'');
 const oldV=before.match(/3Dワールド工房（(v\d+)）/)[1],newV=after.match(/3Dワールド工房（(v\d+)）/)[1];
 a.equal(reverted.replaceAll(newV,oldV),before);
 const seq=after.slice(j,after.indexOf('function poiOrchestraSnapshot()',j));
 let prev=-1;for(const needle of ["scene==='snow'","scene==='davidStill'","scene==='outside'","poiRecordedZoneTry(scene,deck,now)","const {events,duration}=deck.score;"]){
  const at=seq.indexOf(needle);a(at>prev,needle);prev=at;
 }
});
test('actual full Ogg bytes and pinned CC0 source hashes are embedded exactly once for seven distinct scores',()=>{
 const p=after.indexOf(head),q=after.indexOf(transport,p);a(p>0&&q>p);
 const {clips,ends}=vm.runInNewContext(after.slice(p,q)+'\n({clips:POI_ZONE_RECORDINGS,ends:POI_ZONE_ENDS});');
 const keys=['town','indoor','mine','otherworld','chapel','northFort','battle'];
 a.deepEqual(Object.keys(clips),keys);a.deepEqual(Object.keys(manifest.scenes),keys);
 const parts=new Set(),pinned='440300901dfe9275fd84e0b7763af1f8443ae62e',known=new Set(manifest.sources.map(v=>v.id));
 for(const x of manifest.sources){a.equal(x.ref,pinned);a.match(x.blob,/^[0-9a-f]{40}$/);a.match(x.sha256,/^[0-9a-f]{64}$/);a(x.bytes>0&&x.path);}
 let bytes=0;
 for(const k of keys){const b=Buffer.from(clips[k],'base64'),m=manifest.scenes[k];a.equal(b.subarray(0,4).toString(),'OggS');a.equal(sha(b),m.sha256);
  bytes+=b.length;a.equal(b.length,m.bytes);a(m.seconds>35&&m.seconds<55);a.equal(ends[k],m.frames/32000);
  for(const [name,v]of Object.entries(m.parts)){parts.add(name);a(v.events>0&&v.sources.every(x=>known.has(x)))}
 }
 a.deepEqual([...parts].sort(),['cello','flute','harp','horn','oboe','snare','strings','timpani']);
 a.equal(bytes,manifest.encodedBytes);a(bytes<2_000_000);
});
