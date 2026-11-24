from pathlib import Path
import sys
src,out=map(Path,sys.argv[1:])
s=src.read_text()
def rep(a,b):
 global s
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b,1)
rep('function poiCompanionTick(now){',
 Path(__file__).with_name('seam.js').read_text()+'\nfunction poiCompanionTick(now){')
# Cross-realm actor bypasses only the old spawn and local combat/physics. Old
# menu blockers and active token ownership are still authoritative.
a=""" const where=poiCompanionPlace();
 if(!poiCompanionActor||poiCompanionActor.id!==id||!poiCompanionSame(poiCompanionActor,where)){"""
b=""" const where=poiCompanionPlace();
 if(typeof poiCompanionSeamFrame==='function'&&poiCompanionActor?.id===id&&poiCompanionSeamFrame(now,
    typeof document!=='undefined'&&document.querySelector('dialog[open],.modal.open,:is(#poiBagPanel,#poiLandscapeMenu,#poiNpcMenu,#poiScreenNoteLayer):not([hidden])')))return;
 if(!poiCompanionActor||poiCompanionActor.id!==id||!poiCompanionSame(poiCompanionActor,where)){"""
rep(a,b)
rep(" if(!poiCompanionType(id)||!poiInventorySlots(kit).some(c=>c?.type===id)){poiCompanionActor=null;poiCompanionTarget=null;return}",
""" if(!poiCompanionType(id)||!poiInventorySlots(kit).some(c=>c?.type===id)){
  poiCompanionActor=null;poiCompanionTarget=null;
  if(typeof poiCompanionSeamFrame==='function')poiCompanionSeamFrame(now);
  return;
 }""")
rep(' if(!poiCompanionAllowed()){\n  poiCompanionActor=null;poiCompanionTarget=null;',
''' if(!poiCompanionAllowed()){
  poiCompanionActor=null;poiCompanionTarget=null;
  if(typeof poiCompanionSeamFrame==='function')poiCompanionSeamFrame(now);''')
a=""" if(a.id==='orvasSoul'&&typeof poiCompanionOrvasPose==='function')return poiCompanionOrvasPose(a,now,facing);"""
rep(a,""" if(a.id==='orvasSoul'&&typeof poiCompanionOrvasPose==='function'){
  const pose=poiCompanionOrvasPose(a,now,facing);
  return typeof poiCompanionSeamRender==='function'?poiCompanionSeamRender(a,pose):pose;
 }""")
rep(""" return {...art,facing};
}
function poiCompanionWorldVisible(a){""",""" const pose={...art,facing};
 return typeof poiCompanionSeamRender==='function'?poiCompanionSeamRender(a,pose):pose;
}
function poiCompanionWorldVisible(a){
 if(a&&typeof poiCompanionSeamVisible==='function'&&poiCompanionSeamVisible(a))return true;""")
rep(""" const {onBase,base,incoming,map}=prepared,hp=poiPlayerHP,cooldown=poiAttackReady;
 if(onBase)poiSnowPassBase=base;""",""" const {onBase,base,incoming,map}=prepared,hp=poiPlayerHP,cooldown=poiAttackReady;
 const companionSeam=typeof poiCompanionSeamCapture==='function'?poiCompanionSeamCapture(dest,now,cold):null;
 if(onBase)poiSnowPassBase=base;""")
rep(""" poiSnowPassSwitches++;
 if(!onBase)poiSnowPassBase=null;""",""" if(companionSeam&&typeof poiCompanionSeamCommit==='function')poiCompanionSeamCommit(companionSeam,now);
 poiSnowPassSwitches++;
 if(!onBase)poiSnowPassBase=null;""")
# A recall visual may freeze only a body that was truly submitted in
# the shared view; mutation/HP remain in the existing v306 transaction.
if 'function poiCompanionRecallMake(a,now,reason,kit){' in s:
 rep('''function poiCompanionRecallMake(a,now,reason,kit){
 if(!a||!['manual','player-death'].includes(reason)||kit?.companionSoul?.active!==a.id||
    !poiCompanionSame(a,poiCompanionPlace())||''',
'''function poiCompanionRecallMake(a,now,reason,kit){
 const shared=a&&typeof poiCompanionSeamVisible==='function'&&poiCompanionSeamVisible(a)&&
   poiCompanionWorldActor===a&&!!poiCompanionDrawPose;
 if(!a||!['manual','player-death'].includes(reason)||kit?.companionSoul?.active!==a.id||
    !shared&&!poiCompanionSame(a,poiCompanionPlace())||''')
 rep(" if(typeof poiDungeonVisualVisible==='function'&&!poiDungeonVisualVisible(a.x,a.z,a.y))return false;",
     " if(!shared&&typeof poiDungeonVisualVisible==='function'&&!poiDungeonVisualVisible(a.x,a.z,a.y))return false;")
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(s)
