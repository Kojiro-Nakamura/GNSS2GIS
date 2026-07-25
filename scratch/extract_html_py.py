import os

path = r'c:\Users\gyrom\Documents\Antigravity\GNSStoGIS02\src\app\GNSSMappingApp.js'
with open(path, 'r', encoding='utf-8') as f:
    js = f.read()

start_idx = js.find('const htmlStr = [', js.find('openPrintLayoutWindow()'))
end_idx = js.find('.join(\'\\n\');', start_idx)
block = js[start_idx:end_idx]

import re
# We need to extract all the string literals that are inside the array.
# Let's just create a quick node script that evaluates this part of the file and extracts the string.

node_script = """
const fs = require('fs');
const js = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');
const start = js.indexOf('openPrintLayoutWindow()');
const blockStart = js.indexOf('const htmlStr = [', start);
const blockEnd = js.indexOf('.join(\\'\\\\n\\');', blockStart) + 13;
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
"""
with open('scratch/extract_html.js', 'w', encoding='utf-8') as f:
    f.write(node_script)
