const fs = require('fs');

const appDataStr = JSON.stringify({
    points: [],
    edges: [],
    areas: [],
    customTexts: [],
    customLines: [],
    attributes: [],
    filename: 'test',
    isMapView: false,
    activeBgUrl: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png'
});
const colorsStr = "{}";
const filename = "test";

// Read the GNSSMappingApp.js file
const jsCode = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

// Find the htmlStr array
const startIdx = jsCode.indexOf('const htmlStr = [');
const endIdx = jsCode.indexOf('].join(\\'\\n\\');', startIdx);
const arrayContent = jsCode.substring(startIdx + 17, endIdx);

// Build the array
const lines = arrayContent.split('\\n');
let evalStr = '';
for (let line of lines) {
    let trimmed = line.trim();
    if (trimmed.endsWith(',')) trimmed = trimmed.substring(0, trimmed.length - 1);
    if (trimmed.length > 0) {
        evalStr += trimmed + ',\\n';
    }
}

const finalEvalStr = `
const sStart = '<scr' + 'ipt>';
const sEnd = '</scr' + 'ipt>';
const htmlArray = [
${evalStr}
];
return htmlArray.join('\\n');
`;

const fn = new Function('appDataStr', 'colorsStr', 'filename', finalEvalStr);
const fullHtml = fn(appDataStr, colorsStr, filename);

fs.writeFileSync('dist/test_full.html', fullHtml);

// Extract the main script from fullHtml
const scriptStart = fullHtml.indexOf('<script>\\n    const exportData =');
const scriptEnd = fullHtml.indexOf('</script>', scriptStart);
let scriptContent = '';
if (scriptEnd !== -1) {
    scriptContent = fullHtml.substring(scriptStart + 8, scriptEnd);
} else {
    // try </scr' + 'ipt>
    const altEnd = fullHtml.lastIndexOf("</script>");
    scriptContent = fullHtml.substring(scriptStart + 8, altEnd);
}

fs.writeFileSync('dist/test_full_script.js', scriptContent);

try {
    require('acorn').parse(scriptContent, {ecmaVersion: 2022});
    console.log("SYNTAX OK");
} catch(e) {
    console.log("SYNTAX ERROR:", e.message);
    const lines = scriptContent.split('\\n');
    console.log('Line around error:', lines[e.loc.line - 1]);
}
