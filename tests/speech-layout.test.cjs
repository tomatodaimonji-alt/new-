const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(process.env.HTML||path.join(__dirname,'..','world-editor.html'),'utf8');
const panel={left:8,right:382,top:195,bottom:273},size={width:193,height:64};
function fixture(){
 const found=html.match(/\/\/ BEGIN SPEECH PLACEMENT\n([\s\S]*?)\/\/ END SPEECH PLACEMENT/);assert.ok(found,'projected bubble placement code is present');
 const c=vm.createContext({});vm.runInContext(found[1],c);return c;
}
test('natural anchor is exact when panels do not overlap; conflicting bubble prefers the gap above the status controls',()=>{
 const c=fixture();
 const place=(x,y,panelRect=panel)=>c.poiTownSpeechPlace({x,y},size,panelRect,619);
 assert.equal(place(210,180).top,180);assert.equal(place(210,180).side,'natural');
 assert.equal(place(210,261).left,210);assert.equal(place(210,261).side,'above');assert.ok(place(210,261).top-8<panel.top);
 assert.equal(place(210,344).side,'above');assert.ok(place(210,344).top-8<panel.top);
 const shortTop={left:8,right:382,top:58,bottom:135};
 assert.equal(place(210,132,shortTop).side,'below');
 assert.equal(place(210,261,null).top,261);
});
