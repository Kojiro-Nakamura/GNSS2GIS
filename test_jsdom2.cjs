const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const appCode = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

const startIdx = appCode.indexOf('const htmlStr = [');
const endIdx = appCode.indexOf("].join('\\n');", startIdx);
let htmlStrBlock = appCode.substring(startIdx, endIdx + 14);

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

const dom = new JSDOM(htmlStr);
const doc = dom.window.document;
const container = doc.querySelector('.print-canvas-container');
console.log("Container exists?", !!container);
if (container) {
    console.log("Container inner HTML length:", container.innerHTML.length);
} else {
    console.log("Body inner HTML:", doc.body.innerHTML.substring(0, 500));
}
