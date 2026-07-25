import os

path = r'c:\Users\gyrom\Documents\Antigravity\GNSStoGIS02\src\app\GNSSMappingApp.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '''                    "            return row;\\r
                    "                if (state) {'''

replacement = '''                    "            return row;\\r
                    "        }).join('');\\r
                    "        let totalArea = APP_DATA.areas.reduce((sum, a) => sum + GeoUtils.m2ToHa(a.netArea), 0);\\r
                    "        areaRows += '<tr style="border-top:1px solid #333; font-weight:bold;"><td>合計</td><td style="text-align:right;">' + totalArea.toFixed(4) + ' ha</td></tr>';\\r
                    "        const areaHtml = '<div class="pl-box"><div class="pl-table-title">面 積 表</div><table class="pl-table" style="min-width:180px;">' + areaRows + '</table></div>';\\r
                    "        const summaryHtml = '<div class="pl-box" style="padding: 5px 10px; font-size: 13px;">面積合計: ' + totalArea.toFixed(4) + 'ha &nbsp;&nbsp; 測線長合計: ' + totalLength.toFixed(1) + 'm</div>';\\r
                    "        const compassHtml = '<div style="text-align:center; font-weight:bold; font-family:sans-serif; margin-bottom:-2px; font-size:18px; color:#333;">N</div>' +\\r
                    "            '<svg width="30" height="40" viewBox="0 0 30 40"><polygon points="15,0 8,20 22,20" fill="#333"/><line x1="15" y1="20" x2="15" y2="40" stroke="#333" stroke-width="2"/><line x1="0" y1="30" x2="30" y2="30" stroke="#333" stroke-width="1"/></svg>';\\r
                    "        const createPlElement = (id, content, defaultPosFn) => {\\r
                    "            const el = document.createElement('div'); el.className = 'print-draggable print-hover-outline'; el.id = id; el.innerHTML = content;\\r
                    "            el.setAttribute('data-scale', '1'); el.style.opacity = '0'; els.canvasWrap.appendChild(el);\\r
                    "            setTimeout(() => {\\r
                    "                const state = positions[id];\\r
                    "                if (state) {'''

new_content = content.replace(target, replacement)
with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print(content == new_content)
