from pathlib import Path
import sys
base,out=map(Path,sys.argv[1:])
s=base.read_text()
def patch(a,b):
 global s
 if s.count(a)!=1: raise RuntimeError(f'anchor count {s.count(a)}: {a[:150]}')
 s=s.replace(a,b,1)
patch('towncook:0,food:openingFood(),procDay:-1,procSerial:0,order:null','towncook:0,diningkeeper:0,shift:{day:-1,served:0,xp:0},food:openingFood(),procDay:-1,procSerial:0,order:null')
a="  for(const id of ['toolkeeper','innkeeper','towncook'])if(!integer(p[id],0,p.issued))return null;"
patch(a,'''  if(!Object.hasOwn(p,'diningkeeper')&&!Object.hasOwn(p,'shift')){p.diningkeeper=0;p.shift={day:-1,served:0,xp:0}}
  for(const id of ['toolkeeper','innkeeper','towncook','diningkeeper'])if(!integer(p[id],0,p.issued))return null;
  const q=p.shift;
  if(!q||!integer(q.day,-1,Math.floor(Number.MAX_SAFE_INTEGER/1440))||!integer(q.served,0,8)||
     !integer(q.xp,0,Math.min(20,q.served))||(q.served===0)!==(q.day===-1))return null;''')
patch('f.inn+f.supplier+f.eaten!==10','f.inn+f.supplier+f.eaten+q.served!==10')
patch('p.innkeeper+p.towncook+','p.innkeeper+p.towncook+p.diningkeeper+')
patch("['toolkeeper','innkeeper','towncook'].includes(id)","['toolkeeper','innkeeper','towncook','diningkeeper'].includes(id)")
patch("['toolkeeper','innkeeper','towncook'].includes(a?.role?.id)","['toolkeeper','innkeeper','towncook','diningkeeper'].includes(a?.role?.id)")
a='function poiTownNpcRoutine(a,clock,now,budget){'
patch(a,Path(__file__).with_name('shift.js').read_text()+a)
a=" if(role.role==='adventurer'&&m>=POI_TOWN_OPEN&&m<POI_TOWN_CLOSE&&poiTownNpcShop(a,now,budget))return;"
patch(a,a+"\n if(typeof poiTownNpcPaidShift==='function'&&poiTownNpcPaidShift(a,clock,now,budget))return;")
out.write_text(s)
