const a=require('node:assert/strict'),h=require('node:fs').readFileSync(process.argv[2],'utf8');
a(h.includes('function poiNpcRecruitConfirm('),'deferred recruitment');
a(h.includes("d.pendingRecruit=true"),'selecting the request opens speech only');
a(h.includes("poiSound('item-pickup')")&&h.includes("poiMessagePush(name+'が仲間になった。'"));
a(h.includes("frontierren:'いいぜ"));
console.log('PASS named recruitment replies and confirmation flow');
