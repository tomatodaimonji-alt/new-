const {test}=require('node:test'),a=require('node:assert/strict'),fixture=require('./orchestral-legacy-fixture.cjs');
test('live town and non-Game World arrangements start music and use different original scores',()=>{
 const b=fixture(),e=fixture(null);
 for(const [f,name] of [[b,'town'],[e,'indoor']]){
  a.equal(f.tick(10).active,name);
  a(f.voices.some(n=>n.instrument&&n.at>=10&&n.at<10.5));
  a(f.deck(name).output.to.includes(f.mixer));
 }
 a.notEqual(b.deck('town').score.duration,e.deck('indoor').score.duration);
});
test('town music develops over a complete repeat, stays bounded, and clears and restarts after stop',()=>{
 const f=fixture();f.tick(10);const period=f.deck('town').score.duration;
 for(let t=10.2;t<10+period*2+.2;t+=.2)f.tick(t);
 a(f.voices.length>140);
 a(new Set(f.voices.filter(n=>n.instrument).map(n=>n.frequency.value)).size>=16);
 a(f.voices.every((n,i)=>!i||n.at>=f.voices[i-1].at-1e-6));
 const first=f.voices[0];
 a(f.voices.some(n=>Math.abs(n.at-first.at-period)<.02&&n.frequency.value===first.frequency.value));
 const count=f.voices.length;
 f.run('poiAudioStop(true);document.hidden=true');f.tick(180);a.equal(f.voices.length,count);
 a.equal(f.run('poiOrchestraSnapshot().voices'),0);
 f.f.document.hidden=false;f.ctx.state='running';f.tick(200);
 a(f.voices.length>count);a(f.voices[count].at>=200);
});

