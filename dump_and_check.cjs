const fs = require('fs');
let js = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

const sIdx = js.indexOf('const htmlStr = [');
let lines = js.substring(sIdx).split('\n');
let htmlArrayStr = '';
for (let i = 1; i < lines.length; i++) {
    if (lines[i].includes('].join(')) break;
    htmlArrayStr += lines[i] + '\n';
}

const sStart = '<script>';
const sEnd = '</script>';
const exportData = { isMapView: true, activeBgUrl: 'std', points: [], edges: [], areas: [], customLines: [] };
const appDataStr = JSON.stringify(exportData);
const colorsStr = '{}';
const filename = 'test';

let htmlStr = '';
const fn = new Function('sStart', 'sEnd', 'exportData', 'appDataStr', 'colorsStr', 'filename', 
    'return [\n' + htmlArrayStr + '\n].join("\\n");'
);
htmlStr = fn(sStart, sEnd, exportData, appDataStr, colorsStr, filename);

// Find the script tag inside the body
const match = htmlStr.match(/<script>\s*const APP_DATA[\s\S]*?<\/script>/);
if (match) {
    let scriptCode = match[0].replace(/^<script>/, '').replace(/<\/script>$/, '');
    // Wait, the script tag is literally </scr" + "ipt>. So my regex won't match </script>!
}

// Let's just find <script>\n    const APP_DATA and </scr' + 'ipt>
const startIdx = htmlStr.indexOf('<script>\n    const APP_DATA');
const endIdx = htmlStr.lastIndexOf("</scr' + 'ipt>");
let scriptCode = htmlStr.substring(startIdx + 8, endIdx);

// Actually, in the generated string, </scr" + "ipt> evaluates to </script>!
// Wait, no! GNSSMappingApp.js has:
// "</scr" + "ipt>" -> in the array this evaluates to "</script>"!
// BUT the inner script ALSO has:
// "const sStart = '<scr' + 'ipt>'; const sEnd = '</scr' + 'ipt>';"
// Which evaluates to: const sStart = '<scr' + 'ipt>'; const sEnd = '</scr' + 'ipt>';
// So the END of the HTML script block is EXACTLY </script>

const trueEndIdx = htmlStr.lastIndexOf('</script>');
scriptCode = htmlStr.substring(startIdx + 8, trueEndIdx);

fs.writeFileSync('dist/test_script_final.js', scriptCode);
console.log("Saved exact script to test_script_final.js");

try {
    require('acorn').parse(scriptCode, {ecmaVersion: 2022});
    console.log("SYNTAX OK");
} catch(e) {
    console.log("SYNTAX ERROR:", e.message);
    const lines = scriptCode.split('\n');
    console.log('Line around error:', lines[e.loc.line - 1]);
}
