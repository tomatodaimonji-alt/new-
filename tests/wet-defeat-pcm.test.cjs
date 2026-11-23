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
test('exact recorded combat Foley is embedded in offline HTML, cached per cue and never fetched',()=>{
 const {buffers,use}=load();
 for(const [id,count,digest,peak] of [
  ['wood',6048,'dbde51a5692c23eed2e7a5f65e0482457c4e9bb509180a71e6ec3f003b182012',30146],
  ['defeat',15264,'60149cfd167a33f946065b7cbd3186e8d710b4658d2afabfba0e29c7c285d09a',29654]
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
 assert.match(html,/const delay=atContact\?0:POI_WEAPON_CONTACT_DELAY/);
 assert.match(html,/poiPlayImpactBuffer\(poiRecordedFoley\('wood'\),contact,\.78\)/);
 assert.match(html,/poiPlayImpactBuffer\(poiRecordedFoley\('defeat'\),when,\.80\)/);
 assert.match(html,/kind==='hit'&&defeated\)poiDefeatSound\(now\+delay\+\.018\)/);
});

test('common breakup tail settles without clipping over the wood strike',()=>{
 const {use}=load(),wood=use('wood').data,wet=use('defeat').data;
 assert.equal(wet.length,15264,'replaces rather than layers the old watery cue');
 assert.ok(wet.slice(6500,12500).some(x=>Math.abs(x)>.05),'the closing thud carries signal');
 for(const offset of [384,408,432,456,480]){
  let peak=0;
  for(let i=0;i<wet.length+offset;i++)peak=Math.max(peak,Math.abs((wood[i]||0)*.78+(wet[i-offset]||0)*.80));
  assert.ok(peak<.97,'wood + wet peak retains headroom at '+offset+' frames: '+peak);
 }
});
