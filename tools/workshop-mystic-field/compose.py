"""Original 16-measure 『星霧の野』; render only from eight real CC0 VSCO2 takes."""
from pathlib import Path
import argparse, json, hashlib, subprocess, math
import numpy as np
from scipy import signal
P=Path(__file__).resolve().parent
S=32000
BPM=84
BEAT=60/BPM
N=round(64*BEAT*S)
ROWS=json.loads((P/'sources.json').read_text())
TAKES={
 'flute':[('flute-a',69),('flute-c',72)],'viola':[('viola-a',57),('viola-e',64)],
 'cello':[('cello-d',38),('cello-a',45)],'harp':[('harp-a',69),('harp-e',76)]}
# Measured concert fundamentals: the VSCO flute, viola and cello folders
# use a one-octave-lower filename convention. Keep the fingering-based
# sample choice, but calibrate playback rates to the recorded frequency.
ROOT_OFFSET={'flute':12,'viola':12,'cello':12,'harp':0}
def ff(*args, **kw):
 return subprocess.run(['ffmpeg','-hide_banner','-loglevel','error',*map(str,args)],check=True,**kw)
def source(k):
 a=next(d for d in ROWS if d['id']==k)
 p=P/'original'/f'{k}.wav'
 raw=p.read_bytes()
 if len(raw)!=a['bytes'] or hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()!=a['blob']:
  raise ValueError('incomplete/wrong public sample: '+str(p))
 x=np.frombuffer(ff('-i',p,'-map','0:a:0','-ac','1','-ar',S,'-c:a','pcm_f32le','-f','f32le','pipe:1',
  stdout=subprocess.PIPE).stdout,dtype='<f4').astype(np.float64)
 x=signal.sosfilt(signal.butter(2,[42,6900],fs=S,btype='bandpass',output='sos'),x)
 # Crop only the recording's leading dead air, retaining its live attack.
 env=np.sqrt(np.mean(x[:len(x)//160*160].reshape(-1,160)**2,axis=1))
 first=np.flatnonzero(env>max(env.max()*.10,1e-4))[0]*160
 return x[max(0,first-int(.035*S)):]
def compose():
 takes={k:source(k) for pairs in TAKES.values() for k,_ in pairs}
 mix=np.zeros((N,2))
 rng=np.random.default_rng(21291)
 totals=dict.fromkeys(TAKES,0)
 used=set()
 def note(inst,b,pitch,d,level,pan):
  chosen,base=min(TAKES[inst],key=lambda v:abs(pitch-v[1]));used.add(chosen)
  src=takes[chosen]; cents=rng.uniform(-2.5,2.5)*(0.45 if inst=='harp' else 1)
  speed=2**((pitch-base-ROOT_OFFSET[inst]+cents/100)/12)
  rise,release={'cello':(.24,.62),'viola':(.40,.67),'flute':(.076,.37),'harp':(.014,.46)}[inst]
  off=d*BEAT; t=np.arange(min(round((off+release)*S),int((len(src)-1)/speed)))/S
  if len(t)<100: raise ValueError((inst,pitch,'not enough recorded signal'))
  a=np.interp(t*S*speed,np.arange(len(src)),src)
  rms=np.sqrt(np.mean(a[:max(1,min(len(a),round(off*S)))]**2))
  attack=np.sin(np.pi/2*np.clip(t/rise,0,1))**2
  tail=np.maximum(.035,min(release,t[-1]-max(0,off)))
  down=np.clip((t[-1]-t)/tail,0,1)
  phrase=np.ones_like(t)
  if inst!='harp': phrase=.84+.16*np.sin(np.pi*np.minimum(1,t/max(off,.01)))
  x=a*attack*np.sin(np.pi/2*down)**2*phrase*(level/max(.005,rms))
  pan=max(-.90,min(.9,pan+rng.uniform(-.035,.035)))
  stereo=x[:,None]*np.sqrt([1-pan,1+pan])[None,:]*.7071068
  jitter=rng.uniform(-.016,.016) if abs(b-round(b))>.01 else rng.uniform(-.008,.008)
  start=round((b*BEAT+jitter)*S)%N
  end=min(N-start,len(x));mix[start:start+end]+=stereo[:end]
  if end<len(x):mix[:len(x)-end]+=stereo[end:]
  totals[inst]+=1
  return
 # Dorian palette with suspended/add9 voicings and no tonic-dominant march.
 # Cello: D/A bed -> C bass -> G/B colour -> suspended A turning toward D.
 chords=[
  (38,57,64),(45,60,64),(36,55,62),(43,59,64),
  (38,57,65),(40,59,64),(43,62,69),(45,55,66),
  (38,60,69),(41,57,67),(36,55,64),(43,59,62),
  (40,55,62),(41,57,65),(45,59,64),(38,57,64)]
 for bar,(bass,v1,v2) in enumerate(chords):
  beat=4*bar
  # Pads enter before the bar, overlap into the next, and wrap the loop.
  note('cello',beat-.31,bass,4.48,.046+(bar%4==2)*.003,-.15)
  note('viola',beat-.04,v1,4.1,.029,-.40)
  if bar not in (1,5,12,15):note('viola',beat+.48,v2,3.65,.021,.43)
  # Sparse non-metronomic harp glimmers; no drums or tick track.
  pairs=[[(.7,69),(2.65,76)],[(1.45,72)],[(.3,67),(3.1,74)],[(1.05,71),(2.4,76)],
         [(0.0,77)],[(1.7,71),(3.3,76)],[(.8,74),(2.7,81)],[(1.9,78)],
         [(0.6,72),(2.25,81)],[(1.45,77)],[(.15,67),(2.9,76)],[(1.35,74)],
         [(1.8,71)],[(.6,69),(3.3,77)],[(.8,76),(2.65,71)],[(1.5,69)]]
  for j,(when,p) in enumerate(pairs[bar]):note('harp',beat+when,p,1.6 if j==0 else 1.15,.017 if j==0 else .013,.32 if j==0 else .51)
 # Written four motifs; leading woodwind takes deliberate breaths.
 melody=[
 [(1.0,69,1.05),(2.35,72,.57),(3.12,76,1.42),(5.02,74,1.26),(6.85,69,.82)],
 [(8.5,67,1.45),(10.32,71,.74),(11.43,74,1.48),(13.21,72,.70),(14.15,69,1.35)],
 [(16.75,69,.94),(18.,74,1.24),(19.48,77,1.25),(21.0,76,.78),(22.2,71,1.3)],
 [(24.55,74,.72),(25.64,76,1.27),(27.15,81,1.92),(29.55,78,.76),(30.55,74,.92)],
 [(32.76,76,1.04),(34.02,72,.65),(34.9,69,1.63),(37.0,67,.62),(37.86,69,1.21)],
 [(40.6,67,1.33),(42.3,72,.92),(43.45,76,.82),(44.52,74,1.62),(46.5,71,.96)],
 [(49.15,71,.6),(50.03,67,1.22),(51.59,69,.73),(52.55,72,1.1),(53.86,77,1.48)],
 [(56.41,76,1.04),(57.75,71,.63),(58.72,69,1.15),(60.2,74,1.64),(62.24,69,.75)]]
 for k,phrase in enumerate(melody):
  for i,(beat,pitch,duration) in enumerate(phrase):
   note('flute',beat,pitch,duration,(.032+.004*(k%4==3))*(1 if i in (1,2) else .82),.19)
 # Small dark spatial returns are circular, making the last/first tail
 # continuous without codec padding or a wash over the original breathing.
 wet=np.column_stack([mix[:,0]*.78+mix[:,1]*.22,mix[:,1]*.78+mix[:,0]*.22])
 filt=signal.butter(2,[180,4200],fs=S,btype='bandpass',output='sos')
 wet=signal.sosfilt(filt,np.tile(wet,(2,1)),axis=0)[N:]
 for off,g,cross in [(.079,.089,True),(.137,.064,False),(.239,.044,True),(.369,.032,False),(.517,.019,True)]:
  mix+=np.roll(wet[:,::-1] if cross else wet,round(S*off),axis=0)*g
 mix-=mix.mean(axis=0)
 print('events',totals,'all eight real source recordings used:',sorted(used))
 return mix
def main():
 a=argparse.ArgumentParser()
 a.add_argument('--quality',type=float,default=2.4);a.add_argument('--lufs',type=float,default=-20)
 opts=a.parse_args()
 wav=P/'mystic-field.wav';ogg=P/'mystic-field.ogg'
 mix=compose()
 def write(x):
  ff('-y','-f','f32le','-ar',S,'-ac',2,'-i','pipe:0','-c:a','pcm_s24le',wav,input=x.astype('<f4').tobytes())
 write(mix)
 loud=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',str(wav),'-af','ebur128=peak=true','-f','null','-'],
    capture_output=True,text=True,check=True).stderr
 import re
 m=list(re.finditer(r'I:\s+(-?\d+\.\d+) LUFS',loud))[-1];base=float(m[1])
 scale=min(10**((opts.lufs-base)/20),10**(-4/20)/np.max(np.abs(mix)))
 mix*=scale; write(mix)
 ff('-y','-i',wav,'-c:a','libvorbis','-q:a',opts.quality,'-metadata','title=星霧の野','-metadata','artist=3Dワールド工房 オリジナル',ogg)
 print('sources:',len(ROWS),'frames:',N,'duration:', N/S,'target LUFS:',opts.lufs,'achieved est:',base+20*np.log10(scale),'peak dBFS:',20*np.log10(np.max(np.abs(mix))),'bytes:',ogg.stat().st_size)
 for p in (wav,ogg): print(hashlib.sha256(p.read_bytes()).hexdigest(),p.name)
if __name__=='__main__':main()
