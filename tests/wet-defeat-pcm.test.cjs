const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'../world-editor.html'),'utf8');
function load(rate){
 const a=html.indexOf('let poiDefeatWetBuffer='),b=html.indexOf('function poiSound(',a);
 assert(a>=0&&b>a,'wet PCM implementation absent');
 const play=[],buffers=[];
 const ctx=vm.createContext({poiAudioContext:{sampleRate:rate,createBuffer(channels,length,sampleRate){
  const data=new Float32Array(length),buf={channels,length,sampleRate,data,getChannelData:()=>data};
  buffers.push(buf);return buf;
 }},poiPlayImpactBuffer:(...args)=>play.push(args)});
 vm.runInContext(html.slice(a,b),ctx);
 return {play,buffers,hit:t=>ctx.poiDefeatSound(t)};
}
const rms=(data,rate,a,b)=>{const cut=data.slice(Math.floor(a*rate),Math.floor(b*rate));return Math.sqrt(cut.reduce((s,v)=>s+v*v,0)/cut.length);};
test('defeat plays a single lazy, reusable bounded mono buffer at the original contact offset',()=>{
 const {play,buffers,hit}=load(48000);
 hit(1.126);hit(2.018);
 assert.equal(buffers.length,1);
 assert.deepEqual([buffers[0].channels,buffers[0].length],[1,19440]);
 assert.deepEqual(play,[[buffers[0],1.126,.52],[buffers[0],2.018,.52]]);
 assert.match(html,/kind==='hit'&&defeated\)poiDefeatSound\(now\+POI_WEAPON_CONTACT_DELAY\+\.018\)/);
});
test('main wet pressure release dominates, late irregular ticks have air between, and no harsh clipping',()=>{
 for(const rate of [24000,48000]){
  const {buffers,hit}=load(rate);hit(0);
  const {data}=buffers[0],peak=Math.max(...data.map(Math.abs));
  assert(peak>.45&&peak<.94,peak);
  const body=rms(data,rate,.012,.10);
  const gap=rms(data,rate,.215,.228);
  const droplet=rms(data,rate,.236,.256);
  assert(body>.075&&body>droplet*2);
  assert(droplet>gap*1.8&&droplet>.012);
  assert(rms(data,rate,.387,.405)<.0001,'tail ends cleanly');
  assert.equal(data[0],0);
 }
});
