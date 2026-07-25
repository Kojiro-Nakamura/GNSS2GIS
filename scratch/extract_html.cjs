
const fs = require('fs');
const js = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');
const start = js.indexOf('openPrintLayoutWindow()');
const blockStart = js.indexOf('const htmlStr = [', start);
const blockEnd = js.indexOf('.join(\'\\n\');', blockStart) + 13;
const blockCode = js.substring(blockStart, blockEnd);

// Let's mock variables
const filename = 'test';
const appDataStr = '{}';
const colorsStr = '{}';
const sStart = '';
const sEnd = '';

let extractCode = `
const filename = 'test';
const appDataStr = '{}';
const colorsStr = '{}';
const sStart = '';
const sEnd = '';
${blockCode}
module.exports = htmlStr;
`;

fs.writeFileSync('scratch/eval_html.js', extractCode);
