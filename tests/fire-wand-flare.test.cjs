const assert=require('node:assert/strict'),fs=require('node:fs'),test=require('node:test');
const html=fs.readFileSync(process.env.HTML||'world-editor.html','utf8');
const asset=name=>{
 const m=html.match(new RegExp('\\n '+name+':\\s*((?:\'[A-Za-z0-9+/=]+\'\\s*(?:\\+\\s*)?)+)'));
 assert(m,name);
 return Buffer.from([...m[1].matchAll(/'([^']+)'/g)].map(x=>x[1]).join(''),'base64');
};
test('recorded fire wand is a short immediately voiced one-shot with smooth quiet tail and headroom',()=>{
 const b=asset('wandFlameLaunch'),n=b.length/2,a=Array.from({length:n},(_,i)=>b.readInt16LE(i*2)/32768);
 assert(n>=3360&&n<=4800,'140–200 ms only, no sustained torch');
 const rms=(s,e)=>Math.sqrt(a.slice(s,e).reduce((sum,x)=>sum+x*x,0)/(e-s));
 assert(Math.abs(a[0])<=1/32768&&Math.abs(a.at(-1))<=1/32768,'clickless endpoints');
 const max=Math.max(...a.map(Math.abs));
 assert(max>=.22&&max<=.60,'one shot peak .22–.60 before normal mixer');
 const peak=a.findIndex(x=>Math.abs(x)>=max);
 assert(peak<1680,'body arrives within first 70ms');
 assert(rms(120,n*.30|0)>=.045,'audible body before the short decay');
 assert(rms(n-480,n)<rms(120,n*.30|0)*.09,'last 20ms not a hiss');
 assert(html.includes("poiTryRecordedFoley('wandFlameLaunch',now,.52)"),'same launch routing and mixing');
});
