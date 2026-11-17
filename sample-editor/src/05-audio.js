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
function footstep(running){
 if(!audio||audio.state!=='running')return;
 const t=audio.currentTime,osc=audio.createOscillator(),gain=audio.createGain();
 osc.type='triangle';osc.frequency.setValueAtTime(running?112:93,t);
 osc.frequency.exponentialRampToValueAtTime(48,t+.11);
 gain.gain.setValueAtTime(.0001,t);
 gain.gain.exponentialRampToValueAtTime(running?.11:.075,t+.009);
 gain.gain.exponentialRampToValueAtTime(.0001,t+.12);
 osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+.13);
}
