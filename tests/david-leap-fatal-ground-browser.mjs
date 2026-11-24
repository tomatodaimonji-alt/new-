process.argv[2]??='world-editor.html';
process.argv.push('--leap','--fatal');
await import('./david-impact-polish-browser.mjs');
