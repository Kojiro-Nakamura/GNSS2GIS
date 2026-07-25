const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const appCode = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

// The `openPrintLayoutWindow` method sets up the window.
// We can just extract the string it writes.
// We know it is const htmlStr = [...].join('\n');
const startIdx = appCode.indexOf('const htmlStr = [');
const endIdx = appCode.indexOf("].join('\\n');", startIdx);
let htmlStrBlock = appCode.substring(startIdx, endIdx + 14);

// Evaluate this block to get htmlStr
let htmlStr = '';
const mockContext = {
    filename: 'test',
    appDataStr: '{}',
    exportData: {},
    colorsStr: '{}',
    layoutW: 800,
    layoutH: 600,
    scaleVal: 1000,
    pageBgColor: '#ffffff',
    paperSize: 'A4',
    paperOrient: 'landscape',
    els: { canvasWrap: { style: { width: "100px", height: "100px" } } },
    cloneCanvas: { innerHTML: "<div>hello</div>" },
    sStart: "<script>",
    sEnd: "</script>"
};

try {
    const fn = new Function('mockContext', `
        with(mockContext) {
            ${htmlStrBlock}
            return htmlStr;
        }
    `);
    htmlStr = fn(mockContext);
} catch (e) {
    console.log("Error building string:", e.message);
    process.exit(1);
}

// Now parse with JSDOM and run scripts
const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (e) => {
    console.log("JSDOM Error:", e);
});
virtualConsole.on("log", (m) => {
    console.log("JSDOM Log:", m);
});

const dom = new JSDOM(htmlStr, { runScripts: "dangerously", virtualConsole });
