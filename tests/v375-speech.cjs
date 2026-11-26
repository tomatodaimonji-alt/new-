const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
const start=h.indexOf('function poiMessageSpeechFrame(');a(start>=0,'speech should reveal instead of writing all at once');
const frame=h.slice(start,h.indexOf('function poiMessageUpdate(',start));
const f=new Function(`${frame}
return (text,at)=>{
 let line={textContent:''},chars=Array.from(text);
 poiMessageTyping={line,chars,start:1200,count:0};
 poiMessageSpeechFrame(1200+at);
 return line.textContent;
};`);
const reveal=new Function('let poiMessageTyping=null;'+frame+'return (text,at)=>{let line={textContent:""};poiMessageTyping={line,chars:Array.from(text),start:1200,count:0};poiMessageSpeechFrame(1200+at);return line.textContent}')();
a.equal(reveal('こんにちは',0),'こ');
a.equal(reveal('こんにちは',34),'こんに');
a.equal(reveal('こんにちは',100),'こんにちは');
a.equal(reveal('𠮷田さん',0),'𠮷');
a.equal(reveal('雪'.repeat(150),1200).length,150);
console.log('PASS progressive fast speech with Unicode-safe code points');
