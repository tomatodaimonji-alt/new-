from pathlib import Path
from sys import argv
src,out=map(Path,argv[1:3]);code=src.read_text();here=Path(__file__).parent
def p(a,b):
 global code
 assert code.count(a)==1,(a,code.count(a))
 code=code.replace(a,b)
anchor='<p id="poiItemDetailFeedback"'
p(anchor,'''<dl id="poiItemDetailSoulStats" aria-label="仲間のステータス" hidden>
  <div><dt>攻撃</dt><dd id="poiItemDetailSoulAttack"></dd></div>
  <div><dt>防御</dt><dd id="poiItemDetailSoulDefense"></dd></div>
  <div><dt>HP</dt><dd id="poiItemDetailSoulHP"></dd></div>
 </dl>
 '''+anchor)
for a in ['{display:grid;gap:1px','[hidden]{','>div{',' dt{',' dt::after{',' dd{']:
 p('#poiItemDetailWeaponStats'+a,':is(#poiItemDetailWeaponStats,#poiItemDetailSoulStats)'+a)
p('const POI_ORVAS_ALLY_NOTICE=', 'const POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE=36;\nconst POI_ORVAS_ALLY_NOTICE=')
p('poiOrvasAllyHits(a,q,now,36,[', 'poiOrvasAllyHits(a,q,now,POI_ORVAS_ALLY_SWEEP_BEAM_DAMAGE,[')
p("if(soul)return '仲間を呼び出す魂。耐久は仲間の体力（'+cell.durability+' / '+soul.hp+'）。力尽きると魂も消える。';",
  "if(soul)return '仲間を呼び出す魂。耐久は仲間のHPと同じで、力尽きると魂も消える。';")
p('function poiItemDetailClose(restore=true){',(here/'soul-stats.js').read_text()+'function poiItemDetailClose(restore=true){')
p(' poiItemDetailRenderWeaponStats(cell.type);',' poiItemDetailRenderWeaponStats(cell.type);\n if(typeof poiItemDetailRenderSoulStats===\'function\')poiItemDetailRenderSoulStats(cell);')
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(code)
