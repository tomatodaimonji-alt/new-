const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const h=fs.readFileSync(process.argv[2]||path.join(__dirname,'south-camera-candidate.html'),'utf8');
for(const s of h.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
const part=(a,b)=>{const x=h.indexOf(a),y=h.indexOf(b,x+1);assert.ok(x>=0&&y>x);return h.slice(x,y);};
const c=vm.createContext({mesh:()=>({p:[],c:[],n:[]}),frontierHeight:()=>0,facilitySite:{id:'frontier'},poiWalkActive:true,
 poiWalkLevel:0,frontierSouthDoorFraction:1,frontierSouthRuinsOwn:(x,z)=>z>=81&&z<=96&&x>=147&&x<=165,
 frontierSouthCeilingHeight:()=>.81});
vm.runInContext([
 part('function tri(','// Low-poly natural assets'),
 part('const FRONTIER_SOUTH_STAIRS=','function frontierSouthSlopeLevel'),
 part('function frontierSouthGateArt(','function frontierSouthStairArt('),
 part('function poiWallCameraSlab(','function poiWallCameraCandidates('),
 part('function frontierSouthGatePlaceholder(','let frontierSouthMeshes=null'),
 'globalThis.f={cam:frontierSouthCoveredCamera,placeholder:frontierSouthGatePlaceholder};'
].join('\n'),c);
const cam=c.f.cam;
const unchanged=(a,b)=>assert.strictEqual(cam(a,b),b);
const hit=(a,b)=>{const p=cam(a,b);assert.notStrictEqual(p,b);return p;};
// Fields outside the temple are not limited by the dungeon plan under them.
unchanged([152,1.17,87],[148,4.92,92]);
unchanged([161,1.17,85.25],[161,4.92,91]);
unchanged([164,1.17,94],[169,3.4,98]);
unchanged([154,1.12,81.6],[150,1.82,82]);
const side=hit([167.5,1.15,78.3],[163,2,78.3]);assert.ok(side[0]>165);
const rear=hit([161,1.13,84],[161,2.25,78]);assert.ok(rear[2]>81.3);
const roof=hit([160.5,1.1,78.3],[160.5,6.1,78.3]);assert.ok(roof[1]>3.9&&roof[1]<4.2);
unchanged([160.5,1.25,76],[160.5,1.4,70]); // open aperture
c.frontierSouthDoorFraction=0;
const shut=hit([160.5,1.25,76],[160.5,1.4,70]);assert.ok(shut[2]>74.34);
c.frontierSouthDoorFraction=1;c.poiWalkLevel=-1;
const stair=hit([160.5,.06,79.9],[156.8,.3,80.1]);assert.ok(stair[0]>=159);
const cellar=hit([160.5,-.3,90],[160.5,3.5,92]);assert.ok(cellar[1]<=.63);
unchanged([160.5,-.3,90],[160.5,.2,92]); // real B1 path remaining within the room
assert.equal(c.f.placeholder({x:155,z:81,y:0,type:'stonewallAll'}),true);
assert.equal(c.f.placeholder({x:155,z:81,y:-1,type:'stonewallAll'}),false);
assert.ok(h.includes("if(facilitySite?.id==='frontier'&&frontierSouthGatePlaceholder(o))continue;"));
console.log('PASS no projected B1 snag outside, real pyramid sides/roof/leaf retained, open portal and B1 protection');
