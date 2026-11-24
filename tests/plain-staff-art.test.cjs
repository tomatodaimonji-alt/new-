const fs=require('node:fs'),vm=require('node:vm'),a=require('node:assert/strict'),{test}=require('node:test');
const h=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const cut=(a,b)=>h.slice(h.indexOf(a),h.indexOf(b,h.indexOf(a)+1));
const mesh=()=>({p:[],n:[],c:[]});
function harness(){
 const c={mesh};
 vm.createContext(c);
 vm.runInContext(cut('function tri(','function naturalCrown(')+cut('function poiLongWoodStaffGeometry(','// BEGIN NORTH MINOTAUR REWARD AXE')+
  cut('function poiFantasyEquipmentGeometry(','// BEGIN ENEMY HELD WEAPON')+
  cut('function characterArmRotation(','function roundStack(').split('\n\n')[0]+'\n'+
  cut('function poiEnemyWeaponRig(','// END ENEMY HELD WEAPON'),c);
 return c;
}
function box(m){
 let lo=[Infinity,Infinity,Infinity],hi=lo.map(x=>-x);
 for(let i=0;i<m.p.length;i++){const axis=i%3;lo[axis]=Math.min(lo[axis],m.p[i]);hi[axis]=Math.max(hi[axis],m.p[i]);}
 return{lo,hi,extent:hi.map((n,i)=>n-lo[i])};
}
test('the actual common prop has a sturdy visible shaft and remains distinctly shorter than the long staff',()=>{
 const c=harness(),p=mesh(),l=mesh();
 c.poiFantasyEquipmentGeometry(p,'equipPlainStaff',0,0,0);
 c.poiFantasyEquipmentGeometry(l,'equipLongStaff',0,0,0);
 const size=box(p);
 a(size.extent[0]>.15&&size.extent[2]>.15,'old thin twig should not pass');
 a(size.extent[0]<.26&&size.extent[2]<.26);
 a(size.lo[1]>=0&&size.hi[1]<=1.06&&size.hi[1]>.99);
 a(box(l).extent[1]>2*size.extent[1]);
 a.equal(p.p.length,p.n.length);a.equal(p.p.length,p.c.length);a(p.p.every(Number.isFinite));
});
test('plain staff grip is centered at actual floor and inventory transform pivot; action profile remains intact',()=>{
 const c=harness(),p=mesh(),w=mesh();
 c.poiFantasyEquipmentGeometry(p,'equipPlainStaff',0,0,0);
 const grip=.39,at=[];
 for(let i=0;i<p.p.length;i+=3){const [x,y,z]=p.p.slice(i,i+3);if(Math.abs(y-grip)<.047)at.push([x,y,z]);}
 const gripBox=box({p:at.flat()});
 a(at.length>30&&gripBox.extent[0]>=.12&&gripBox.extent[0]<.17);
 a(Math.abs(gripBox.lo[0]+gripBox.hi[0])<.014&&Math.abs(gripBox.lo[2]+gripBox.hi[2])<.014);
 const pose=c.poiEnemyWeaponRig('equipPlainStaff',{phase:'windup'},{pending:true,start:100,hit:900},760);
 c.poiEnemyHeldMesh(w,p,pose,0,0,0,.90,grip);
 a(w.p.length>p.p.length&&w.p.every(Number.isFinite));
 a.match(h,/equipPlainStaff:\{range:1,damage:23,hit:140,ready:350,pose:300,speed:3,reach:1\}/);
 a(h.includes("weapon==='equipPlainStaff' ? .39"));a(h.includes("type==='equipPlainStaff'?.39"));
});
