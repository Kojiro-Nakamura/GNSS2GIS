const fs = require('fs');
const htmlStr = fs.readFileSync('dist/test_generated2.html', 'utf8');

const sIdx = htmlStr.indexOf('<script>\n');
if (sIdx > -1) {
    const endIdx = htmlStr.indexOf('</script>', sIdx);
    if (endIdx === -1) {
        // Look for </scr' + 'ipt>
        const endIdx2 = htmlStr.indexOf("</scr' + 'ipt>", sIdx);
        if (endIdx2 > -1) {
            const target = htmlStr.substring(sIdx + 8, endIdx2);
            try {
                require('acorn').parse(target, {ecmaVersion: 2022});
                console.log('Syntax OK');
            } catch(e) {
                console.error('SYNTAX ERROR:', e.message);
                const lines = target.split('\n');
                console.log('Line around error:', lines[e.loc.line - 1]);
                console.log('Previous line:', lines[e.loc.line - 2]);
            }
        }
    }
}
