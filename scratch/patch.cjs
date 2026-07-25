const fs = require('fs');
let code = fs.readFileSync('src/app/GNSSMappingApp.js', 'utf8');

// fix the bad duplicated lines
code = code.replace(/\s*\"\s*areaSvg \+= '<polygon points=\"' \+ coordsToLocal\(area\.coords\) \+ '\" fill=\"' \+ COLORS\.polyFill \+ '\" fill-opacity=\"0\.2\" stroke=\"none\" style=\"pointer-events:auto;\" \/>';\",\n/g, '');
code = code.replace(/\s*\"\s*area\.holes\.forEach\(hole => areaSvg \+= '<polygon points=\"' \+ coordsToLocal\(hole\.coords\) \+ '\" fill=\"#fff\" stroke=\"none\" style=\"pointer-events:auto;\" \/>'\);\",\n/g, '');

code = code.replace(/fill="#e74c3c" \/>/g, 'fill="#e74c3c" style="pointer-events:auto;" />');
code = code.replace(/<g class="svg-draggable">/g, '<g class="svg-draggable" style="pointer-events:auto;">');
code = code.replace(/stroke-width="' \+ strokeWidth \+ '" \/>/g, 'stroke-width="\' + strokeWidth + \'" style="pointer-events:auto;" />');
code = code.replace(/stroke-dasharray="' \+ \(strokeWidth\*2\) \+ ',' \+ \(strokeWidth\*2\) \+ '" \/>/g, 'stroke-dasharray="\' + (strokeWidth*2) + \',\' + (strokeWidth*2) + \'" style="pointer-events:auto;" />');

// Remove map-overlay
code = code.replace(/\s*"\s*svgHtml \+= '<div class="map-overlay".*?;",?\n/g, '');

// Update map-cropper
code = code.replace(/overflow:hidden;">';/g, 'overflow:hidden; background:rgba(0,0,0,0.01); pointer-events:auto;">\';');

// Update svg style
code = code.replace(/overflow:visible;">' \+ svgInner/g, 'overflow:visible; pointer-events:none;">\' + svgInner');

// also remove duplicated CSS rules
code = code.replace(/                    "  \.print-hover-outline \{ transition: outline 0\.2s, outline-offset 0\.2s; outline: 2px dashed transparent; outline-offset: 4px; \}",\n                    "  \.print-hover-outline \{ transition: outline 0\.2s, outline-offset 0\.2s; outline: 2px dashed transparent; outline-offset: 4px; \}",\n/g, "                    \"  .print-hover-outline { transition: outline 0.2s, outline-offset 0.2s; outline: 2px dashed transparent; outline-offset: 4px; }\",\n");

fs.writeFileSync('src/app/GNSSMappingApp.js', code);
console.log('patched');
