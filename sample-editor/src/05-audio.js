// All sound is generated locally; no copyrighted samples or network resources.
let audio=null,windSource=null;
function unlockAudio(){
 try{
  if(!audio){
   const AC=window.AudioContext||window.webkitAudioContext;
   if(!AC)return;
   audio=new AC();
   const n=audio.sampleRate*3,buffer=audio.createBuffer(1,n,audio.sampleRate),data=buffer.getChannelData(0);
   let random=0;
   for(let i=0;i<n;i++){random=(random+((Math.random()*2-1)-random)*.018);data[i]=random*.75}
   const wind=audio.createBufferSource();wind.buffer=buffer;wind.loop=true;
   const filter=audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=540;
   const gain=audio.createGain();gain.gain.value=.065;
   wind.connect(filter);filter.connect(gain);gain.connect(audio.destination);wind.start();windSource=wind;
   const hum=audio.createOscillator(),hg=audio.createGain();
   hum.type='sine';hum.frequency.value=73;hg.gain.value=.008;
   hum.connect(hg);hg.connect(audio.destination);hum.start();
  }
  if(audio.state==='suspended')audio.resume();
 }catch(e){console.warn('Audio unavailable',e)}
}
// Short noise-based footfalls: heel impact followed by a quiet sole scuff.
// No pitched oscillator notes. Reuse a noise buffer to avoid reallocating audio every step.
let footNoise=null,footNumber=0;
function footstep(running){
 if(!audio||audio.state!=='running')return;
 if(!footNoise){
  const length=Math.ceil(audio.sampleRate*.22);
  footNoise=audio.createBuffer(1,length,audio.sampleRate);
  const samples=footNoise.getChannelData(0);
  for(let i=0;i<length;i++)samples[i]=Math.random()*2-1;
 }
 const now=audio.currentTime;
 const alternating=footNumber++%2===0;
 const start=now,amp=(running?.065:.043)*(alternating?1:.87);
 const source=audio.createBufferSource();
 source.buffer=footNoise;
 source.playbackRate.value=(running?1.15:.90)*(alternating?1.02:.97);
 const filter=audio.createBiquadFilter();
 filter.type='lowpass';
 filter.frequency.value=running?920:670;
 const envelope=audio.createGain();
 envelope.gain.setValueAtTime(.0001,start);
 envelope.gain.linearRampToValueAtTime(amp,start+.012);
 envelope.gain.exponentialRampToValueAtTime(amp*.27,start+.055);
 envelope.gain.exponentialRampToValueAtTime(.0001,start+(running?.135:.18));
 source.connect(filter);filter.connect(envelope);envelope.connect(audio.destination);
 source.start(start);source.stop(start+.20);
}
