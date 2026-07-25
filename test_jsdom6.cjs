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
    appDataStr: '{"points": [{"lat": 35, "lng": 139}]}',
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

// Inject a console log to track execution
htmlStr = htmlStr.replace('window.addEventListener("load", () => {', 'console.log("Script block is parsing!"); window.addEventListener("load", () => { console.log("Load fired inside generated window!");');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on("error", (e) => {
    console.log("JSDOM Error:", e);
});
virtualConsole.on("log", (m) => {
    console.log("JSDOM Log:", m);
});

const dom = new JSDOM(htmlStr, { runScripts: "dangerously", virtualConsole });
dom.window.addEventListener('load', () => {
    console.log("Outer load fired!");
    setTimeout(() => {
        const doc = dom.window.document;
        const container = doc.querySelector('.print-canvas-container');
        console.log("Final innerHTML:", container.innerHTML.substring(0, 50));
    }, 100);
});
