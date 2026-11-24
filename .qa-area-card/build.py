from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);data=src.read_text();lane=Path(__file__).parent
a='#viewWrap[data-analog-play] #poiPartyCards .poiPartyCard{position:static;width:auto}'
assert data.count(a)==1
data=data.replace(a,a+'\n'+(lane/'area-card.css').read_text())
a='  // The label moves on its own, without reflowing the clock or the map.'
b=" }else poiLocationAnimation=panel.animate(["
i=data.index(a,data.index('// BEGIN LOCATION PANEL MOTION'));j=data.index(b,i)
old=data[i:j]
assert "const peak='translateX('+outward+'px) scale('+scale+')';" in old and 'duration:1750' in old
data=data[:i]+(lane/'area-pulse.js').read_text()+data[j:]
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(data)
