class SimpleDxfWriter {\n" +
                    "        constructor() { this.lines = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1015', '9', '$DWGCODEPAGE', '3', 'ANSI_932', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES']; }\n" +
                    "        addLine(x1, y1, x2, y2, color=256) {\n" +
                    "            this.lines.push('0', 'LINE', '8', '0', '62', color, '10', x1.toFixed(3), '20', y1.toFixed(3), '11', x2.toFixed(3), '21', y2.toFixed(3));\n" +
                    "        }\n" +
                    "        addPolyline(pts, closed, color=256) {\n" +
                    "            if (pts.length < 2) return;\n" +
                    "            for (let i=0; i<pts.length - 1; i++) {\n" +
                    "                this.addLine(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, color);\n" +
                    "            }\n" +
                    "            if (closed && pts.length > 2) {\n" +
                    "                this.addLine(pts[pts.length-1].x, pts[pts.length-1].y, pts[0].x, pts[0].y, color);\n" +
                    "            }\n" +
                    "        }\n" +
                    "        addText(text, x, y, height, color=256, align='L') {\n" +
                    "            this.lines.push('0', 'TEXT', '8', '0', '62', color, '10', x.toFixed(3), '20', y.toFixed(3), '40', height.toFixed(3), '1', text);\n" +
                    "            if (align === 'C') {\n" +
                    "                this.lines.push('72', '1', '11', x.toFixed(3), '21', y.toFixed(3));\n" +
                    "            } else if (align === 'R') {\n" +
                    "                this.lines.push('72', '2', '11', x.toFixed(3), '21', y.toFixed(3));\n" +
                    "            }\n" +
                    "        }\n" +
                    "        addCircle(x, y, radius, color=256) {\n" +
                    "            this.lines.push('0', 'CIRCLE', '8', '0', '62', color, '10', x.toFixed(3), '20', y.toFixed(3), '40', radius.toFixed(3));\n" +
                    "        }\n" +
                    "        toString() { return this.lines.concat(['0', 'ENDSEC', '0', 'EOF']).join(String.fromCharCode(13, 10)); }\n" +
                    "    }\n" +
                    "\n" +
                    "    document.getElementById('btnExportDxf').addEventListener('click', () => {\n" +
                    "        const dxf = new SimpleDxfWriter();\n" +
                    "        const paperRect = els.canvasWrap.getBoundingClientRect();\n" +
"        const unscale = (val) => val / currentViewScale;\n" +
"        const paperH_px = unscale(paperRect.height);\n" +
                    "        const pxToMm = 1 / 3.7795;\n" +
                    "        \n" +
                    "        const toDxfX = (px) => px * pxToMm;\n" +
                    "        const toDxfY = (py) => (paperH_px - py) * pxToMm;\n" +
                    "\n" +
                    "        // 1. Map Elements\n" +
                    "        const plMap = document.getElementById('pl-map');\n" +
                    "        if (plMap) {\n" +
                    "            const mapRect = plMap.getBoundingClientRect();\n" +
                    "            const mapLeft = unscale(mapRect.left - paperRect.left);\n" +
"            const mapTop = unscale(mapRect.top - paperRect.top);\n" +
                    "            const S = parseFloat(plMap.getAttribute('data-scale')) || 1;\n" +
                    "            \n" +
                    "        let p0 = {lat: 35, lng: 139};",
                    "        if (APP_DATA.points && APP_DATA.points.length > 0) p0 = APP_DATA.points[0];",
                    "        else if (APP_DATA.customLines && APP_DATA.customLines.length > 0) p0 = {lat: APP_DATA.customLines[0].latlngs[0][0], lng: APP_DATA.customLines[0].latlngs[0][1]};",
                    "        else if (APP_DATA.areas && APP_DATA.areas.length > 0) p0 = {lat: APP_DATA.areas[0].coords[0][0], lng: APP_DATA.areas[0].coords[0][1]};\n" +
                    "            const lonDegPerMeter = GeoUtils.getLonDegPerMeter(p0.lat);\n" +
                    "            \n" +
                    "            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;\n" +
                    "            const updateBounds = (lng, lat) => {\n" +
                    "                const x = (lng - p0.lng) / lonDegPerMeter;\n" +
                    "                const y = -(lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;\n" +
                    "                if (x < minX) minX = x; if (x > maxX) maxX = x;\n" +
                    "                if (y < minY) minY = y; if (y > maxY) maxY = y;\n" +
                    "            };\n" +
                    "            APP_DATA.points.forEach(p => updateBounds(p.lng, p.lat));\n" +
                    "            if (APP_DATA.customLines) APP_DATA.customLines.forEach(l => l.latlngs.forEach(c => updateBounds(c.lng, c.lat)));\n" +
                    "            if (APP_DATA.areas) APP_DATA.areas.forEach(a => a.coords.forEach(c => updateBounds(c[1], c[0])));\n" +
                    "            APP_DATA.edges.forEach(e => { if (e.latlngs) e.latlngs.forEach(c => updateBounds(c.lng, c.lat)); });\n" +
                    "            if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 10; }\n" +
                    "            const w = maxX - minX || 10;\n" +
                    "            const h = maxY - minY || 10;\n" +
                    "            const pad = Math.max(w, h) * 0.05;\n" +
                    "            const scaleVal = parseFloat(els.scale.value) || 1000;\n" +
                    "            const pxPerMeter = (1000 / scaleVal) * 3.7795;\n" +
                    "\n" +
                    "            const mToDxf = (mx, my) => {\n" +
"                const px = (mx - (minX - pad)) * pxPerMeter;\n" +
"                const py = (my - (minY - pad)) * pxPerMeter;\n" +
"                const paper_x = mapLeft + (px * S);\n" +
"                const paper_y = mapTop + (py * S);\n" +
"                return { x: toDxfX(paper_x), y: toDxfY(paper_y) };\n" +
"            };\n" +

"            const llToDxf = (lat, lng) => {\n" +
                    "                const mx = (lng - p0.lng) / lonDegPerMeter;\n" +
                    "                // re-use the exact formula from GNSSMappingApp GeoUtils\n" +
                    "                const my = -(lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;\n" +
                    "                \n" +
                    "                const px = (mx - (minX - pad)) * pxPerMeter;\n" +
                    "                const py = (my - (minY - pad)) * pxPerMeter;\n" +
                    "                const paper_x = mapLeft + (px * S);\n" +
                    "                const paper_y = mapTop + (py * S);\n" +
                    "                return { x: toDxfX(paper_x), y: toDxfY(paper_y) };\n" +
                    "            };\n" +
                    "\n" +
                    "            // Draw Areas\n" +
"            APP_DATA.areas.forEach((area, i) => {\n" +
"                const pts = area.coords.map(c => llToDxf(c[0], c[1]));\n" +
"                dxf.addPolyline(pts, true, 3); // green\n" +
"                if(area.center) {\n" +
"                    const ac = llToDxf(area.center.lat, area.center.lng);\n" +
"                    const t1 = \'区画 \' + (i+1);\n" +
"                    const t2 = GeoUtils.m2ToHa(area.netArea).toFixed(4) + \' ha\';\n" +
"                    const bw = Math.max(t1.length * 2.5, t2.length * 1.6) + 5;\n" +
"                    dxf.addPolyline([{x:ac.x - bw/2, y:ac.y - 3}, {x:ac.x + bw/2, y:ac.y - 3}, {x:ac.x + bw/2, y:ac.y + 5.5}, {x:ac.x - bw/2, y:ac.y + 5.5}], true, 7);\n" +
"                    dxf.addText(t1, ac.x, ac.y + 2, 2.5, 3, \'C\');\n" +
"                    dxf.addText(t2, ac.x, ac.y - 2, 2.5, 3, \'C\');\n" +

"                }\n" +
"                area.holes.forEach((hole, j) => {\n" +
"                    const hpts = hole.coords.map(c => llToDxf(c[0], c[1]));\n" +
"                    dxf.addPolyline(hpts, true, 3);\n" +
"                    if(hole.center) {\n" +
"                        const hc = llToDxf(hole.center.lat, hole.center.lng);\n" +
"                        const t1 = \'除地 \' + (j+1);\n" +
"                        const t2 = GeoUtils.m2ToHa(hole.area).toFixed(4) + \' ha\';\n" +
"                        const bw = Math.max(t1.length * 2.5, t2.length * 1.6) + 5;\n" +
"                        dxf.addPolyline([{x:hc.x - bw/2, y:hc.y - 3}, {x:hc.x + bw/2, y:hc.y - 3}, {x:hc.x + bw/2, y:hc.y + 5.5}, {x:hc.x - bw/2, y:hc.y + 5.5}], true, 7);\n" +
"                        dxf.addText(t1, hc.x, hc.y + 2, 2.5, 1, \'C\');\n" +
"                        dxf.addText(t2, hc.x, hc.y - 2, 2.5, 1, \'C\');\n" +

"                    }\n" +
"                });\n" +
"            });\n" +
"            // Draw Edges\n" +
                    "            APP_DATA.edges.forEach(edge => {\n" +
                    "                const p1 = APP_DATA.points.find(p => p.id === edge.from);\n" +
                    "                const p2 = APP_DATA.points.find(p => p.id === edge.to);\n" +
                    "                if (p1 && p2) {\n" +
                    "                    const dp1 = llToDxf(p1.lat, p1.lng);\n" +
                    "                    const dp2 = llToDxf(p2.lat, p2.lng);\n" +
                    "                    dxf.addLine(dp1.x, dp1.y, dp2.x, dp2.y, 7); // black\n" +
                    "                }\n" +
                    "            });\n" +
                    "\n" +
                    "            // Draw Custom Lines\n" +
                    "            APP_DATA.customLines.forEach(line => {\n" +
                    "                const pts = line.latlngs.map(c => llToDxf(c.lat, c.lng));\n" +
                    "                dxf.addPolyline(pts, false, 7);\n" +
                    "            });\n" +
                    "\n" +
                    "            // Draw Points\n" +
                    "            const radiusMm = 3.5 * S * pxToMm;\n" +
                    "            const w_m = maxX - minX || 10;\n" +
                    "            const radius_m = 3.5 * (w_m / 1000);\n" +
                    "            APP_DATA.points.forEach(p => {\n" +
                    "                const dp = llToDxf(p.lat, p.lng);\n" +
                    "                dxf.addCircle(dp.x, dp.y, radiusMm > 0 ? radiusMm : 1, 1);\n" +
                    "                let dx_m = 0, dy_m = 0;\n" +
                    "                const g = els.canvasWrap.querySelector('g[data-pid=\"' + p.id + '\"]');\n" +
                    "                if (g) {\n" +
                    "                    const transform = g.getAttribute('transform') || '';\n" +
                    "                    const match = transform.match(/translate\\(([-\\d.]+)[,\\s]+([-\\d.]+)\\)/);\n" +
                    "                    if (match) { \n" +
                    "                        dx_m = parseFloat(match[1]) / (S * pxPerMeter); \n" +
                    "                        dy_m = parseFloat(match[2]) / (S * pxPerMeter); \n" +
                    "                    }\n" +
                    "                }\n" +
                    "                const mx = (p.lng - p0.lng) / lonDegPerMeter;\n" +
                    "                const my = -(p.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;\n" +
                    "                const text_x_m = mx + radius_m * 1.5 + dx_m;\n" +
                    "                const text_y_m = my - radius_m * 1.5 + dy_m;\n" +
                    "                const dpt = mToDxf(text_x_m, text_y_m);\n" +
                    "                dxf.addText(p.name, dpt.x, dpt.y, 2.5, 7);\n" +
                    "            });\n" +
                    "            \n" +
                    "            // Draw Custom Texts\n" +
                    "            APP_DATA.customTexts.forEach(t => {\n" +
                    "                let text_x_m = (t.lng - p0.lng) / lonDegPerMeter;\n" +
                    "                let text_y_m = -(t.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;\n" +
                    "                const g = els.canvasWrap.querySelector('g[data-cid=\"' + t.id + '\"]');\n" +
                    "                if (g) {\n" +
                    "                    const transform = g.getAttribute('transform') || '';\n" +
                    "                    const match = transform.match(/translate\\(([-\\d.]+)[,\\s]+([-\\d.]+)\\)/);\n" +
                    "                    if (match) {\n" +
"                        text_x_m += parseFloat(match[1]) / (S * pxPerMeter); \n" +
"                        text_y_m += parseFloat(match[2]) / (S * pxPerMeter); \n" +
"                    }\n" +
"                }\n" +
"                const dpt = mToDxf(text_x_m, text_y_m);\n" +
"                const hMm = (parseInt(t.fontSize) || 16) * pxToMm * S;\n" +
"                dxf.addText(t.text.split(String.fromCharCode(10)).join(' '), dpt.x, dpt.y, hMm, 7);\n" +
"            });\n" +
"        }\n" +
                    "\n" +
                    "        // 2. HTML Tables & Other texts\n" +
                    "        const textElements = Array.from(document.querySelectorAll('#canvasWrap table td, #canvasWrap table th, .print-title, .attr-table td, .attr-table th, .pl-table-title, .pl-summary-text'));\n" +
                    "        \n" +
                    "        // Draw Table lines\n" +
                    "        const tables = document.querySelectorAll('#canvasWrap table');\n" +
                    "        tables.forEach(table => {\n" +
                    "            const tableRect = table.getBoundingClientRect();\n" +
                    "            const x1 = toDxfX(unscale(tableRect.left - paperRect.left));\n" +
                    "            const y1 = toDxfY(unscale(tableRect.top - paperRect.top));\n" +
                    "            const x2 = toDxfX(unscale(tableRect.right - paperRect.left));\n" +
                    "            const y2 = toDxfY(unscale(tableRect.bottom - paperRect.top));\n" +
                    "            dxf.addLine(x1, y1, x2, y1, 7);\n" +
                    "            dxf.addLine(x2, y1, x2, y2, 7);\n" +
                    "            dxf.addLine(x2, y2, x1, y2, 7);\n" +
                    "            dxf.addLine(x1, y2, x1, y1, 7);\n" +
                    "\n" +
                    "            const cells = table.querySelectorAll('th, td');\n" +
                    "            cells.forEach(cell => {\n" +
                    "                const r = cell.getBoundingClientRect();\n" +
                    "                const cx1 = toDxfX(unscale(r.left - paperRect.left));\n" +
                    "                const cy1 = toDxfY(unscale(r.top - paperRect.top));\n" +
                    "                const cx2 = toDxfX(unscale(r.right - paperRect.left));\n" +
                    "                const cy2 = toDxfY(unscale(r.bottom - paperRect.top));\n" +
                    "                dxf.addLine(cx1, cy2, cx2, cy2, 7);\n" +
                    "                dxf.addLine(cx2, cy1, cx2, cy2, 7);\n" +
                    "            });\n" +
                    "        });\n" +
                    "\n" +
                    "        document.querySelectorAll('.pl-box').forEach(box => {\n" +
"            const r = box.getBoundingClientRect();\n" +
"            const bx1 = toDxfX(unscale(r.left - paperRect.left));\n" +
"            const by1 = toDxfY(unscale(r.top - paperRect.top));\n" +
"            const bx2 = toDxfX(unscale(r.right - paperRect.left));\n" +
"            const by2 = toDxfY(unscale(r.bottom - paperRect.top));\n" +
"            dxf.addLine(bx1, by1, bx2, by1, 7);\n" +
"            dxf.addLine(bx2, by1, bx2, by2, 7);\n" +
"            dxf.addLine(bx2, by2, bx1, by2, 7);\n" +
"            dxf.addLine(bx1, by2, bx1, by1, 7);\n" +
"        });\n" +
"        const compass = document.getElementById('pl-compass');\n" +
"        if (compass) {\n" +
"            const r = compass.getBoundingClientRect();\n" +
"            const cx = toDxfX(unscale(r.left + r.width/2 - paperRect.left));\n" +
"            const cy = toDxfY(unscale(r.top + r.height/2 - paperRect.top));\n" +
"            dxf.addText('N', cx, cy + 8, 4, 7, 'C');\n" +
"            dxf.addLine(cx, cy - 4.5, cx, cy - 12, 7);\n" +
            "            dxf.addLine(cx, cy + 3, cx - 2.6, cy - 4.5, 7);\n" +
            "            dxf.addLine(cx, cy + 3, cx + 2.6, cy - 4.5, 7);\n" +
            "            dxf.addLine(cx - 2.6, cy - 4.5, cx + 2.6, cy - 4.5, 7);\n" +
            "            dxf.addLine(cx - 3.5, cy - 9.5, cx + 3.5, cy - 9.5, 7);\n" +
"        }\n" +
"        // Draw Texts\n" +
                    "        textElements.forEach(el => {\n" +
                    "            const rect = el.getBoundingClientRect();\n" +
                    "            const text = el.innerText.trim();\n" +
                    "            if (!text) return;\n" +
                    "            \n" +
                    "            const style = window.getComputedStyle(el);\n" +
                    "            const draggable = el.closest('.print-draggable');\n" +
"            const scale = draggable ? parseFloat(draggable.getAttribute('data-scale')) || 1 : 1;\n" +
"            const fontSizePx = parseFloat(style.fontSize) || 12;\n" +
"            const hMm = (fontSizePx * scale) * pxToMm;\n" +
                    "            \n" +
                    "            const align = style.textAlign;\n" +
                    "            let px = unscale(rect.left - paperRect.left) + 5.5; \n" +
                    "            let alignCode = 'L';\n" +
                    "            if (align === 'center') {\n" +
                    "                px = unscale(rect.left + rect.width / 2 - paperRect.left);\n" +
                    "                alignCode = 'C';\n" +
                    "            } else if (align === 'right') {\n" +
                    "                px = unscale(rect.right - paperRect.left) - 2;\n" +
                    "                alignCode = 'R';\n" +
                    "            }\n" +
                    "            \n" +
                    "            let py = unscale(rect.bottom - paperRect.top) - (fontSizePx * scale * 0.2); \n" +
                    "            if (el.classList.contains(\'pl-summary-text\')) py = unscale(rect.top + rect.height / 2 - paperRect.top) + (fontSizePx * scale * 0.45);\n" +
                    "            \n" +
                    "            dxf.addText(text.split(String.fromCharCode(10)).join(' '), toDxfX(px), toDxfY(py), hMm, 7, alignCode);\n" +
                    "        });\n" +
                    "\n" +
                    "        const dxfStr = dxf.toString();\n" +
                    "        let blob;\n" +
                    "        if (window.Encoding) {\n" +
                    "            const sjisArray = Encoding.convert(Encoding.stringToCode(dxfStr), { to: 'SJIS', from: 'UNICODE' });\n" +
                    "            blob = new Blob([new Uint8Array(sjisArray)], { type: 'application/dxf' });\n" +
                    "        } else {\n" +
                    "            blob = new Blob([dxfStr], { type: 'application/dxf;charset=utf-8;' });\n" +
                    "        }\n" +
                    "        const url = URL.createObjectURL(blob);\n" +
                    "        const a = document.createElement('a');\n" +
                    "        a.href = url;\n" +
                    "        const fname = document.getElementById('filename') ? document.getElementById('filename').value : 'export';\n" +
                    "        a.download = fname + '.dxf';\n" +
                    "        a.click();\n" +
                    "        URL.revokeObjectURL(url);\n" +
                    "    });\n" +
                    "\n" +
                    