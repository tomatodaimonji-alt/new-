const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const extract=(a,b)=>{const i=html.indexOf(a),j=html.indexOf(b,i+1);assert(i>=0&&j>i,'missing '+a);return html.slice(i,j)};
const geometry=()=>extract('function poiCellarEntryGeometry(','function poiPottedPlantGeometry(');
const build=(call)=>vm.runInNewContext(`
 function cube(m,x,y,z,w,h,d,c){m.push({kind:'cube',x,y,z,w,h,d,c})}
 function naturalBranch(m,ax,ay,az,bx,by,bz,r1,r2,c){m.push({kind:'rail',ax,ay,az,bx,by,bz,r1,r2,c})}
 function tri(){}
 ${geometry()}
 const m=[];${call};m
 `);
test('Shaft lining stays below grade instead of creating tall black boxes',()=>{
 const lining=build('poiCellarShaftLining(m,3,5,7)');
 assert(lining.length>=3);
 assert(lining.every(o=>o.y+o.h<5));
 assert(lining.some(o=>o.y+o.h>4.8),'no disconnected lining lip');
 assert.match(html,/poiCellarShaftLining\((?:m|grade),x\+\.5,h,z\+\.5\)/);
});
test('Stair aperture has a clear axis and only one sparse light handrail',()=>{
 const entry=build('poiCellarEntryGeometry(m,0,0,0)');
 const solids=entry.filter(o=>o.kind==='cube');
 assert(solids.every(o=>o.y+o.h<=.66));
 assert(solids.every(o=>!(Math.abs(o.x)<.26&&o.w>.3&&o.y+o.h>.085)));
 assert.equal(entry.filter(o=>o.kind==='rail').length,1);
 assert(solids.every(o=>o.c[0]>.38&&o.c[1]>.25));
});
test('A real paired cellar flight has distinct exposed warm treads descending away from upper -Z entry',()=>{
 const stairs=build('poiCellarFlightGeometry(m,0,-1.4,0)');
 const tread=stairs.filter(o=>o.kind==='cube'&&o.w>=.70&&o.d>.070);
 assert(tread.length>=8);
 const surface=tread.sort((a,b)=>a.z-b.z);
 assert(surface[0].y+surface[0].h<.005 &&surface[0].y+surface[0].h>-.09);
 assert(surface.at(-1).y+surface.at(-1).h<-1.10);
 for(let i=1;i<surface.length;i++)assert(surface[i].y+surface[i].h<surface[i-1].y+surface[i-1].h);
 assert.match(html,/facilityHasDiningCellarPart\(o,'guildStairUp',-1\)/);
 assert.match(html,/facilityHasDiningCellarPart\(o,'guildStairDown',0\)/);
});
