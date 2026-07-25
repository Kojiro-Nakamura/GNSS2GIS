const fs = require('fs');
const htmlStr = fs.readFileSync('dist/popup.html', 'utf8');

const match = htmlStr.match(/<script>[\\s\\S]*?<\\/script>/);
if (match) {
    let scriptCode = match[0].replace(/^<script>/, '').replace(/<\\/script>$/, '');
    
    fs.writeFileSync('dist/popup_script.js', scriptCode);
    
    try {
        require('acorn').parse(scriptCode, {ecmaVersion: 2022});
        console.log("SYNTAX OK!");
    } catch (e) {
        console.log("SYNTAX ERROR:", e.message);
        const lines = scriptCode.split('\\n');
        console.log("Line of error:", lines[e.loc.line - 1]);
        if (e.loc.line > 1) console.log("Prev:", lines[e.loc.line - 2]);
        if (e.loc.line < lines.length) console.log("Next:", lines[e.loc.line]);
    }
} else {
    console.log("No script tag found.");
}
