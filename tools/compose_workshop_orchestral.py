"""Original Workshop scorebook. Each bar's melody and harmonic turn are authored below."""
from pathlib import Path
import argparse
import collections,json
spec={
# tempo, melody instrument, original lead line (MIDI[:beats]), chord plan, texture
'town':(88,'oboe',"""
67:1 71:.5 69:.5 74:2|72:1.5 71:.5 67:1 69:1|71:2 69:1 67:1|66:.5 69:.5 67:3|
67:1 71:.5 74:.5 76:1 74:1|72:2 69:1 67:1|64:1 67:1 69:.5 71:.5 72:1|69:1.5 66:.5 67:2|
74:1 76:1 79:1.5 78:.5|76:1 74:1 72:2|71:.75 74:.25 76:1 72:1 71:1|69:2 72:.5 71:.5 69:1|
67:.5 69:.5 71:1 74:2|72:1 76:1 74:1 69:1|71:1.5 69:.5 66:1 69:1|67:3 x:1""",
'G C Em D G Am C D Em C G Am G C D G','town'),
'indoor':(72,'flute',"""
64:2 67:1 71:1|69:1.5 67:.5 64:2|62:1 64:1 66:.5 69:.5 67:1|64:2 62:2|
64:1.5 67:.5 71:1 74:1|72:2 69:1 67:1|65:1 64:.5 62:.5 60:1 62:1|64:3 x:1|
67:1 72:1 76:2|74:1.5 72:.5 69:2|67:2 71:1 69:1|67:1.5 62:.5 64:2|
64:1 67:1 71:1.5 72:.5|69:2 67:1 64:1|62:1 65:1 64:1 62:1|64:3 x:1""",
'C Am Dm G C F Dm Em C Am G Em C Am G C','indoor'),
'outside':(102,'flute',"""
62:1 66:.5 64:.5 69:2|71:1 69:.5 66:.5 64:1 66:1|67:1.5 71:.5 74:2|73:2 69:1 66:1|
62:.5 64:.5 66:1 69:1 73:1|74:2 76:1 74:1|71:1 74:1 76:.5 74:.5 71:1|69:1.5 68:.5 69:2|
74:1 78:.5 76:.5 81:2|79:1.5 76:.5 74:1 73:1|71:1 74:1 76:2|78:2 76:1 73:1|
74:1 71:.5 67:.5 69:2|73:1 76:1 79:1 76:1|78:1.5 76:.5 73:1 69:1|74:3 x:1""",
'D A G A D Bm G A D G Em F#m G A A D','field'),
'market':(111,'oboe',"""
72:.5 76:.5 74:1 79:1 76:1|77:1 74:.5 72:.5 69:1 72:1|71:1 74:1 76:1 74:1|72:2 67:1 x:1|
72:.5 74:.5 76:1 79:.5 81:.5 79:1|77:1 72:1 74:.5 76:.5 77:1|76:.75 74:.25 72:1 71:1 67:1|72:2 x:1 67:1|
69:1 72:1 76:2|77:1.5 74:.5 72:2|74:1 77:1 81:.5 79:.5 77:1|76:2 74:1 71:1|
72:.5 76:.5 74:1 79:1 76:1|77:1.5 74:.5 72:1 69:1|74:.75 76:.25 77:1 74:1 71:1|72:3 x:1""",
'C F G C C F G C Am F Dm G C F G C','market'),
'mine':(76,'cello',"""
50:2 x:1 57:1|53:1 52:1 50:2|55:2 57:1 60:1|57:2 52:1 x:1|
50:1.5 53:.5 57:2|58:1 55:1 53:2|52:2 55:1 50:1|49:1 52:1 50:2|
57:1 60:1 64:2|62:2 60:1 55:1|53:1 57:1 62:2|61:1 57:2 x:1|
50:2 57:1 55:1|53:1 58:1 57:1 55:1|52:2 49:1 52:1|50:3 x:1""",
'Dm Dm Gm A Dm Bb Gm A Dm Gm Bb A Dm Bb A Dm','mine'),
'chapel':(70,'oboe',"""
64:2 71:1 69:1|67:2 64:2|62:1 64:1 66:2|63:2 66:1 x:1|
64:1 67:1 71:2|72:2 71:1 67:1|69:1 67:1 66:1 64:1|63:2 64:2|
71:2 74:1 76:1|77:2 76:1 74:1|72:1 69:1 67:2|66:2 63:2|
64:2 67:1 69:1|71:2 72:1 67:1|66:1 69:1 63:2|64:3 x:1""",
'Em C Am B Em C Am B Em D Am B Em C B Em','chapel'),
'otherworld':(80,'flute',"""
66:1.5 69:.5 73:2|74:1.5 73:.5 69:1 x:1|71:1 74:1 78:2|77:2 73:1 x:1|
66:1 69:.5 68:.5 73:2|76:1 74:1 71:2|69:.5 71:.5 74:1 73:1 69:1|68:2 77:1 x:1|
73:1.5 76:.5 81:2|79:2 76:1 74:1|78:1 74:1 71:2|73:2 77:2|
66:2 73:1 71:1|69:1 74:1 73:1 69:1|68:2 77:1 73:1|66:3 x:1""",
'F#m D Bm C# F#m E D C# F#m Em Bm C# F#m D C# F#m','other'),
'northFort':(86,'horn',"""
57:1 60:.5 59:.5 64:2|65:1.5 64:.5 60:1 62:1|64:1 67:1 69:2|68:2 64:1 x:1|
57:1 60:.5 64:.5 69:1 67:1|65:1 69:1 67:2|64:1.5 62:.5 60:1 62:1|64:3 x:1|
69:1 72:.5 71:.5 76:2|74:1 72:1 69:2|67:1 69:1 74:2|71:2 68:2|
69:1 65:.5 64:.5 60:2|62:1 65:1 64:1 62:1|59:2 64:1 68:1|57:3 x:1""",
'Am F C E Am F Dm E Am F Dm E F Dm E Am','fort'),
'battle':(132,'horn',"""
62:.5 65:.5 64:.5 69:1.5 x:.5 67:.5|70:1 69:.5 67:.5 65:1 64:1|62:.5 65:.5 69:1 74:1.5 72:.5|73:1 69:1 64:1 x:1|
62:.5 67:.5 65:.5 69:.5 70:2|69:1.5 65:.5 62:.5 65:.5 69:1|67:1 70:.5 74:.5 72:1 67:1|69:1 73:1 76:1 x:1|
74:.5 77:.5 76:.5 81:1.5 x:.5 79:.5|82:1 81:.5 79:.5 77:1 74:1|72:.5 74:.5 76:1 77:1 81:1|79:1 76:.5 73:.5 69:1 x:1|
70:1 69:.5 67:.5 65:1 74:1|72:.5 74:.5 70:1 67:1 65:1|64:1 69:1 73:.5 76:.5 73:1|74:2 69:1 x:1|
65:.5 67:.5 69:1.5 70:.5 69:1|65:1 70:.5 72:.5 74:1 77:1|76:1 73:1 69:1 64:1|62:2 57:1 x:1""",
'Dm Bb Dm A Gm Dm C A Dm Bb C A Bb Gm A Dm Dm Bb A Dm','battle')}
pc={'C':0,'C#':1,'D':2,'Eb':3,'E':4,'F':5,'F#':6,'G':7,'Ab':8,'A':9,'Bb':10,'B':11}
def chord(symbol):
 minor=symbol.endswith('m')
 pc0=pc[symbol.rstrip('m')]
 root=36+pc0
 return root,(root+12,root+12+(3 if minor else 4),root+19)
def build(key, desc):
 bpm,lead,melody,harm,style=desc
 bars=[s.strip() for s in melody.replace('\n','').strip().split('|')]
 chords=harm.split()
 assert len(bars)==len(chords),(key,len(bars),len(chords))
 tracks=collections.defaultdict(list)
 def add(inst, t,n,d,v):
  tracks[inst].append([round(t,3),n,round(min(d,len(bars)*4-t),3),round(v,3)])
 for i,(bar,symbol) in enumerate(zip(bars,chords)):
  start=i*4;root,tri=chord(symbol);phrase=i%4; b=0
  for j,s in enumerate(bar.split()):
   n,sep,d=s.partition(':')
   d=float(d) if sep else 1
   if n!='x':
    mi=int(n)
    pulse=(0.06 if b==0 else 0)+(0.035 if d>=1.5 else -0.015)
    add(lead,start+b,mi,d*({'battle':.84,'market':.82}.get(style,.94)),.63+pulse+(.025 if i>=8 else 0))
   b+=d
  assert b==4,(key,i,b)
  if style in ('battle','fort'):
   pat=[(0,root,0.74,.60),(1,root+7,.57,.43),(2,root,.70,.55),(3.0,root+12,.50,.47)] if style=='battle' else [(0,root,1.55,.50),(2,root+7,1.35,.38)]
   for t,n,d,v in pat:add('cello',start+t,n,d,v)
   for j,t in enumerate((0,1.5,2.75) if style=='battle' else (0,2.5)):
    for n in tri[1:]:add('strings',start+t,n+12,.62 if style=='battle' else 1.05,.22+.04*(j==0))
   add('timpani',start,root,.53,.42 if style=='battle' else .27)
   if style=='battle':
    add('timpani',start+2.5,root,.37,.27)
    for t in ([1.5,3,3.5] if phrase!=3 else [1,2,2.75,3,3.25,3.5]):add('snare',start+t,38,.17,.27 if t%1==0 else .16)
   elif phrase==3:add('snare',start+3.5,38,.22,.23)
  elif style=='market':
   add('cello',start,root,.65,.38);add('cello',start+2,root+7,.67,.30)
   for t in (.5,1.5,2.5,3.5):
    for n in tri[1:]:add('strings',start+t,n+12,.28,.19)
   for j,t in enumerate((0,1.5,2,3.5)):add('harp',start+t,tri[j%3]+12,.41,.30 if j%2==0 else .24)
  else:
   add('cello',start,root,3.48 if style in ('chapel','other','mine') else 1.72,.33 if lead=='cello' else .43)
   if style not in ('chapel','other','mine'):add('cello',start+2,root+7,1.65,.34)
   chordnotes=(tri[1]+12,tri[2]+12) if style in ('town','indoor','field') else (tri[0],tri[2])
   for n in chordnotes:add('strings',start+.03,n,3.75,.25 if style!='field' else .33)
   if style in ('town','indoor','field'):
    for j,t in enumerate((0,.75,1.5,2.25,3,3.5) if style!='indoor' else (0,1.25,2,3.25)):
     add('harp',start+t,tri[[0,2,1,2,0,1][j]]+(0 if j==0 else 12),.56,.27 if j%2 else .34)
   else:
    for j,t in enumerate((.75,2.5) if phrase%2==0 else (1.5,3)):
     add('harp',start+t,tri[(phrase+j)%3]+12,.77,.21)
   if style=='field' and i>=4:
    add('horn',start+.5,tri[0],1.16,.32);add('horn',start+2,tri[2],1.47,.30)
    if phrase==3:add('timpani',start+3.25,root,.43,.23)
  if style in ('town','market','indoor','chapel','mine','other','fort') and phrase in (1,3):
   alt='flute' if lead!='flute' else 'oboe'
   n=tri[1]+12 if style not in ('mine','fort') else tri[2]+12
   add(alt,start+1.5,n,1.1,.27);add(alt,start+3,n-2,.69,.20)
 for values in tracks.values():values.sort()
 return dict(bpm=bpm,beats=len(bars)*4,tracks=dict(tracks))
def main():
 scores={k:build(k,v) for k,v in spec.items()}
 text='// Original Workshop orchestral scores; authored melody, harmony and phrasing.\nconst POI_ORCHESTRAL_SCORES=\n'+json.dumps(scores,separators=(',',':'))+';\n'
 parser=argparse.ArgumentParser(description=__doc__)
 parser.add_argument('output',type=Path,help='path to generated score JavaScript')
 parser.parse_args().output.write_text(text,encoding='utf-8')
 for k,v in scores.items():print(k,round(60*v['beats']/v['bpm'],2),sum(map(len,v['tracks'].values())))
if __name__=='__main__':main()
