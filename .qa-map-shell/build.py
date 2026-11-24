from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);value=src.read_text();lane=Path(__file__).parent
start='#poiLocalMapDialog{position:fixed;inset:0;margin:auto;'
end='#poiLocationPanel{min-width:0;'
assert value.count(start)==1 and value.count(end)==1
i=value.index(start);j=value.index(end,i)
original=value[i:j]
assert '#poiLocalMapLarge{display:block' in original and 'grid-template-columns:auto 114px' in original and '<' not in original
value=value[:i]+(lane/'local-map-shell.css').read_text()+'\n'+value[j:]
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(value)
