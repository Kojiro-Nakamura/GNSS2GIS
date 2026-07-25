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

const fn = new Function('mockContext', `
    with(mockContext) {
        ${htmlStrBlock}
        return htmlStr;
    }
`);
htmlStr = fn(mockContext);

const dom = new JSDOM(htmlStr);
const doc = dom.window.document;
const container = doc.querySelector('.print-canvas-container');
console.log(container.outerHTML);
