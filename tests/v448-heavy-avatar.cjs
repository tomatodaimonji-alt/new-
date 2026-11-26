const a=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const s=fs.readFileSync(process.argv[2],'utf8');
const fn=name=>{const out=s.match(new RegExp('^function '+name+'\\([^]*?^}','m'))?.[0];a.ok(out,name);return out};
const A=fn('poiWalkAvatar');
const c={poiWalkMesh:null,poiWalkActive:true,poiWalkActionStarted:-1e8,poiWalkActionWeapon:undefined,poiWalkAttackPosePending:false,
 poiWalkStarted:-1e8,poiWalkStepMs:100,poiWalkViewX:3,poiWalkViewZ:4,poiWalkX:3,poiWalkZ:4,poiWalkFromX:3,poiWalkFromZ:4,poiWalkLevel:0,poiWalkFacing:0,
 EQUIPMENT_IDS:[],poiFreePose:{walking:true,distance:.3,angle:.65},gl:{DYNAMIC_DRAW:35048,deleteBuffer:()=>{}},poiPlayerActionProfile:()=>null,
 poiRoleToolGripStyle:()=>null,poiSpearType:()=>false,poiBareFistPose:()=>null,poiCreekPlayerHeight:()=>0,
 poiBuildPlayerMesh:(weapon,pose,gear,stride,rot,x,y,z,heading)=>({orvasEyeSockets:[x,y,z,heading,stride]})};
let made=0,uploads=0,deletes=0;
c.upload=(m,reuse,usage)=>{uploads++;return {buf:reuse||{id:++made},count:40,usage}};
c.gl.deleteBuffer=()=>{deletes++};
vm.createContext(c);vm.runInContext(A,c);
c.poiWalkAvatar(150);const first=c.poiWalkMesh.buf;
for(let i=0;i<20;i++){
 c.poiWalkViewX=3+i/20;c.poiFreePose.distance+=.05;c.poiWalkAvatar(170+i*16);
 a.equal(c.poiWalkMesh.orvasEyeSockets[0],3.5+i/20,'world socket refreshed at actual pose');
}
a.equal(uploads,21,'all pose updates kept');
a.equal(c.poiWalkMesh.buf,first,'keep a stable GPU buffer during the walk instead of recreating every frame');
a.equal(made,1);a.equal(deletes,0);
c.poiWalkActive=false;c.poiWalkAvatar(900);
a.equal(c.poiWalkMesh,null);a.equal(deletes,1);
console.log('Avatar GPU buffer reused, live pose and eye attachment preserved, and cleanup once');
