import fs from 'fs';

let code = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

// 1. Remove map-overlay entirely
code = code.replace(/<div class=\\"map-overlay\\"[^>]*><\/div>/g, '');

// 2. Add background and pointer-events to map-cropper
code = code.replace(
    /id=\\"map-cropper\\" class=\\"map-cropper\\" style=\\"([^"]*)overflow:hidden;\\"/g,
    'id=\\"map-cropper\\" class=\\"map-cropper\\" style=\\"$1overflow:hidden; background:rgba(0,0,0,0.01); pointer-events:auto;\\"'
);

// 3. Add pointer-events:none to SVG
code = code.replace(
    /<svg width=\\"[^"]+\\" height=\\"[^"]+\\" viewBox=\\"[^"]+\\" style=\\"([^"]*)overflow:visible;\\"/g,
    '<svg width=\\"\' + svgW_px + \'px\\" height=\\"\' + svgH_px + \'px\\" viewBox=\\"\' + viewBox + \'\\" style=\\"$1overflow:visible; pointer-events:none;\\"'
);

// 4. SVG elements: add pointer-events:auto to <polygon>, <polyline>, <line>, <circle>, <g class="svg-draggable">
// But only inside the openPrintLayoutWindow generation block.
// Let's just do it globally for all these tags if they don't have it.
const addPointerEvents = (tagStr) => {
    return tagStr.replace(/<polygon /g, '<polygon style=\\"pointer-events:auto;\\" ')
                 .replace(/<polyline /g, '<polyline style=\\"pointer-events:auto;\\" ')
                 .replace(/<line /g, '<line style=\\"pointer-events:auto;\\" ')
                 .replace(/<circle /g, '<circle style=\\"pointer-events:auto;\\" ')
                 .replace(/<g class=\\"svg-draggable\\"/g, '<g class=\\"svg-draggable\\" style=\\"pointer-events:auto;\\"');
};

code = addPointerEvents(code);

// Wait, the above simple regex might break things if it hits other parts of the code.
// Let's look at the generated string again.
// All of these are inside `svgInner += '...'`.
// Let's just patch all of them. It's safe since this is the only SVG generation.

fs.writeFileSync('src/app/GNSSMappingApp.js', code);
console.log('Patch complete.');
