const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function load(){
 const a=html.indexOf('const POI_RECORDED_FOLEY='),b=html.indexOf('// Weapon IDs are shared',a);
 assert(a>=0&&b>a,'inline recorded Foley');
 const buffers=[];
 const ctx=vm.createContext({poiAudioContext:{sampleRate:48000,createBuffer(channels,length,sampleRate){
  const data=new Float32Array(length),buf={channels,length,sampleRate,data,getChannelData:()=>data};
  buffers.push(buf);return buf;
 }},atob:data=>Buffer.from(data,'base64').toString('latin1')});
 vm.runInContext(html.slice(a,b),ctx);
 return {buffers,use:id=>ctx.poiRecordedFoley(id)};
}
test('exact selected real Foley B+B is embedded in offline HTML, cached per cue and never fetched',()=>{
 const {buffers,use}=load();
 for(const [id,count,digest,peak] of [
  ['wood',6192,'68135caf9ea6b388b5a1fe311d18236bc7ddef04a4abe4da86802aeee74777f0',24572],
  ['defeat',13200,'014aeabc35f1f164f3f0f52d90daceadae5d04dc07ec4d9bdf12150ae4185ecc',17063]
 ]){
  const b=use(id);assert.equal(use(id),b);
  assert.deepEqual([b.channels,b.length,b.sampleRate],[1,count,24000]);
  const raw=Buffer.alloc(count*2);
  b.data.forEach((x,i)=>raw.writeInt16LE(Math.round(x*32768),i*2));
  assert.equal(crypto.createHash('sha256').update(raw).digest('hex'),digest);
  assert.equal(Math.max(...b.data.map(Math.abs)),peak/32768);
  assert.equal(b.data[0],0);assert.equal(b.data.at(-1),0);
 }
 assert.equal(buffers.length,2);
 assert.ok(Buffer.byteLength(html,'utf8')<12*1024*1024,'authoritative HTML fits Android updater cap');
});
test('recorded cues retain exact swing/contact separation and defeat-only guard',()=>{
 assert.match(html,/poiPlayImpactBuffer\(poiRecordedFoley\('wood'\),contact,\.75\)/);
 assert.match(html,/poiPlayImpactBuffer\(poiRecordedFoley\('defeat'\),when,\.90\)/);
 assert.match(html,/kind==='hit'&&defeated\)poiDefeatSound\(now\+POI_WEAPON_CONTACT_DELAY\+\.018\)/);
});
