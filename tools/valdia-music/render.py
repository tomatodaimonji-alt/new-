"""Original chamber cue: 王都の午後. No third-party recordings or presets."""
from pathlib import Path
from math import pi
import json, subprocess
import numpy as np
root=Path(__file__).resolve().parent
sr=24000; bpm=76; beat=60/bpm
harmony=[(38,57,62,66),(42,57,62,66),(47,57,62,66),(43,55,59,66),(40,55,59,64),
 (45,57,61,67),(38,57,62,66),(47,54,62,69),(43,55,62,67),(40,55,59,67),
 (42,57,62,66),(45,55,61,64),(47,57,62,66),(43,55,59,69),(40,55,59,66),
 (45,57,61,67),(42,57,62,69),(43,55,62,66),(45,57,61,64),(38,54,62,69)]
# Original melody expressed in beat, absolute MIDI pitch, length, dynamic.
mel=[
 (1.30,69,1.35),(3.28,71,.78),(4.23,73,.66),(5.00,74,1.62),(7.15,69,1.04),(8.42,66,1.13),
 (10.35,67,1.08),(11.67,71,1.68),(14.08,66,.79),(15.02,64,1.30),(17.28,67,1.15),(18.73,66,1.95),
 (22.08,74,1.10),(23.46,76,1.10),(25.03,78,1.41),(27.04,74,1.45),(28.87,71,.90),(30.08,69,1.44),
 (32.12,67,.73),(33.04,69,1.14),(34.37,73,1.57),(37.12,74,.94),(38.45,78,1.31),(40.08,81,1.11),
 (42.05,79,1.52),(44.08,76,1.02),(45.5,74,1.08),(47.18,73,1.29),(49.14,69,1.01),
 (50.46,71,1.23),(52.30,67,1.58),(55.02,66,1.04),(56.32,64,.9),(57.44,62,2.13)]
tracks={'oboe':[],'strings':[],'cello':[],'harp':[],'flute':[],'horn':[]}
for i,(base,a,b,c) in enumerate(harmony):
 t=i*3
 tracks['cello'].append([t-.0+.03,base,2.80,.41+(i%3)*.026])
 for j,n in enumerate((a,b,c)):
  if j<2 or i in [2,4,8,12,13,17,19]:
   tracks['strings'].append([round(t+j*.10,2),n,round(2.77-j*.105,3),(.244-.020*j)*(.88 if i in [0,19] else 1)])
 if i not in [5,9,11,18]:
  tracks['harp'].append([t+.43,b,1.47,.24]);tracks['harp'].append([t+1.87,c+12,1.06,.165])
 if i in [5,8,11,15,18]:
  tracks['horn'].append([round(t+.27,2),a-12,2.4,.26])
for i,(t,n,l) in enumerate(mel):
 voice='flute' if 21<t<36 or 48<t<55 else 'oboe'
 tracks[voice].append([t,n,l,round(.49+.06*np.sin(i*.82),3)])
score={'title':'王都の午後','bpm':bpm,'beats':60,'meter':3,'tracks':tracks}
(root/'score.json').write_text(json.dumps(score,ensure_ascii=False,separators=(',',':'))+'\n')
N=round(60*beat*sr);mix=np.zeros((N,2),np.float64);rng=np.random.default_rng(356)
spec={
 'oboe':([1,.41,.22,.085,.024,.013],.143,.39,.205,-.16,2.5),
 'flute':([1,.13,.037,.018,.004],.157,.40,.162,.18,3.6),
 'strings':([1,.38,.20,.10,.053,.034,.018],.360,.57,.116,-.34,2.9),
 'cello':([1,.47,.24,.11,.046,.024],.218,.44,.170,.05,2.1),
 'harp':([1,.26,.16,.055,.033,.018],.041,.53,.130,.37,0),
 'horn':([1,.33,.14,.075,.027],.265,.45,.103,.08,1.95)}
def envelope(t,attack,l,release):
 u=np.clip(t/attack,0,1);v=np.clip((t-l)/release,0,1)
 return (.5-.5*np.cos(pi*u))*(.5+.5*np.cos(pi*v))
for voice,notes in tracks.items():
 harm,attack,release,vol,pan,vib=spec[voice]
 for time,midi,duration,velocity in notes:
  l=beat*duration
  t=np.arange(round((l+release)*sr))/sr
  f=440*2**((midi-69)/12)
  vn=5.05+rng.uniform(-.31,.31)
  det=f*vib*.000577*np.clip((t-.12)/.31,0,1)*np.sin(2*pi*vn*t+rng.uniform(0,2*pi))
  core=np.cumsum((f+det)*(2*pi/sr))
  x=np.zeros(t.shape)
  for k,h in enumerate(harm,1):
   ph=rng.uniform(-.35,.35)
   amp=h*(1+.028*np.sin(2*pi*(.28+k*.058)*t+ph))
   if voice=='harp':amp=amp*np.exp(-t*(1.5+.65*k))
   x+=amp*np.sin(k*core+ph)
   if voice in ['strings','cello']:
    x+=.27*amp*np.sin(k*core+k*2*pi*f*rng.uniform(.0023,.0038)*t+ph+.48)
  s=x*envelope(t,min(attack,l*.72),l,release)*vol*velocity
  ix=(round(time*beat*sr)+np.arange(t.size))%N
  loc=max(-.8,min(.8,pan+rng.uniform(-.145,.145)))
  mix[ix,0]+=s*np.sqrt(.5-.5*loc);mix[ix,1]+=s*np.sqrt(.5+.5*loc)
direct=mix.copy()
# Parallel circular reflections (every tail overlaps the following loop).
for i in range(15):
 delay=int(sr*(.029+i*.027+rng.uniform(0,.011)))
 tail=direct[:,::-1] if i%2 else direct
 mix+=np.roll(tail,delay,axis=0)*(.097*np.exp(-i*.23))
gain=min(.63/np.max(np.abs(mix)),.102/np.sqrt(np.mean(mix**2)))
mix*=gain
path=root/'valdia.ogg'
subprocess.run(['ffmpeg','-y','-hide_banner','-loglevel','error','-f','f32le','-ar',str(sr),'-ac','2','-i','pipe:0',
 '-c:a','libvorbis','-q:a','3','-metadata','title=王都の午後',str(path)],input=mix.astype('<f4').tobytes(),check=True)
print('frames',N,'seconds',N/sr,'ogg',path.stat().st_size,'peak',np.max(np.abs(mix)),'RMS',np.sqrt(np.mean(mix**2)))
