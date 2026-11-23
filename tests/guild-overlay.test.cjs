const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const body=html.match(/function guildBounds\(objects=world\)\{[\s\S]*?(?=function guildAtriumRailing\()/)?.[0];
const facilityGuildHelper=html.match(/function facilityUsesGuildRendering\(\)\{[^\n]+/)?.[0]??'';
const world=Array.from({length:13},(_,x)=>[{x,y:0,z:0,type:'stonewall'},{x,y:0,z:10,type:'stonewall'}]).flat()
 .concat([5,6,7].map(x=>({x,y:0,z:5,type:'counterWood'})));
const classify=facilitySite=>vm.runInNewContext(facilityGuildHelper+'\n'+body+'\nguildBounds()', {world,facilitySite});
test('preserve the old guild decoration detection in the ordinary editor',()=>assert(classify(null)));
test('no guild decoration inference leaks into an independent facility preview',()=>{
 for(const id of ['kitchen','base','lodging'])assert.equal(classify({id}),null,id);
});
const overlay=html.match(/function buildSignOverlay\(\)\{[\s\S]*?(?=const signVert=)/)?.[0];
const visibility=html.match(/function facilityObjectVisible\([\s\S]*?(?=function poiChestInvalidateModel\()/)?.[0];
assert(visibility,'extract the real scene slice predicate');
const atlas=(facilitySite,level=0)=>vm.runInNewContext([facilityGuildHelper,body,visibility,overlay,
 'buildSignOverlay().map(x=>x.id).join(",")'].join('\n'),{
 world,facilitySite,hideUpper:false,level,SIGN_TYPES:['pineGuildWorldMap'],poiWalkActive:true,
 facilityViewLevel:()=>level,facilityVisibilityOwner:()=>null,facilityIsRoofPiece:()=>false,
 pineGuildAtlasLayout:()=>({x:6.5,faceZ:1,y:0,left:-.55,right:.55,bottom:.60,top:1.2}),
 gl:{createBuffer:()=>1,bindBuffer:()=>{},bufferData:()=>{}}
});
test('ordinary guild atlas quad is still emitted, while none is emitted in facility cutaway',()=>{
 assert.equal(atlas(null),'pineGuildWorldMap');
 assert.equal(atlas({id:'guildsaved'}),'pineGuildWorldMap');
 assert.equal(atlas({id:'guildsaved'},-1),'','no atlas when its own backing wall is off-floor');
 assert.equal(atlas({id:'kitchen'}),'');
});
