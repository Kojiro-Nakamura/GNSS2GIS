const fs = require('fs');
const htmlStr = fs.readFileSync('dist/test_generated2.html', 'utf8');

const sIdx = htmlStr.indexOf('<script>\n');
const endIdx = htmlStr.lastIndexOf('</script>');
const scriptCode = htmlStr.substring(sIdx + 8, endIdx);
fs.writeFileSync('dist/test_script_exact.js', scriptCode);

try {
    require('acorn').parse(scriptCode, {ecmaVersion: 2022});
    console.log('Syntax OK');
} catch(e) {
    console.error('SYNTAX ERROR:', e.message);
    const lines = scriptCode.split('\n');
    console.log('Line around error:', lines[e.loc.line - 1]);
}
