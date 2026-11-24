if(!process.argv[2])process.argv[2]='world-editor.html';
process.argv.push('--leap');
await import('./david-impact-polish-browser.mjs');
