import os

path = r'c:\Users\gyrom\Documents\Antigravity\GNSStoGIS02\src\app\GNSSMappingApp.js'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# find the bad edit around line 2226
for i in range(len(lines)):
    if 'areaSvg += \'<polygon points="\' + coordsToLocal(area.coords) + \'" fill="\' + COLORS.polyFill + \'" fill-opacity="0.2" stroke="none" style="pointer-events:auto;" />\';' in lines[i]:
        print(f"Found bad edit at {i}")
        lines[i] = ''
    if 'area.holes.forEach(hole => areaSvg += \'<polygon points="\' + coordsToLocal(hole.coords) + \'" fill="#fff" stroke="none" style="pointer-events:auto;" />\');' in lines[i]:
        lines[i] = ''
        
# also I need to correctly inject the new inline styles into the proper place
# which is around line 2263

for i in range(len(lines)):
    if 'svgInner += \'<circle cx="\' + lp.x + \'" cy="\' + lp.y + \'" r="\' + radius + \'" fill="#e74c3c" />\';' in lines[i]:
        lines[i] = lines[i].replace('fill="#e74c3c" />', 'fill="#e74c3c" style="pointer-events:auto;" />')
    elif 'svgInner += \'<g class="svg-draggable"><text' in lines[i]:
        lines[i] = lines[i].replace('<g class="svg-draggable">', '<g class="svg-draggable" style="pointer-events:auto;">')
    elif 'svgInner += \'<line x1="' in lines[i] and 'stroke-width="\' + strokeWidth + \'" />' in lines[i]:
        lines[i] = lines[i].replace('stroke-width="\' + strokeWidth + \'" />', 'stroke-width="\' + strokeWidth + \'" style="pointer-events:auto;" />')
    elif 'svgInner += \'<polyline points="' in lines[i]:
        lines[i] = lines[i].replace('stroke-dasharray="\' + (strokeWidth*2) + \',\' + (strokeWidth*2) + \'" />', 'stroke-dasharray="\' + (strokeWidth*2) + \',\' + (strokeWidth*2) + \'" style="pointer-events:auto;" />')
    elif 'svgInner += \'<polygon points="' in lines[i] and 'fill="rgba(46, 204, 113, 0.1)"' in lines[i]:
        lines[i] = lines[i].replace('stroke-width="\' + strokeWidth + \'" />', 'stroke-width="\' + strokeWidth + \'" style="pointer-events:auto;" />')
    elif 'svgHtml += \'<div id="map-cropper" class="map-cropper" style="position:absolute;' in lines[i] and 'overflow:hidden;"' in lines[i]:
        lines[i] = lines[i].replace('overflow:hidden;">\';', 'overflow:hidden; background:rgba(0,0,0,0.01); pointer-events:auto;">\';')
    elif 'svgHtml += \'<svg width="\' + svgW_px + \'px"' in lines[i] and 'overflow:visible;">\'' in lines[i]:
        lines[i] = lines[i].replace('overflow:visible;">\'', 'overflow:visible; pointer-events:none;">\'')
    # remove map-overlay if it's there
    elif 'svgHtml += \'<div class="map-overlay"' in lines[i]:
        lines[i] = ''

with open(path, 'w', encoding='utf-8') as f:
    f.writelines(lines)
