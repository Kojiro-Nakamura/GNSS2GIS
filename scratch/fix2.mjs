import fs from 'fs';

let code = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

// 1. Remove map-overlay line entirely
code = code.replace(
    '                    "            svgHtml += \'<div class=\\"map-overlay\\" style=\\"position:absolute; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.01); pointer-events:auto;\\"></div>\';\\n',
    ''
);

// 2. Add pointer-events:auto and background to map-cropper
code = code.replace(
    '                    "            svgHtml += \'<div id=\\"map-cropper\\" class=\\"map-cropper\\" style=\\"position:absolute; top:\' + ct + \'px; left:\' + cl + \'px; width:\' + cw + \'px; height:\' + ch + \'px; z-index:0; overflow:hidden;\\">\';\\n',
    '                    "            svgHtml += \'<div id=\\"map-cropper\\" class=\\"map-cropper\\" style=\\"position:absolute; top:\' + ct + \'px; left:\' + cl + \'px; width:\' + cw + \'px; height:\' + ch + \'px; z-index:0; overflow:hidden; background:rgba(0,0,0,0.01); pointer-events:auto;\\">\';\\n'
);

// 3. Add pointer-events:none to SVG
code = code.replace(
    '                    "        svgHtml += \'<svg width=\\"\' + svgW_px + \'px\\" height=\\"\' + svgH_px + \'px\\" viewBox=\\"\' + viewBox + \'\\" style=\\"position:relative; z-index:1; overflow:visible;\\">\' + svgInner + \'</svg>\';\\n',
    '                    "        svgHtml += \'<svg width=\\"\' + svgW_px + \'px\\" height=\\"\' + svgH_px + \'px\\" viewBox=\\"\' + viewBox + \'\\" style=\\"position:relative; z-index:1; overflow:visible; pointer-events:none;\\">\' + svgInner + \'</svg>\';\\n'
);

// 4. Add pointer-events:auto to area polygons
code = code.replace(
    '                    "            areaSvg += \'<polygon points=\\"\' + coordsToLocal(area.coords) + \'\\" fill=\\"\' + COLORS.polyFill + \'\\" fill-opacity=\\"0.2\\" stroke=\\"none\\" />\';\\n',
    '                    "            areaSvg += \'<polygon points=\\"\' + coordsToLocal(area.coords) + \'\\" fill=\\"\' + COLORS.polyFill + \'\\" fill-opacity=\\"0.2\\" stroke=\\"none\\" style=\\"pointer-events:auto;\\" />\';\\n'
);

code = code.replace(
    '                    "            area.holes.forEach(hole => areaSvg += \'<polygon points=\\"\' + coordsToLocal(hole.coords) + \'\\" fill=\\"#fff\\" stroke=\\"none\\" />\');\\n',
    '                    "            area.holes.forEach(hole => areaSvg += \'<polygon points=\\"\' + coordsToLocal(hole.coords) + \'\\" fill=\\"#fff\\" stroke=\\"none\\" style=\\"pointer-events:auto;\\" />\');\\n'
);

// 5. Add pointer-events:auto to custom polylines
code = code.replace(
    '                    "                svgInner += \'<g><polyline points=\\"\' + pts + \'\\" fill=\\"none\\" stroke=\\"\' + c + \'\\" stroke-width=\\"\' + w + \'\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"\' + dash + \' /></g>\';\\n',
    '                    "                svgInner += \'<g><polyline points=\\"\' + pts + \'\\" fill=\\"none\\" stroke=\\"\' + c + \'\\" stroke-width=\\"\' + w + \'\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\"\' + dash + \' style=\\"pointer-events:auto;\\" /></g>\';\\n'
);

// 6. Add pointer-events:auto to edges
code = code.replace(
    '                    "            if (p1 && p2) svgInner += \'<g><line x1=\\"\' + p1.x + \'\\" y1=\\"\' + p1.y + \'\\" x2=\\"\' + p2.x + \'\\" y2=\\"\' + p2.y + \'\\" stroke=\\"\' + COLORS.line + \'\\" stroke-width=\\"\' + strokeW + \'\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" /></g>\';\\n',
    '                    "            if (p1 && p2) svgInner += \'<g><line x1=\\"\' + p1.x + \'\\" y1=\\"\' + p1.y + \'\\" x2=\\"\' + p2.x + \'\\" y2=\\"\' + p2.y + \'\\" stroke=\\"\' + COLORS.line + \'\\" stroke-width=\\"\' + strokeW + \'\\" stroke-linecap=\\"round\\" stroke-linejoin=\\"round\\" style=\\"pointer-events:auto;\\" /></g>\';\\n'
);

// 7. Add pointer-events:auto to points
code = code.replace(
    '                    "            svgInner += \'<g><circle cx=\\"\' + lp.x + \'\\" cy=\\"\' + lp.y + \'\\" r=\\"\' + radius + \'\\" fill=\\"#fff\\" stroke=\\"\' + COLORS.pointBorder + \'\\" stroke-width=\\"\' + (strokeW * 0.8) + \'\\" /></g>\';\\n',
    '                    "            svgInner += \'<g><circle cx=\\"\' + lp.x + \'\\" cy=\\"\' + lp.y + \'\\" r=\\"\' + radius + \'\\" fill=\\"#fff\\" stroke=\\"\' + COLORS.pointBorder + \'\\" stroke-width=\\"\' + (strokeW * 0.8) + \'\\" style=\\"pointer-events:auto;\\" /></g>\';\\n'
);

code = code.replace(
    '                    "            svgInner += \'<g class=\\"svg-draggable\\"><text x=\\"\' + (lp.x + radius*1.5) + \'\\" y=\\"\' + (lp.y - radius*1.5) + \'\\" font-size=\\"\' + (fontSize*0.9) + \'\\" font-family=\\"sans-serif\\" fill=\\"#333\\">\' + lp.name + \'</text></g>\';\\n',
    '                    "            svgInner += \'<g class=\\"svg-draggable\\" style=\\"pointer-events:auto;\\"><text x=\\"\' + (lp.x + radius*1.5) + \'\\" y=\\"\' + (lp.y - radius*1.5) + \'\\" font-size=\\"\' + (fontSize*0.9) + \'\\" font-family=\\"sans-serif\\" fill=\\"#333\\">\' + lp.name + \'</text></g>\';\\n'
);

// 8. Add pointer-events:auto to customTexts
code = code.replace(
    '                    "                svgInner += \'<g class=\\"svg-draggable\\" transform=\\"translate(\' + x + \',\' + y + \') rotate(\' + rot + \')\\">\' + textSvg + \'</g>\';\\n',
    '                    "                svgInner += \'<g class=\\"svg-draggable\\" transform=\\"translate(\' + x + \',\' + y + \') rotate(\' + rot + \')\\" style=\\"pointer-events:auto;\\">\' + textSvg + \'</g>\';\\n'
);

fs.writeFileSync('src/app/GNSSMappingApp.js', code);
console.log('Patch complete.');
