const fs = require('fs');
const htmlStr = fs.readFileSync('dist/test_generated2.html', 'utf8');

const match = htmlStr.match(/<script>\s*const APP_DATA[\s\S]*?<\/script>/);
if (match) {
    let scriptCode = match[0];
    scriptCode = scriptCode.replace(/^<script>/, '').replace(/<\/script>$/, '');
    fs.writeFileSync('dist/test_script_exact.js', scriptCode);
    try {
        require('acorn').parse(scriptCode, {ecmaVersion: 2022});
        console.log('Syntax OK');
    } catch(e) {
        console.error('SYNTAX ERROR:', e.message);
        const lines = scriptCode.split('\n');
        console.log('Line around error:', lines[e.loc.line - 1]);
    }
} else {
    console.log("Not found with regex");
}
