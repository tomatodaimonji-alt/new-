from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);s=src.read_text()
a='#poiPartyHud #poiCompanionHud[hidden]{display:none!important}'
assert s.count(a)==1
s=s.replace(a,a+'\n'+(Path(__file__).parent/'chest-party-hud.css').read_text())
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
