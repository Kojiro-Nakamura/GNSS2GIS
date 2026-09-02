import { GeoUtils } from '../utils/GeoUtils.js';
import { APP_CONFIG } from '../config/constants.js';

export class ExportService {
    constructor(app) {
        this.app = app;
    }

            executeSaveJson() {
                const filename = document.getElementById('exportJsonFilename').value || this.app.getDefaultFilename();
                const data = {
                    points: this.app.state.points,
                    edges: this.app.state.edges.map(e => ({ from: e.from, to: e.to })),
                    attributes: this.app.state.attributes,
                    customTexts: this.app.state.customTexts,
                    customLines: this.app.state.customLines,
                    pointIdCounter: this.app.pointIdCounter
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.app.showToast('状況をJSONファイルで保存しました。');
            }

            async getAllFilesFromDataTransfer(dataTransfer) {
                const files = [];
                if (dataTransfer.items) {
                    const promises = [];
                    for (let i = 0; i < dataTransfer.items.length; i++) {
                        const item = dataTransfer.items[i];
                        if (item.kind === 'file') {
                            const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                            if (entry) {
                                promises.push(this.traverseFileTree(entry, files));
                            } else {
                                files.push(item.getAsFile());
                            }
                        }
                    }
                    await Promise.all(promises);
                } else if (dataTransfer.files) {
                    for (let i = 0; i < dataTransfer.files.length; i++) {
                        files.push(dataTransfer.files[i]);
                    }
                }
                return files;
            }

            traverseFileTree(item, files) {
                return new Promise((resolve) => {
                    if (item.isFile) {
                        item.file((file) => {
                            files.push(file);
                            resolve();
                        });
                    } else if (item.isDirectory) {
                        const dirReader = item.createReader();
                        const readAllEntries = () => {
                            dirReader.readEntries(async (entries) => {
                                if (entries.length === 0) {
                                    resolve();
                                } else {
                                    const promises = entries.map(entry => this.traverseFileTree(entry, files));
                                    await Promise.all(promises);
                                    readAllEntries(); 
                                }
                            });
                        };
                        readAllEntries();
                    } else {
                        resolve();
                    }
                });
            }

            async loadJsonFromFile(event) {
                const files = event.target.files;
                if (!files || files.length === 0) return;
                
                await this.app.handleFiles(files);
                event.target.value = '';
            }

            async handleFiles(files) {
                const jsonFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));
                
                if (jsonFiles.length === 0) {
                    this.app.showToast('JSONファイルが含まれていません。');
                    return;
                }

                const readPromises = jsonFiles.map(file => {
                    return new Promise((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve({ name: file.name, content: e.target.result });
                        reader.onerror = (e) => reject(e);
                        reader.readAsText(file);
                    });
                });

                try {
                    const results = await Promise.all(readPromises);
                    this.app.loadedFilesData = [];

                    results.forEach(res => {
                        try {
                            const data = JSON.parse(res.content);
                            if (data.points && data.edges) {
                                this.app.loadedFilesData.push({
                                    filename: res.name,
                                    points: data.points,
                                    edges: data.edges,
                                    attributes: data.attributes || JSON.parse(JSON.stringify(APP_CONFIG.DEFAULT_ATTRIBUTES)),
                                    customTexts: data.customTexts || [],
                                    customLines: data.customLines || [],
                                    pointIdCounter: data.pointIdCounter || 1
                                });
                            }
                        } catch (e) {
                            console.error(`JSON parse error for ${res.name}:`, e);
                        }
                    });

                    if (this.app.loadedFilesData.length > 0) {
                        this.showLoadPreviewModal();
                    } else {
                        this.app.showToast('有効なデータを含むファイルがありませんでした。');
                    }
                } catch (error) {
                    console.error("File reading error:", error);
                    this.app.showToast('ファイルの読み込みに失敗しました。');
                }
            }

            showLoadPreviewModal() {
                this.app.els.previewFileList.innerHTML = '';
                
                this.app.loadedFilesData.forEach((fileData, index) => {
                    const li = document.createElement('li');
                    li.className = 'preview-file-item';
                    li.textContent = fileData.filename;
                    li.title = fileData.filename;
                    
                    li.onclick = () => this.selectPreviewFile(index);
                    li.ondblclick = () => {
                        this.selectPreviewFile(index);
                        this.applyLoadData();
                    };
                    
                    this.app.els.previewFileList.appendChild(li);
                });

                this.selectPreviewFile(0);
                this.app.els.loadPreviewModal.style.display = 'flex';
            }

            selectPreviewFile(index) {
                const listItems = this.app.els.previewFileList.querySelectorAll('.preview-file-item');
                listItems.forEach((li, i) => {
                    if (i === index) li.classList.add('active');
                    else li.classList.remove('active');
                });

                const data = this.app.loadedFilesData[index];
                this.app.pendingLoadData = data;

                const detector = new PolygonDetector(data.points, data.edges);
                const areas = detector.detect();

                this.app.els.previewMapContainer.innerHTML = this.generatePreviewSVG(data.points, data.edges, areas, data);

                let totalArea = 0;
                areas.forEach(a => totalArea += GeoUtils.m2ToHa(a.netArea));

                let attrText = '';
                if (data.attributes && data.attributes.length > 0) {
                    const validAttrs = data.attributes.filter(a => a.name || a.value);
                    if (validAttrs.length > 0) {
                        const attrStr = validAttrs.map(a => `[${a.name}] ${a.value}`).join('　');
                        attrText = `<div style="margin-top: 4px; color: #475569; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${attrStr}">🏷️ 属性: ${attrStr}</div>`;
                    }
                }

                this.app.els.previewInfo.innerHTML = `
                    <strong>📄 ${data.filename}</strong><br>
                    📍 測点数: ${data.points.length} 個　🔗 結線数: ${data.edges.length} 本<br>
                    📐 検出区画: ${areas.length} 区画 (合計面積: ${totalArea.toFixed(4)} ha)
                    ${attrText}
                `;
            }

            generatePreviewSVG(points, edges, areas, data = null) {
                if (!points || points.length === 0) return '<div style="color:#94a3b8;">データがありません</div>';

                let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                points.forEach(p => {
                    if (p.lat < minLat) minLat = p.lat;
                    if (p.lat > maxLat) maxLat = p.lat;
                    if (p.lng < minLng) minLng = p.lng;
                    if (p.lng > maxLng) maxLng = p.lng;
                });

                const latDiff = maxLat - minLat;
                const lngDiff = maxLng - minLng;
                
                const padLat = (latDiff === 0 ? 0.001 : latDiff) * 0.1;
                const padLng = (lngDiff === 0 ? 0.001 : lngDiff) * 0.1;
                
                const vMinLng = minLng - padLng;
                const vMaxLat = maxLat + padLat;
                const vWidth = lngDiff + (padLng * 2);
                const vHeight = latDiff + (padLat * 2);

                const strokeW = vWidth * 0.008;
                const radius = vWidth * 0.015;

                let svg = `<svg width="100%" height="100%" viewBox="${vMinLng} ${-vMaxLat} ${vWidth} ${vHeight}" preserveAspectRatio="xMidYMid meet">`;

                if (areas && areas.length > 0) {
                    areas.forEach(area => {
                        const pts = area.coords.map(c => `${c[1]},${-c[0]}`).join(' ');
                        svg += `<polygon points="${pts}" fill="${APP_CONFIG.COLORS.polyFill}" fill-opacity="0.3" stroke="none" />`;
                        area.holes.forEach(hole => {
                            const hPts = hole.coords.map(c => `${c[1]},${-c[0]}`).join(' ');
                            svg += `<polygon points="${hPts}" fill="#f8fafc" stroke="none" />`;
                        });
                    });
                }

                if (data && data.customLines) {
                    data.customLines.forEach(l => {
                        const pts = l.latlngs.map(c => `${c[1]},${-c[0]}`).join(' ');
                        const w = (l.weight || 2) * (strokeW / 2);
                        const c = l.color || '#333333';
                        const dash = l.dashArray ? ` stroke-dasharray="${l.dashArray}"` : '';
                        svg += `<polyline points="${pts}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"${dash} />`;
                    });
                }

                edges.forEach(e => {
                    const p1 = points.find(p => p.id === e.from);
                    const p2 = points.find(p => p.id === e.to);
                    if (p1 && p2) {
                        svg += `<line x1="${p1.lng}" y1="${-p1.lat}" x2="${p2.lng}" y2="${-p2.lat}" stroke="${APP_CONFIG.COLORS.line}" stroke-width="${strokeW}" stroke-linecap="round" />`;
                    }
                });

                points.forEach(p => {
                    svg += `<circle cx="${p.lng}" cy="${-p.lat}" r="${radius}" fill="#fff" stroke="${APP_CONFIG.COLORS.pointBorder}" stroke-width="${strokeW * 0.5}" />`;
                });

                if (data && data.customTexts) {
                    data.customTexts.forEach(t => {
                        const x = t.lng;
                        const y = -t.lat;
                        const fs = (t.fontSize || 16) * (strokeW / 4);
                        const color = t.color || '#000000';
                        const rot = t.rotation || 0;
                        const lines = t.text.split('\n');
                        let textSvg = '';
                        lines.forEach((line, idx) => {
                            textSvg += `<text x="0" y="${idx * fs * 1.5}" font-size="${fs}" font-family="sans-serif" font-weight="bold" fill="${color}" stroke="#fff" stroke-width="${strokeW * 0.5}" paint-order="stroke">${line}</text>`;
                        });
                        svg += `<g transform="translate(${x},${y}) rotate(${rot})">${textSvg}</g>`;
                    });
                }

                svg += `</svg>`;
                return svg;
            }

            applyLoadData() {
                if (!this.app.pendingLoadData) return;
                
                this.app.state.points = this.app.pendingLoadData.points;
                this.app.state.edges = this.app.pendingLoadData.edges;
                this.app.state.attributes = this.app.pendingLoadData.attributes;
                this.app.state.customTexts = this.app.pendingLoadData.customTexts || [];
                this.app.state.customLines = this.app.pendingLoadData.customLines || [];
                this.app.pointIdCounter = this.app.pendingLoadData.pointIdCounter;
                
                this.app.updateAll();
                setTimeout(() => this.app.fitBoundsToPoints(true), 250);
                
                this.app.showToast('JSONファイルを読み込みました。');
                this.app.pendingLoadData = null;
                this.app._closeModal(this.app.els.loadPreviewModal);
            }

            executeExportGeoJSON() {
                const filename = document.getElementById('exportGeoJsonFilename').value || this.app.getDefaultFilename();
                const features = [];
                const customProps = {};
                this.app.state.attributes.forEach(attr => { if (attr.name) customProps[attr.name] = attr.value; });
                
                this.app.state.areas.forEach((a, i) => {
                    const coords = [a.coords.map(c => [c[1], c[0]])];
                    coords[0].push(coords[0][0]);
                    a.holes.forEach(hole => {
                        const hCoords = hole.coords.map(c => [c[1], c[0]]);
                        hCoords.push(hCoords[0]); coords.push(hCoords);
                    });
                    features.push({
                        type: "Feature",
                        properties: { "名称": `区画 ${i+1}`, "全体面積_m2": parseFloat(a.area.toFixed(2)), "正味面積_m2": parseFloat(a.netArea.toFixed(2)), "正味面積_ha": GeoUtils.m2ToHa(a.netArea), ...customProps },
                        geometry: { type: "Polygon", coordinates: coords }
                    });
                });

                this.app.state.edges.forEach(e => {
                    const p1 = this.app.getPoint(e.from), p2 = this.app.getPoint(e.to);
                    if (p1 && p2) features.push({
                        type: "Feature", properties: { "結線": `${p1.name} - ${p2.name}`, ...customProps },
                        geometry: { type: "LineString", coordinates: [[p1.lng, p1.lat], [p2.lng, p2.lat]] }
                    });
                });

                this.app.state.points.forEach(p => features.push({
                    type: "Feature", properties: { "測点名": p.name, "緯度": p.lat, "経度": p.lng, ...customProps },
                    geometry: { type: "Point", coordinates: [p.lng, p.lat] }
                }));

                this.app.state.customLines.forEach((l, i) => {
                    features.push({
                        type: "Feature", properties: { "種別": "自由線", "id": l.id, "太さ": l.weight || 2, "色": l.color || '#333333', "線種": l.dashArray || '実線', ...customProps },
                        geometry: { type: "LineString", coordinates: l.latlngs.map(latlng => [latlng[1], latlng[0]]) }
                    });
                });

                this.app.state.customTexts.forEach(t => {
                    features.push({
                        type: "Feature", properties: { "種別": "テキスト", "テキスト": t.text, ...customProps },
                        geometry: { type: "Point", coordinates: [t.lng, t.lat] }
                    });
                });

                const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: features }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${filename}.geojson`;
                a.click(); URL.revokeObjectURL(url);
                this.app.showToast('GeoJSONを出力しました。');
            }

            openPrintLayoutWindow() {
                if (this.app.state.points.length === 0) return this.app.showToast('出力するデータがありません。');
                
                const win = window.open('', '_blank');
                if (!win) return this.app.showToast('ポップアップブロックを解除して、もう一度お試しください。');

                const filename = this.app.getDefaultFilename();
                
                let currentTileUrl = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
                if (this.app.map) {
                    this.app.map.eachLayer(layer => {
                        if (layer instanceof L.TileLayer) {
                            currentTileUrl = layer._url;
                        }
                    });
                }
                const isBgVisible = this.app.state.isMapView;

                const exportData = {
                    points: this.app.state.points,
                    edges: this.app.state.edges,
                    areas: this.app.state.areas,
                    customTexts: this.app.state.customTexts,
                    customLines: this.app.state.customLines,
                    attributes: this.app.state.attributes,
                    filename: filename,
                    bgMapUrl: currentTileUrl,
                    isMapView: isBgVisible
                };

                const appDataStr = JSON.stringify(exportData, (key, value) => {
                    if (key === 'parent') return undefined;
                    return value;
                }).replace(/</g, '\\u003c');
                const colorsStr = JSON.stringify(APP_CONFIG.COLORS).replace(/</g, '\\u003c');
                
                const sStart = "<scr" + "ipt>";
                const sEnd = "</scr" + "ipt>";

const htmlStr = [
                    "<!DOCTYPE html>",
                    "<html lang='ja'>",
                    "<head>",
                    "<meta charset='UTF-8'>",
                    "<title>平面図レイアウト調整 - " + filename + "</title>",
                    "<link rel='stylesheet' href='https://unpkg.com/leaflet@1.9.4/dist/leaflet.css' />",
                    "<script src='https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'></scr" + "ipt>",
                    "<script src='https://cdnjs.cloudflare.com/ajax/libs/encoding-japanese/2.0.0/encoding.min.js'></scr" + "ipt>",
                    "<script src='https://cdnjs.cloudflare.com/ajax/libs/proj4js/2.9.0/proj4.js'></scr" + "ipt>",
                    "<style>\n  .leaflet-container { background: #fff !important; }",
                    "  body { margin: 0; font-family: \'Segoe UI\', Tahoma, Geneva, Verdana, sans-serif; background: #525659; display: flex; flex-direction: column; height: 100vh; overflow: hidden; }",
                    "  .print-toolbar { background: #282828; color: white; padding: 10px 15px; display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-shadow: 0 2px 5px rgba(0,0,0,0.5); z-index: 100; flex-shrink: 0; }",
                    "  .print-toolbar select, .print-toolbar input { padding: 4px 6px; border-radius: 4px; border: none; font-size: 13px; color: #000; }",
                    "  button { background: #355E8B; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold; }",
                    "  button:hover { opacity: 0.9; }",
                    "  button.btn-green { background: #217270; }",
                    "  button.btn-purple { background: #725684; }",
                    "  .print-workspace { flex: 1; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 40px; position: relative; }",
                    "  .print-canvas-container { position: relative; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.5); flex-shrink: 0; overflow: hidden; margin-bottom: 40px; transform-origin: top center; transition: transform 0.15s ease-out; }",
                    "  .print-canvas-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }",
                    "  .print-draggable { position: absolute; cursor: move; transform-origin: top left; user-select: none; -webkit-user-select: none; }",
                    "  .print-hover-outline { transition: outline 0.2s, outline-offset 0.2s; outline: 2px dashed transparent; outline-offset: 4px; }",
                    "  .print-hover-outline { transition: outline 0.2s, outline-offset 0.2s; outline: 2px dashed transparent; outline-offset: 4px; }",
                    "  .print-hover-outline:hover { outline-color: #3b82f6; outline-offset: 2px; }",
                    "  .svg-draggable { cursor: move; }",
                    "  .svg-draggable:hover { opacity: 0.6; }",
                    "  .pl-table-title { background: #f0f0f0; padding: 3px 5px; font-weight: bold; font-size: 12px; border-bottom: 2px solid #333; text-align: center; color: #000; }",
                    "  .pl-table { border-collapse: collapse; font-size: 12px; border-style: hidden; width: 100%; margin: 0; color: #000; background: #fff; }",
                    "  .pl-table th, .pl-table td { border: 1px solid #333; padding: 2px 4px; white-space: nowrap; color: #000; text-align: center; font-weight: normal; }",
                    "  .pl-table th { background: transparent; }",
                    "  .pl-attr-table { width: 100%; margin: 0; border: none; border-collapse: collapse; font-size: 12px; color: #000; background: #fff; }",
                    "  .pl-attr-table th, .pl-attr-table td { border: 1px solid #333; padding: 4px 10px; white-space: nowrap; color: #000; text-align: left; font-weight: normal; }",
                    "  .pl-box { background: #fff; border: 2px solid #333; }",
                    "  .map-cropper { outline: 1px dashed transparent; pointer-events: auto; }",
                    "  #pl-map:hover .map-cropper, .map-cropper.active { outline-color: #f59e0b; }",
                    "  .resize-handle { position: absolute; width: 12px; height: 12px; background: #fff; border: 1px solid #333; display: none; z-index: 10; pointer-events: auto; }",
                    "  #pl-map:hover .resize-handle, .map-cropper.active .resize-handle { display: block; }",
                    "  .resize-handle.n { top: -6px; left: calc(50% - 6px); cursor: ns-resize; }",
                    "  .resize-handle.s { bottom: -6px; left: calc(50% - 6px); cursor: ns-resize; }",
                    "  .resize-handle.e { top: calc(50% - 6px); right: -6px; cursor: ew-resize; }",
                    "  .resize-handle.w { top: calc(50% - 6px); left: -6px; cursor: ew-resize; }",
                    "  .resize-handle.ne { top: -6px; right: -6px; cursor: nesw-resize; }",
                    "  .resize-handle.nw { top: -6px; left: -6px; cursor: nwse-resize; }",
                    "  .resize-handle.se { bottom: -6px; right: -6px; cursor: nwse-resize; }",
                    "  .resize-handle.sw { bottom: -6px; left: -6px; cursor: nesw-resize; }",
                    "  .print-help-bar { position: absolute; bottom: 0; left: 0; width: 100%; background: rgba(0,0,0,0.7); color: white; text-align: center; padding: 6px; font-size: 13px; z-index: 100; pointer-events: none; }",
                    "  @media print {",
                    "      body { background: #fff; display: block; height: auto; overflow: visible; -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
                    "      .print-toolbar, .print-help-bar { display: none !important; }",
                    "      .print-workspace { padding: 0 !important; display: block; overflow: visible; }",
                    "      .print-canvas-container { box-shadow: none !important; margin: 0 !important; page-break-after: avoid; page-break-inside: avoid; transform: none !important; }",
                    "      .print-hover-outline { outline: none !important; }",
                    "      .svg-draggable { cursor: default; opacity: 1 !important; }",
                    "  }",
                    "</style>",
                    "<style id='dynamicStyle'></style>",
                    "</head>",
                    "<body>",
                    "    <div class='print-toolbar'>",
                    "        <div style='display:flex; align-items:center; gap:4px;'>",
                    "            <label style='font-size:13px;'>📄 用紙:</label>",
                    "            <select id='paperSize'><option value='A4' selected>A4</option><option value='A3'>A3</option><option value='A2'>A2</option><option value='A1'>A1</option><option value='A0'>A0</option></select>",
                    "            <select id='paperOrient'><option value='landscape' selected>横</option><option value='portrait'>縦</option></select>",
                    "        </div>",
                    "        <div style='display:flex; align-items:center; gap:4px; margin-left: 10px;'>",
                    "            <label style='font-size:13px;'>🔍 縮尺: 1 /</label>",
                    "            <input type='number' id='scale' value='1000' style='width: 70px;'>",
                    "            <button id='btnAutoScale' style='padding: 4px 8px; font-size: 11px;'>自動調整</button>",
                    "        </div>",
                    "        <div style='display:flex; align-items:center; gap:4px; margin-left: 10px;'>",
                    "            <label style='font-size:13px;'>📑 表折り返し:</label>",
                    "            <select id='tableWrap'><option value='0'>なし</option><option value='20'>20行</option><option value='30'>30行</option><option value='50' selected>50行</option></select>",
                    "        </div>",
                    "        <div style='display:flex; align-items:center; gap:4px; margin-left: 10px;'>",
                    "            <label style='font-size:13px;'>ファイル名:</label>",
                    "            <input type='text' id='filename' value='" + filename + "' style='width: 180px;'>",
                    "        </div>",
                    "        <div style='display:flex; align-items:center; gap:4px; margin-left: 10px;'>",
                    "            <label style='font-size:13px;'>表示:</label>",
                    "            <button id='btnFitView' style='padding: 2px 8px; font-size: 11px; background: #3b82f6;' title='画面サイズに合わせて全体を表示'>フィット</button>",
                    "            <button id='btnZoomOut' style='padding: 2px 8px; font-size: 14px; background: #64748b;' title='縮小'>－</button>",
                    "            <span id='zoomLevel' style='font-size: 13px; width: 40px; text-align: center;'>100%</span>",
                    "            <button id='btnZoomIn' style='padding: 2px 8px; font-size: 14px; background: #64748b;' title='拡大'>＋</button>",
                    "            <label style='font-size:13px; margin-left: 10px; cursor: pointer;'><input type='checkbox' id='chkBgMap' " + (exportData.isMapView ? 'checked' : '') + "> 背景地図</label>",
                    "            <select id='bgMapType' style='margin-left:5px; font-size:13px;'>",
                    "                <option value='https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png' " + (exportData.activeBgUrl && exportData.activeBgUrl.includes('std') ? 'selected' : '') + ">標準地図</option>",
                    "                <option value='https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg' " + (exportData.activeBgUrl && exportData.activeBgUrl.includes('seamlessphoto') ? 'selected' : '') + ">航空写真</option>",
                    "                <option value='https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png' " + (exportData.activeBgUrl && exportData.activeBgUrl.includes('pale') ? 'selected' : '') + ">淡色地図</option>",
                    "            </select>",
                    "        </div>",
                    "        <div style='flex: 1;'></div>",
                    "        <button id='btnPrint' class='btn-green'>🖨️ 印刷する</button>",
                    "        <select id='dxfZone' style='padding: 3px 5px; font-size: 13px; border-radius: 4px; color: #000;'>",
                    "            <option value='0'>相対座標 (最初の点を 0,0 とする)</option>",
                    "            <option value='1'>第1系 (長崎・佐賀など)</option>",
                    "            <option value='2'>第2系 (福岡・大分など)</option>",
                    "            <option value='3'>第3系 (山口・島根など)</option>",
                    "            <option value='4'>第4系 (香川・愛媛など)</option>",
                    "            <option value='5'>第5系 (兵庫・鳥取など)</option>",
                    "            <option value='6'>第6系 (京都・大阪・和歌山など)</option>",
                    "            <option value='7'>第7系 (石川・富山など)</option>",
                    "            <option value='8'>第8系 (新潟・長野など)</option>",
                    "            <option value='9'>第9系 (東京・埼玉・神奈川など)</option>",
                    "            <option value='10'>第10系 (青森・秋田など)</option>",
                    "            <option value='11'>第11系 (北海道西部)</option>",
                    "            <option value='12'>第12系 (北海道中央部)</option>",
                    "            <option value='13'>第13系 (北海道東部)</option>",
                    "            <option value='14'>第14系 (小笠原など)</option>",
                    "            <option value='15'>第15系 (沖縄本島など)</option>",
                    "            <option value='16'>第16系 (先島諸島など)</option>",
                    "            <option value='17'>第17系 (大東諸島など)</option>",
                    "            <option value='18'>第18系 (沖ノ鳥島など)</option>",
                    "            <option value='19'>第19系 (南鳥島など)</option>",
                    "        </select>",
                    "        <button id='btnExportDxf' style='background: #c2410c;'>💾 DXF保存</button>",
"        <button id='btnExportHtml' class='btn-purple'>📄 HTML保存</button>",
                    "    </div>",
                    "    <div class='print-workspace' id='workspace'>",
                    "        <div class='print-canvas-container' id='canvasWrap'>",
                    "            <div id='bg-map' class='print-canvas-layer' style='z-index:0; display:none;'></div>",
                    "            <div id='canvas' class='print-canvas-layer' style='z-index:1;'></div>",
                    "        </div>",
                    "    </div>",
                    "    <div class='print-help-bar'>💡 表や図面、方位記号をドラッグで自由に移動できます。背景ホイールで用紙全体を、表の上のホイールで表の拡大縮小が可能です。文字要素（区画名など）もドラッグで微調整できます。Ctrl+Pでも印刷できます。</div>",
                    sStart,
                    "    const APP_DATA = " + appDataStr + ";",
                    "    const COLORS = " + colorsStr + ";",
                    "    ",
                    "    class GeoUtils {",
                    "        static LAT_DEG_PER_METER = 1 / 111111;",
                    "        static getLonDegPerMeter(lat) { return this.LAT_DEG_PER_METER / Math.cos(lat * Math.PI / 180); }",
                    "        static m2ToHa(sqMeters) { return Math.round(((sqMeters / 10000) + Number.EPSILON) * 10000) / 10000; }",
                    "    }",
                    "    const els = {",
                    "        paperSize: document.getElementById('paperSize'),",
                    "        paperOrient: document.getElementById('paperOrient'),",
                    "        scale: document.getElementById('scale'),",
                    "        btnAutoScale: document.getElementById('btnAutoScale'),",
                    "        tableWrap: document.getElementById('tableWrap'),",
                    "        filename: document.getElementById('filename'),",
                    "        btnPrint: document.getElementById('btnPrint'),",
                    "        btnExport: document.getElementById('btnExportHtml'),",
                    "        canvasWrap: document.getElementById('canvasWrap'),",
                    "        canvas: document.getElementById('canvas'),",
                    "        chkBgMap: document.getElementById('chkBgMap'),",
                    "        bgMapType: document.getElementById('bgMapType'),",
                    "        dynamicStyle: document.getElementById('dynamicStyle'),",
                    "        workspace: document.getElementById('workspace')",
                    "    };",
                    "    if (APP_DATA.bgMapUrl) { els.bgMapType.value = APP_DATA.bgMapUrl; }",
                    "    const positions = {};",
                    "    function calcAutoScale() {",
                    "        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;",
                    "        let p0 = {lat: 35, lng: 139};",
                    "        if (APP_DATA.points && APP_DATA.points.length > 0) p0 = APP_DATA.points[0];",
                    "        else if (APP_DATA.customLines && APP_DATA.customLines.length > 0) p0 = {lat: APP_DATA.customLines[0].latlngs[0][0], lng: APP_DATA.customLines[0].latlngs[0][1]};",
                    "        else if (APP_DATA.areas && APP_DATA.areas.length > 0) p0 = {lat: APP_DATA.areas[0].coords[0][0], lng: APP_DATA.areas[0].coords[0][1]};",
                    "        window.lonDegPerMeter = GeoUtils.getLonDegPerMeter(p0.lat);",
                    "        const lonDegPerMeter = GeoUtils.getLonDegPerMeter(p0.lat);",
                    "        APP_DATA.points.forEach(p => {",
                    "            const x = (p.lng - p0.lng) / lonDegPerMeter;",
                    "            const y = -(p.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "            if (x < minX) minX = x; if (x > maxX) maxX = x;",
                    "            if (y < minY) minY = y; if (y > maxY) maxY = y;",
                    "        });",
                    "        const updateBounds = (lng, lat) => {",
                    "            const x = (lng - p0.lng) / lonDegPerMeter;",
                    "            const y = -(lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "            if (x < minX) minX = x; if (x > maxX) maxX = x;",
                    "            if (y < minY) minY = y; if (y > maxY) maxY = y;",
                    "        };",
                    "        if (APP_DATA.customLines) APP_DATA.customLines.forEach(l => l.latlngs.forEach(c => updateBounds(c[1] !== undefined ? c[1] : c.lng, c[0] !== undefined ? c[0] : c.lat)));",
                    "        if (APP_DATA.areas) APP_DATA.areas.forEach(a => a.coords.forEach(c => updateBounds(c[1], c[0])));",
                    "        if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 10; }",
                    "        const w = maxX - minX || 10;",
                    "        const h = maxY - minY || 10;",
                    "        const pad = Math.max(w, h) * 0.05;",
                    "        const paperSize = els.paperSize.value;",
                    "        const paperOrient = els.paperOrient.value;",
                    "        const paperDims = { 'A4': [210, 297], 'A3': [297, 420], 'A2': [420, 594], 'A1': [594, 841], 'A0': [841, 1189] };",
                    "        let [paperW_mm, paperH_mm] = paperDims[paperSize] || [210, 297];",
                    "        if (paperOrient === 'landscape') { const tmp = paperW_mm; paperW_mm = paperH_mm; paperH_mm = tmp; }",
                    "        const availableW_m = (paperW_mm - 20) / 1000;",
                    "        const availableH_m = (paperH_mm - 20) / 1000;",
                    "        const reqScaleW = (w + pad*2) / availableW_m;",
                    "        const reqScaleH = (h + pad*2) / availableH_m;",
                    "        const reqScale = Math.max(reqScaleW, reqScaleH);",
                    "        const predefinedScales = [100, 200, 300, 400, 500, 600, 1000, 2000, 3000, 4000, 5000, 6000];",
                    "        els.scale.value = predefinedScales.find(s => s >= reqScale) || 6000;",
                    "    }",
                    "    function renderCanvas() {",
                    "        els.canvas.innerHTML = '';",
                    "        els.canvasWrap.querySelectorAll('.print-draggable').forEach(e => e.remove());",
                    "        const paperSize = els.paperSize.value;",
                    "        const paperOrient = els.paperOrient.value;",
                    "        const scaleVal = parseFloat(els.scale.value) || 1000;",
                    "        let wrapLimit = parseInt(els.tableWrap.value, 10);",
                    "        els.dynamicStyle.textContent = '@page { size: ' + paperSize + ' ' + paperOrient + '; margin: 0; }';",
                    "        const paperDims = { 'A4': [210, 297], 'A3': [297, 420], 'A2': [420, 594], 'A1': [594, 841], 'A0': [841, 1189] };",
                    "        let [paperW_mm, paperH_mm] = paperDims[paperSize] || [210, 297];",
                    "        if (paperOrient === 'landscape') { const tmp = paperW_mm; paperW_mm = paperH_mm; paperH_mm = tmp; }",
                    "        const paperW_px = paperW_mm * 3.7795;",
                    "        const paperH_px = paperH_mm * 3.7795;",
                    "        els.canvasWrap.style.width = paperW_px + 'px';",
                    "        els.canvasWrap.style.height = paperH_px + 'px';",
                    "        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;",
                    "        const localPoints = {};",
                    "        let p0 = {lat: 35, lng: 139};",
                    "        if (APP_DATA.points && APP_DATA.points.length > 0) p0 = APP_DATA.points[0];",
                    "        else if (APP_DATA.customLines && APP_DATA.customLines.length > 0) p0 = {lat: APP_DATA.customLines[0].latlngs[0][0], lng: APP_DATA.customLines[0].latlngs[0][1]};",
                    "        else if (APP_DATA.areas && APP_DATA.areas.length > 0) p0 = {lat: APP_DATA.areas[0].coords[0][0], lng: APP_DATA.areas[0].coords[0][1]};",
                    "        const lonDegPerMeter = GeoUtils.getLonDegPerMeter(p0.lat);",
                    "        APP_DATA.points.forEach(p => {",
                    "            const x = (p.lng - p0.lng) / lonDegPerMeter;",
                    "            const y = -(p.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "            localPoints[p.id] = { x, y, name: p.name };",
                    "            if (x < minX) minX = x; if (x > maxX) maxX = x;",
                    "            if (y < minY) minY = y; if (y > maxY) maxY = y;",
                    "        });",
                    "        const updateBounds = (lng, lat) => {",
                    "            const x = (lng - p0.lng) / lonDegPerMeter;",
                    "            const y = -(lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "            if (x < minX) minX = x; if (x > maxX) maxX = x;",
                    "            if (y < minY) minY = y; if (y > maxY) maxY = y;",
                    "        };",
                    "        if (APP_DATA.customLines) APP_DATA.customLines.forEach(l => l.latlngs.forEach(c => updateBounds(c[1] !== undefined ? c[1] : c.lng, c[0] !== undefined ? c[0] : c.lat)));",
                    "        if (APP_DATA.areas) APP_DATA.areas.forEach(a => a.coords.forEach(c => updateBounds(c[1], c[0])));",
                    "        if (minX === Infinity) { minX = 0; maxX = 10; minY = 0; maxY = 10; }",
                    "        const w = maxX - minX || 10;",
                    "        const h = maxY - minY || 10;",
                    "        const pad = Math.max(w, h) * 0.05;",
                    "        const pxPerMeter = (1000 / scaleVal) * 3.7795;",
                    "        const svgW_px = (w + pad*2) * pxPerMeter;",
                    "        const svgH_px = (h + pad*2) * pxPerMeter;",
                    "        const viewBox = (minX - pad) + ' ' + (minY - pad) + ' ' + (w + pad*2) + ' ' + (h + pad*2);",
                    "        const fontSize = 12 / pxPerMeter;",
                    "        const strokeW = 1.5 / pxPerMeter;",
                    "        const radius = 3.5 / pxPerMeter;",
                    "        let svgInner = '';",
                    "        let svgLabels = '';",
                    "        APP_DATA.areas.forEach((area, i) => {",
                    "            let areaSvg = '';",
                    "            const coordsToLocal = (coords) => coords.map(c => ((c[1] - p0.lng) / lonDegPerMeter) + ',' + (-(c[0] - p0.lat) / GeoUtils.LAT_DEG_PER_METER)).join(' ');",
                    "            areaSvg += '<polygon style=\"pointer-events:auto;\" points=\"' + coordsToLocal(area.coords) + '\" fill=\"' + COLORS.polyFill + '\" fill-opacity=\"0.2\" stroke=\"none\" />';",
                    "            area.holes.forEach(hole => areaSvg += '<polygon style=\"pointer-events:auto;\" points=\"' + coordsToLocal(hole.coords) + '\" fill=\"#fff\" fill-opacity=\"0.5\" stroke=\"none\" />');",
                    "            areaSvg += '<polygon style=\"pointer-events:auto;\" points=\"' + coordsToLocal(area.coords) + '\" fill=\"' + COLORS.polyFill + '\" fill-opacity=\"0.2\" stroke=\"none\" style=\"pointer-events:auto;\" />';",
                    "            area.holes.forEach(hole => areaSvg += '<polygon style=\"pointer-events:auto;\" points=\"' + coordsToLocal(hole.coords) + '\" fill=\"#fff\" fill-opacity=\"0.5\" stroke=\"none\" style=\"pointer-events:auto;\" />');",
                    "            svgInner += '<g>' + areaSvg + '</g>';",
                    "            const cx = (area.center.lng - p0.lng) / lonDegPerMeter;",
                    "            const cy = -(area.center.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "            svgLabels += '<g class=\"svg-draggable\" style=\"pointer-events:auto;\">' +",
                    "                '<rect x=\"' + (cx - fontSize*3.5) + '\" y=\"' + (cy - fontSize*1.3) + '\" width=\"' + (fontSize*7) + '\" height=\"' + (fontSize*2.8) + '\" fill=\"#fff\" fill-opacity=\"0.75\" stroke=\"#333\" stroke-width=\"' + (strokeW*0.5) + '\" />' +",
                    "                '<text x=\"' + cx + '\" y=\"' + (cy - fontSize*0.1) + '\" font-size=\"' + fontSize + '\" font-family=\"sans-serif\" text-anchor=\"middle\" fill=\"#333\">区画 ' + (i+1) + '</text>' +",
                    "                '<text x=\"' + cx + '\" y=\"' + (cy + fontSize*1.1) + '\" font-size=\"' + fontSize + '\" font-family=\"sans-serif\" text-anchor=\"middle\" fill=\"#333\">' + GeoUtils.m2ToHa(area.netArea).toFixed(4) + 'ha</text>' +",
                    "            '</g>';",
                    "            area.holes.forEach((hole, j) => {",
                    "                const hx = (hole.center.lng - p0.lng) / lonDegPerMeter;",
                    "                const hy = -(hole.center.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "                svgLabels += '<g class=\"svg-draggable\" style=\"pointer-events:auto;\">' +",
                    "                    '<rect x=\"' + (hx - fontSize*3.5) + '\" y=\"' + (hy - fontSize*1.3) + '\" width=\"' + (fontSize*7) + '\" height=\"' + (fontSize*2.8) + '\" fill=\"#fff\" fill-opacity=\"0.75\" stroke=\"#A13D44\" stroke-width=\"' + (strokeW*0.5) + '\" />' +",
                    "                    '<text x=\"' + hx + '\" y=\"' + (hy - fontSize*0.1) + '\" font-size=\"' + fontSize + '\" font-family=\"sans-serif\" text-anchor=\"middle\" fill=\"#A13D44\">除地 ' + (j+1) + '</text>' +",
                    "                    '<text x=\"' + hx + '\" y=\"' + (hy + fontSize*1.1) + '\" font-size=\"' + fontSize + '\" font-family=\"sans-serif\" text-anchor=\"middle\" fill=\"#A13D44\">' + GeoUtils.m2ToHa(hole.area).toFixed(4) + 'ha</text>' +",
                    "                '</g>';",
                    "            });",
                    "        });",
                    "        if(APP_DATA.customLines) {",
                    "            APP_DATA.customLines.forEach(l => {",
                    "                const pts = l.latlngs.map(p => ((p[1] - p0.lng) / lonDegPerMeter) + ',' + (-(p[0] - p0.lat) / GeoUtils.LAT_DEG_PER_METER)).join(' ');",
                    "                const w = (l.weight || 2) * (strokeW / 2);",
                    "                const c = l.color || '#333333';",
                    "                const dash = l.dashArray ? ' stroke-dasharray=\"' + l.dashArray + '\"' : '';",
                    "                svgInner += '<g><polyline points=\"' + pts + '\" fill=\"none\" stroke=\"#fff\" stroke-width=\"' + (w + strokeW*2) + '\" stroke-linecap=\"round\" stroke-linejoin=\"round\" /><polyline style=\"pointer-events:auto;\" points=\"' + pts + '\" fill=\"none\" stroke=\"' + c + '\" stroke-width=\"' + w + '\" stroke-linecap=\"round\" stroke-linejoin=\"round\"' + dash + ' /></g>';",
                    "            });",
                    "        }",
                    "        APP_DATA.edges.forEach(e => {",
                    "            const p1 = localPoints[e.from], p2 = localPoints[e.to];",
                    "            if (p1 && p2) { svgInner += '<g><line x1=\"' + p1.x + '\" y1=\"' + p1.y + '\" x2=\"' + p2.x + '\" y2=\"' + p2.y + '\" stroke=\"#fff\" stroke-width=\"' + (strokeW*3) + '\" stroke-linecap=\"round\" stroke-linejoin=\"round\" /><line style=\"pointer-events:auto;\" x1=\"' + p1.x + '\" y1=\"' + p1.y + '\" x2=\"' + p2.x + '\" y2=\"' + p2.y + '\" stroke=\"' + COLORS.line + '\" stroke-width=\"' + strokeW + '\" stroke-linecap=\"round\" stroke-linejoin=\"round\" /></g>'; }",
                    "        });",
                    "        APP_DATA.points.forEach(p => {",
                    "            const lp = localPoints[p.id];",
                    "            svgInner += '<g><circle cx=\"' + lp.x + '\" cy=\"' + lp.y + '\" r=\"' + (radius + strokeW*1.2) + '\" fill=\"#fff\" /><circle style=\"pointer-events:auto;\" cx=\"' + lp.x + '\" cy=\"' + lp.y + '\" r=\"' + radius + '\" fill=\"#fff\" stroke=\"' + COLORS.pointBorder + '\" stroke-width=\"' + (strokeW * 0.8) + '\" /></g>';",
                    "            svgInner += '<g class=\"svg-draggable\" data-pid=\"' + p.id + '\" style=\"pointer-events:auto;\"><text x=\"' + (lp.x + radius*1.5) + '\" y=\"' + (lp.y - radius*1.5) + '\" font-size=\"' + (fontSize*0.9) + '\" font-family=\"sans-serif\" fill=\"#333\" stroke=\"#fff\" stroke-width=\"' + (strokeW*1.5) + '\" stroke-linejoin=\"round\" paint-order=\"stroke\">' + lp.name + '</text></g>';",
                    "        });",
                    "        svgInner += svgLabels;",
                    "        if(APP_DATA.customTexts) {",
                    "            APP_DATA.customTexts.forEach(t => {",
                    "                const x = (t.lng - p0.lng) / lonDegPerMeter;",
                    "                const y = -(t.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER;",
                    "                const fs = (t.fontSize || 16) * (strokeW / 4);",
                    "                const color = t.color || '#000000';",
                    "                const rot = t.rotation || 0;",
                    "                const lines = t.text.split('\\n');",
                    "                let textSvg = '';",
                    "                lines.forEach((line, idx) => {",
                    "                    textSvg += '<text x=\"0\" y=\"' + (idx * fs * 1.5) + '\" font-size=\"' + fs + '\" font-family=\"sans-serif\" font-weight=\"bold\" fill=\"' + color + '\" stroke=\"#fff\" stroke-width=\"' + (strokeW * 0.5) + '\" paint-order=\"stroke\">' + line + '</text>';",
                    "                });",
                    "                svgInner += '<g class=\"svg-draggable\" data-cid=\"' + t.id + '\" style=\"pointer-events:auto;\" transform=\"translate(' + x + ',' + y + ') rotate(' + rot + ')\">' + textSvg + '</g>';",
                    "            });",
                    "        }",
                    "        let svgHtml = '';",
                    "        if (els.chkBgMap.checked) {",
                    "            const marginPx = 10 * 3.7795;",
                    "            let cw = paperW_px - marginPx * 2, ch = paperH_px - marginPx * 2;",
                    "            let cl = marginPx - (paperW_px - svgW_px) / 2, ct = marginPx - (paperH_px - svgH_px) / 2;",
                    "            if (positions['map-cropper']) {",
                    "                cw = positions['map-cropper'].w;",
                    "                ch = positions['map-cropper'].h;",
                    "                cl = positions['map-cropper'].l;",
                    "                ct = positions['map-cropper'].t;",
                    "            }",
                    "            svgHtml += '<div id=\"map-cropper\" class=\"map-cropper\" style=\"position:absolute; top:' + ct + 'px; left:' + cl + 'px; width:' + cw + 'px; height:' + ch + 'px; z-index:0; background:rgba(0,0,0,0.01); pointer-events:auto;\">';\n" +
                    "            svgHtml += '<div style=\"position:absolute; top:0; left:0; width:100%; height:100%; overflow:hidden;\">';\n" +
                    "            svgHtml += '<div id=\"bg-map-inner\" style=\"position:absolute; top:' + (-ct - 2000) + 'px; left:' + (-cl - 2000) + 'px; width:' + (svgW_px + 4000) + 'px; height:' + (svgH_px + 4000) + 'px; pointer-events:none;\"></div>';",
                    "            svgHtml += '</div>';",
                    "            svgHtml += '<div class=\"resize-handle n\" data-dir=\"n\"></div><div class=\"resize-handle s\" data-dir=\"s\"></div><div class=\"resize-handle w\" data-dir=\"w\"></div><div class=\"resize-handle e\" data-dir=\"e\"></div>';",
                    "            svgHtml += '<div class=\"resize-handle nw\" data-dir=\"nw\"></div><div class=\"resize-handle ne\" data-dir=\"ne\"></div><div class=\"resize-handle sw\" data-dir=\"sw\"></div><div class=\"resize-handle se\" data-dir=\"se\"></div>';",
                    "            svgHtml += '</div>';",
                    "        }",
                    "        svgHtml += '<svg width=\"' + svgW_px + 'px\" height=\"' + svgH_px + 'px\" viewBox=\"' + viewBox + '\" style=\"position:relative; z-index:1; overflow:visible; pointer-events:none;\">' + svgInner + '</svg>';",
                    "        let totalLength = 0;",
                    "        APP_DATA.edges.forEach(e => {",
                    "            const p1 = APP_DATA.points.find(p=>p.id===e.from), p2 = APP_DATA.points.find(p=>p.id===e.to);",
                    "            if(p1 && p2) totalLength += Math.sqrt(Math.pow((p2.lng - p1.lng) / GeoUtils.getLonDegPerMeter((p1.lat + p2.lat) / 2), 2) + Math.pow((p2.lat - p1.lat) / GeoUtils.LAT_DEG_PER_METER, 2));",
                    "        });",
                    "        if (wrapLimit === 0) wrapLimit = APP_DATA.points.length || 1;",
                    "        let tableHtml = '<div style=\"display:flex; gap:10px; background:transparent; align-items:flex-start;\">';",
                    "        for (let i = 0; i < APP_DATA.points.length; i += wrapLimit) {",
                    "            const chunk = APP_DATA.points.slice(i, i + wrapLimit);",
                    "            tableHtml += '<div class=\"pl-box\"><div class=\"pl-table-title\">成 果 表</div><table class=\"pl-table\">' +",
                    "                '<thead><tr><th style=\"background:transparent;\">測点名</th><th style=\"background:transparent;\">緯度</th><th style=\"background:transparent;\">経度</th></tr></thead>' +",
                    "                '<tbody>' + chunk.map(p => '<tr><td>' + p.name + '</td><td style=\"text-align:right;\">' + p.lat.toFixed(8) + '</td><td style=\"text-align:right;\">' + p.lng.toFixed(8) + '</td></tr>').join('') + '</tbody></table></div>';",
                    "        }",
                    "        tableHtml += '</div>';",
                    "        let attrRows = APP_DATA.attributes.map(a => '<tr><th style=\"background:#f0f0f0; width:80px;\">' + a.name + '</th><td style=\"width:150px;\">' + a.value + '</td></tr>').join('');",
                    "        attrRows += '<tr><th style=\"background:#f0f0f0;\">縮尺</th><td>1 / ' + scaleVal.toLocaleString() + '</td></tr>';",
                    "        const attrHtml = '<div class=\"pl-box\"><table class=\"pl-attr-table\">' + attrRows + '</table></div>';",
                    "        let areaRows = APP_DATA.areas.map((a, idx) => {",
                    "            let row = '<tr><td>区画 ' + (idx+1) + '</td><td style=\"text-align:right;\">' + GeoUtils.m2ToHa(a.netArea).toFixed(4) + ' ha</td></tr>';",
                    "            if (a.holes.length > 0) row += a.holes.map((h, j) => '<tr><td style=\"padding-left:15px; color:#c00;\">(内 除地' + (j+1) + '</td><td style=\"text-align:right; color:#c00;\">' + GeoUtils.m2ToHa(h.area).toFixed(4) + ' ha)</td></tr>').join('');",
                    "            return row;",
                    "        }).join('');",
                    "        let totalArea = APP_DATA.areas.reduce((sum, a) => sum + GeoUtils.m2ToHa(a.netArea), 0);",
                    "        areaRows += '<tr style=\"border-top:1px solid #333; font-weight:bold;\"><td>合計</td><td style=\"text-align:right;\">' + totalArea.toFixed(4) + ' ha</td></tr>';",
                    "        const areaHtml = '<div class=\"pl-box\"><div class=\"pl-table-title\">面 積 表</div><table class=\"pl-table\" style=\"min-width:180px;\">' + areaRows + '</table></div>';",
                    "        const summaryHtml = '<div class=\"pl-box pl-summary-text\" style=\"padding: 5px 10px; font-size: 13px;\">面積合計: ' + totalArea.toFixed(4) + 'ha     測線長合計: ' + totalLength.toFixed(1) + 'm</div>';",
                    "        const compassHtml = '<div style=\"text-align:center; font-weight:bold; font-family:sans-serif; margin-bottom:-2px; font-size:18px; color:#333; text-shadow: -1.5px -1.5px 0 #fff, 1.5px -1.5px 0 #fff, -1.5px 1.5px 0 #fff, 1.5px 1.5px 0 #fff;\">N</div>' +",
                    "            '<svg width=\"30\" height=\"50\" viewBox=\"0 0 30 50\">' +",
                    "            '<g stroke=\"#fff\" stroke-width=\"5\" fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\"><line x1=\"15\" y1=\"2\" x2=\"15\" y2=\"48\"/><line x1=\"5\" y1=\"35\" x2=\"25\" y2=\"35\"/><polyline points=\"15,2 25,18 8,25\"/></g>' +",
                    "            '<g stroke=\"#333\" stroke-width=\"2\" fill=\"none\" stroke-linejoin=\"round\" stroke-linecap=\"round\" style=\"pointer-events:auto;\"><line x1=\"15\" y1=\"2\" x2=\"15\" y2=\"48\"/><line x1=\"5\" y1=\"35\" x2=\"25\" y2=\"35\"/><polyline points=\"15,2 25,18 8,25\"/></g></svg>';",
                    "        const createPlElement = (id, content, defaultPosFn) => {",
                    "            const el = document.createElement('div'); el.className = 'print-draggable print-hover-outline'; el.id = id; el.innerHTML = content;",
                    "            el.style.zIndex = (id === 'pl-map') ? '0' : '1';",
                    "            el.setAttribute('data-scale', '1'); el.style.opacity = '0'; els.canvasWrap.appendChild(el);",
                    "            setTimeout(() => {",
                    "                const state = positions[id];",
                    "                if (state) {",
                    "                    el.style.left = state.left; el.style.top = state.top;",
                    "                    if (state.scale) { el.style.transform = 'scale(' + state.scale + ')'; el.setAttribute('data-scale', state.scale); }",
                    "                } else {",
                    "                    const b = el.getBoundingClientRect(); const p = els.canvas.getBoundingClientRect(); const pos = defaultPosFn(b, p);",
                    "                    el.style.left = pos.left + 'px'; el.style.top = pos.top + 'px';",
                    "                    if (pos.scale) { el.style.transform = 'scale(' + pos.scale + ')'; el.setAttribute('data-scale', pos.scale); }",
                    "                    positions[id] = { left: el.style.left, top: el.style.top, scale: pos.scale || 1 };",
                    "                }",
                    "                el.style.opacity = '1'; setupDraggable(el, id);",
                    "            }, 10);",
                    "        };",
                    "        createPlElement('pl-map', svgHtml, (b, p) => ({ left: (p.width - b.width) / 2, top: (p.height - b.height) / 2 }));",
                    "        createPlElement('pl-attr', attrHtml, () => ({ left: 20, top: 30 }));",
                    "        createPlElement('pl-area', areaHtml, (b, p) => {",
                    "            const attrEl = document.getElementById('pl-attr');",
                    "            const attrBottom = attrEl ? attrEl.offsetTop + attrEl.offsetHeight : 30;",
                    "            return { left: 20, top: attrBottom + 20 };",
                    "        });",
                    "        createPlElement('pl-survey', tableHtml, (b, p) => { let scale = 1; if (b.height > p.height - 60) scale = (p.height - 60) / b.height; return { left: Math.max(20, p.width - (b.width * scale) - 20), top: 30, scale: scale }; });",
                    "        createPlElement('pl-summary', summaryHtml, (b, p) => ({ left: 120, top: p.height - b.height - 30 }));",
                    "        createPlElement('pl-compass', compassHtml, (b, p) => ({ left: 50, top: p.height - b.height - 30 }));",
                    "        setupMapCropper();",
                    "        if (els.chkBgMap.checked) {",
                    "            setTimeout(() => {",
                    "                if (window.bgMapInstance) { window.bgMapInstance.remove(); window.bgMapInstance = null; }",
                    "                if (window.L) {",
                    "                    const z = Math.log2((360 * pxPerMeter) / (256 * lonDegPerMeter));",
                    "                    const centerX_m = minX + w / 2;",
                    "                    const centerY_m = minY + h / 2;",
                    "                    const centerLng = p0.lng + centerX_m * lonDegPerMeter;",
                    "                    const centerLat = p0.lat - centerY_m * GeoUtils.LAT_DEG_PER_METER;",
                    "                    window.bgMapInstance = window.L.map('bg-map-inner', { zoomControl: false, attributionControl: false, zoomSnap: 0 });",
                    "                    window.L.tileLayer(els.bgMapType.value, { maxZoom: 22, maxNativeZoom: 18 }).addTo(window.bgMapInstance);",
                    "                    window.bgMapInstance.setView([centerLat, centerLng], z, { animate: false });",
                    "                }",
                    "            }, 20);",
                    "        } else if (window.bgMapInstance) {",
                    "            window.bgMapInstance.remove();",
                    "            window.bgMapInstance = null;",
                    "        }",
                    "    }",
                    "    els.chkBgMap.addEventListener('change', () => {",
                    "        renderCanvas();",
                    "    });",
                    "    els.bgMapType.addEventListener('change', () => {",
                    "        renderCanvas();",
                    "    });",
                    "    function setupDraggable(el, id) {",
                    "        let startX, startY, initLeft, initTop;",
                    "        el.onmousedown = (e) => {",
                    "            if (e.target.tagName === 'INPUT' || e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;",
                    "            if (e.target.closest('.svg-draggable')) return;",
                    "            e.stopPropagation(); e.preventDefault(); startX = e.clientX; startY = e.clientY; initLeft = el.offsetLeft; initTop = el.offsetTop;",
                    "            els.canvasWrap.querySelectorAll('.print-draggable').forEach(d => { if(d.id !== 'pl-map') d.style.zIndex = '1'; });",
                    "            if (id !== 'pl-map') el.style.zIndex = '10';",
                    "            const onMouseMove = (eMove) => { el.style.left = (initLeft + (eMove.clientX - startX) / currentViewScale) + 'px'; el.style.top = (initTop + (eMove.clientY - startY) / currentViewScale) + 'px'; };",
                    "            const onMouseUp = () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); if (!positions[id]) positions[id] = {}; positions[id].left = el.style.left; positions[id].top = el.style.top; };",
                    "            document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);",
                    "        };",
                    "        el.addEventListener('wheel', (e) => {",
                    "            if (e.ctrlKey || e.metaKey || id === 'pl-map') return;",
                    "            e.stopPropagation();",
                    "            e.preventDefault(); let scale = parseFloat(el.getAttribute('data-scale')) || 1; scale += e.deltaY * -0.001; scale = Math.min(Math.max(0.3, scale), 5);",
                    "            el.style.transform = 'scale(' + scale + ')'; el.setAttribute('data-scale', scale);",
                    "            if (!positions[id]) positions[id] = {}; positions[id].scale = scale;",
                    "        }, {passive: false});",
                    "    }",
                    "    function setupMapCropper() {",
                    "        const cropper = document.getElementById('map-cropper');",
                    "        if(!cropper) return;",
                    "        const inner = document.getElementById('bg-map-inner');",
                    "        let isResizing = false, startX, startY, initL, initT, initW, initH, dir;",
                    "        const onMouseMove = (e) => {",
                    "            if (!isResizing) return;",
                    "            const dx = (e.clientX - startX) / currentViewScale;",
                    "            const dy = (e.clientY - startY) / currentViewScale;",
                    "            let l = initL, t = initT, w = initW, h = initH;",
                    "            if (dir.includes('n')) { t += dy; h -= dy; }",
                    "            if (dir.includes('s')) { h += dy; }",
                    "            if (dir.includes('w')) { l += dx; w -= dx; }",
                    "            if (dir.includes('e')) { w += dx; }",
                    "            cropper.style.left = l + 'px'; cropper.style.top = t + 'px'; cropper.style.width = w + 'px'; cropper.style.height = h + 'px';",
                    "            inner.style.left = (-l - 2000) + 'px'; inner.style.top = (-t - 2000) + 'px';",
                    "        };",
                    "        const onMouseUp = () => {",
                    "            isResizing = false; cropper.classList.remove('active');",
                    "            document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp);",
                    "            if (!positions['map-cropper']) positions['map-cropper'] = {};",
                    "            positions['map-cropper'] = { l: parseFloat(cropper.style.left), t: parseFloat(cropper.style.top), w: parseFloat(cropper.style.width), h: parseFloat(cropper.style.height) };",
                    "            if (window.bgMapInstance) window.bgMapInstance.invalidateSize();",
                    "        };",
                    "        cropper.onmousedown = (e) => {",
                    "            if(e.target.classList.contains('resize-handle')) {",
                    "                isResizing = true; dir = e.target.getAttribute('data-dir');",
                    "                e.stopPropagation(); e.preventDefault(); startX = e.clientX; startY = e.clientY;",
                    "                initL = parseFloat(cropper.style.left); initT = parseFloat(cropper.style.top); initW = parseFloat(cropper.style.width); initH = parseFloat(cropper.style.height);",
                    "                cropper.classList.add('active');",
                    "                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', onMouseUp);",
                    "            }",
                    "        };",
                    "    }",
                    "    let activeSVGElem = null, ctmInverse = null, startTransformX = 0, startTransformY = 0, initialTransform = '';",
                    "    document.addEventListener('mousedown', (e) => {",
                    "        const draggableGroup = e.target.closest('.svg-draggable');",
                    "        if (draggableGroup) {",
                    "            e.stopPropagation(); e.preventDefault(); activeSVGElem = draggableGroup; const svg = activeSVGElem.closest('svg'); ctmInverse = svg.getScreenCTM().inverse();",
                    "            let p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(ctmInverse);",
                    "            activeSVGElem.setAttribute('data-start-mx', p.x); activeSVGElem.setAttribute('data-start-my', p.y);",
                    "            const transform = activeSVGElem.getAttribute('transform') || '';",
                    "            startTransformX = 0; startTransformY = 0;",
                    "            initialTransform = transform.replace(/translate\\([^)]+\\)/, '').trim();",
                    "            const match = transform.match(/translate\\(([-\\d.]+)[,\\s]+([-\\d.]+)\\)/);",
                    "            if (match) { startTransformX = parseFloat(match[1]); startTransformY = parseFloat(match[2]); }",
                    "        }",
                    "    });",
                    "    document.addEventListener('mousemove', (e) => {",
                    "        if (activeSVGElem) {",
                    "            const svg = activeSVGElem.closest('svg'); let p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; p = p.matrixTransform(ctmInverse);",
                    "            const dx = (p.x - parseFloat(activeSVGElem.getAttribute('data-start-mx')));",
                    "            const dy = (p.y - parseFloat(activeSVGElem.getAttribute('data-start-my')));",
                    "            activeSVGElem.setAttribute('transform', 'translate(' + (startTransformX + dx) + ',' + (startTransformY + dy) + ') ' + initialTransform);",
                    "        }",
                    "    });",
                    "    document.addEventListener('mouseup', () => { activeSVGElem = null; });",
                    "    function exportHtmlFile() {",
                    "        const filename = els.filename.value || 'GNSStoGIS_Export';",
                    "        const paperSize = els.paperSize.value;",
                    "        const paperOrient = els.paperOrient.value;",
                    "        const cloneCanvas = els.canvasWrap.cloneNode(true);",
                    "        cloneCanvas.querySelectorAll('.print-draggable').forEach(el => el.classList.remove('print-hover-outline'));",
                    "        const sStart = '<scr' + 'ipt>'; const sEnd = '</scr' + 'ipt>';",
                    "        const htmlStr = [",
                    "            '<!DOCTYPE html>', '<html lang=\"ja\">', '<head>', '<meta charset=\"UTF-8\">', '<title>' + filename + '</title>',",
                    "            '<link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" />',",
                    "            '<script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\"></scr' + 'ipt>',",
                    "            '<style>',",
                    "            '  body { margin: 0; padding: 0; font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; background: #525659; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh; }',",
                    "            '  .print-canvas-container { position: relative; width: ' + els.canvasWrap.style.width + '; height: ' + els.canvasWrap.style.height + '; background: #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.5); overflow: hidden; margin-top: 40px; margin-bottom: 40px; flex-shrink: 0; transform: none !important; }',",
                    "            '  .print-draggable { position: absolute; transform-origin: top left; }',",
                    "            '  .pl-table-title { background: #f0f0f0; padding: 3px 5px; font-weight: bold; font-size: 12px; border-bottom: 2px solid #333; text-align: center; color:#000; }',",
                    "            '  .pl-table { border-collapse: collapse; font-size: 12px; border-style: hidden; width: 100%; margin: 0; color:#000; }',",
                    "            '  .pl-table th, .pl-table td { border: 1px solid #333; padding: 2px 4px; white-space: nowrap; color:#000; text-align: center; font-weight: normal; }',",
                    "            '  .pl-table th { background: transparent; }',",
                    "            '  .pl-attr-table { width: 100%; margin: 0; border: none; border-collapse: collapse; font-size: 12px; color:#000; }',",
                    "            '  .pl-attr-table th, .pl-attr-table td { border: 1px solid #333; padding: 4px 6px; white-space: nowrap; color:#000; text-align: left; font-weight: normal; }',",
                    "            '  .pl-box { background: #fff; border: 2px solid #333; }',",
                    "            '  .svg-draggable { cursor: default; }',",
                    "            '  .instruction-bar { position: fixed; top: 0; left: 0; right: 0; background: rgba(40,40,40,0.95); color: white; padding: 10px; font-size: 14px; z-index: 1000; text-align: center; box-shadow: 0 2px 5px rgba(0,0,0,0.3); }',",
                    "            '  @media print {',",
                    "            '     @page { size: ' + paperSize + ' ' + paperOrient + '; margin: 0; }',",
                    "            '     body { background: #fff; display: block; min-height: auto; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }',",
                    "            '     .print-canvas-container { box-shadow: none; margin: 0 !important; page-break-after: avoid; page-break-inside: avoid; transform: none !important; }',",
                    "            '     .instruction-bar { display: none !important; }',",
                    "            '  }',",
                    "            '</style>',",
                    "            '</head>', '<body>',",
                    "            '  <div class=\"instruction-bar\">💡 Ctrl+P（MacはCmd+P）でこの画面のまま印刷・PDF保存できます。</div>',",
                    "            '  <div class=\"print-canvas-container\">',",
                    "            cloneCanvas.innerHTML,",
                    "            '  </div>',",
                    "            '</body>', '</html>'",
                    "        ].join('\\n');",
                    "        const blob = new Blob([htmlStr], { type: 'text/html' });",
                    "        const url = URL.createObjectURL(blob);",
                    "        const a = document.createElement('a'); a.href = url; a.download = filename + '.html';",
                    "        a.click(); URL.revokeObjectURL(url);",
                    "    }",
                    "    let currentViewScale = 1;",
                    "    function updateZoom() {",
                    "        els.canvasWrap.style.transform = 'scale(' + currentViewScale + ')';",
                    "        document.getElementById('zoomLevel').textContent = Math.round(currentViewScale * 100) + '%';",
                    "        const diffHeight = els.canvasWrap.offsetHeight * (1 - currentViewScale);",
                    "        els.canvasWrap.style.marginBottom = (40 - diffHeight) + 'px';",
                    "    }",
                    "    document.getElementById('btnZoomIn').addEventListener('click', () => { currentViewScale = Math.min(currentViewScale + 0.1, 3.0); updateZoom(); });",
                    "    document.getElementById('btnZoomOut').addEventListener('click', () => { currentViewScale = Math.max(currentViewScale - 0.1, 0.2); updateZoom(); });",
                    "    document.getElementById('btnFitView').addEventListener('click', () => {",
                    "        const workspace = document.getElementById('workspace');",
                    "        const availableW = workspace.clientWidth - 80; const availableH = workspace.clientHeight - 80;",
                    "        const scaleW = availableW / els.canvasWrap.offsetWidth; const scaleH = availableH / els.canvasWrap.offsetHeight;",
                    "        currentViewScale = Math.max(0.1, Math.min(scaleW, scaleH, 3.0)); updateZoom();",
                    "    });",
                    "    els.workspace.addEventListener('wheel', (e) => {",
                    "        if (e.ctrlKey || e.metaKey) return;",
                    "        e.preventDefault();",
                    "        currentViewScale += e.deltaY * -0.001;",
                    "        currentViewScale = Math.max(0.1, Math.min(currentViewScale, 3.0));",
                    "        updateZoom();",
                    "    }, {passive: false});",
                    "    els.btnAutoScale.addEventListener('click', () => { calcAutoScale(); renderCanvas(); document.getElementById('btnFitView').click(); });",
                    "    els.paperSize.addEventListener('change', () => { renderCanvas(); document.getElementById('btnFitView').click(); });",
                    "    els.paperOrient.addEventListener('change', () => { renderCanvas(); document.getElementById('btnFitView').click(); });",
                    "    els.scale.addEventListener('change', () => { renderCanvas(); document.getElementById('btnFitView').click(); });",
                    "    els.tableWrap.addEventListener('change', renderCanvas);",
                    "    els.btnPrint.addEventListener('click', () => window.print());",
                    "    els.btnExport.addEventListener('click', exportHtmlFile);",
                    "    calcAutoScale(); renderCanvas();",
                    "    setTimeout(() => document.getElementById('btnFitView').click(), 100);",
                    "    window.addEventListener('resize', () => { document.getElementById('btnFitView').click(); });",
                    "\n" +
                    "    const JGD2011_ZONES = [",
                    "        null,",
                    "        '+proj=tmerc +lat_0=33 +lon_0=129.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=33 +lon_0=131 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=132.1666666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=33 +lon_0=133.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=134.3333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=137.1666666666667 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=138.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=36 +lon_0=139.8333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=40 +lon_0=140.8333333333333 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=44 +lon_0=140.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=44 +lon_0=142.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=44 +lon_0=144.25 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=26 +lon_0=142 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=26 +lon_0=127.5 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=26 +lon_0=124 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=26 +lon_0=131 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=20 +lon_0=136 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs',",
                    "        '+proj=tmerc +lat_0=26 +lon_0=154 +k=0.9999 +x_0=0 +y_0=0 +ellps=GRS80 +units=m +no_defs'",
                    "    ];",
                    "    class SimpleDxfWriter {",
                    "        constructor() {",
                    "            this.header = ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$DWGCODEPAGE', '3', 'ANSI_932', '0', 'ENDSEC'];",
                    "            this.blocks = ['0', 'SECTION', '2', 'BLOCKS'];",
                    "            this.entities = ['0', 'SECTION', '2', 'ENTITIES'];",
                    "            this.currentSection = this.entities;",
                    "            this.blockCounter = 1;",
                    "            this.inBlock = false;",
                    "        }",
                    "        startGroup() {",
                    "            const blockName = 'GROUP_' + this.blockCounter++;",
                    "            this.blocks.push('0', 'BLOCK', '8', '0', '2', blockName, '70', '0', '10', '0.0', '20', '0.0', '30', '0.0', '3', blockName);",
                    "            this.currentSection = this.blocks;",
                    "            this.currentBlockName = blockName;",
                    "            this.inBlock = true;",
                    "        }",
                    "        endGroup() {",
                    "            if (!this.inBlock) return;",
                    "            this.blocks.push('0', 'ENDBLK', '8', '0');",
                    "            this.entities.push('0', 'INSERT', '8', '0', '2', this.currentBlockName, '10', '0.0', '20', '0.0', '30', '0.0');",
                    "            this.currentSection = this.entities;",
                    "            this.inBlock = false;",
                    "        }",
                    "        addLine(x1, y1, x2, y2, color=256) {",
                    "            this.currentSection.push('0', 'LINE', '8', '0', '62', color, '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0.0', '11', x2.toFixed(4), '21', y2.toFixed(4), '31', '0.0');",
                    "        }",
                    "        addPolyline(pts, closed, color=256) {",
                    "            if (pts.length < 2) return;",
                    "            for (let i=0; i<pts.length - 1; i++) {",
                    "                this.addLine(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, color);",
                    "            }",
                    "            if (closed && pts.length > 2) {",
                    "                this.addLine(pts[pts.length-1].x, pts[pts.length-1].y, pts[0].x, pts[0].y, color);",
                    "            }",
                    "        }",
                    "        addSolid(x1, y1, x2, y2, x3, y3, x4, y4, color=255) {",
                    "            this.currentSection.push('0', 'SOLID', '8', '0', '62', color,",
                    "                '10', x1.toFixed(4), '20', y1.toFixed(4), '30', '0.0',",
                    "                '11', x2.toFixed(4), '21', y2.toFixed(4), '31', '0.0',",
                    "                '12', x3.toFixed(4), '22', y3.toFixed(4), '32', '0.0',",
                    "                '13', x4.toFixed(4), '23', y4.toFixed(4), '33', '0.0');",
                    "        }",
                    "        addCircle(x, y, radius, color=256) {",
                    "            this.currentSection.push('0', 'CIRCLE', '8', '0', '62', color, '10', x.toFixed(4), '20', y.toFixed(4), '30', '0.0', '40', radius.toFixed(4));",
                    "        }",
                    "        addText(text, x, y, height, color=256, align='L', angle=0) {",
                    "            const safeText = String(text).replace(/[\\n\\r]/g, ' ');",
                    "            this.currentSection.push('0', 'TEXT', '8', '0', '62', color, '10', x.toFixed(4), '20', y.toFixed(4), '30', '0.0', '40', height.toFixed(4), '50', angle.toFixed(4), '1', safeText);",
                    "            if (align === 'C') {",
                    "                this.currentSection.push('72', '1', '11', x.toFixed(4), '21', y.toFixed(4), '31', '0.0');",
                    "            } else if (align === 'R') {",
                    "                this.currentSection.push('72', '2', '11', x.toFixed(4), '21', y.toFixed(4), '31', '0.0');",
                    "            }",
                    "        }",
                    "        addCircle(x, y, radius, color=256) {",
                    "            this.currentSection.push('0', 'CIRCLE', '8', '0', '62', color, '10', x.toFixed(4), '20', y.toFixed(4), '30', '0.0', '40', radius.toFixed(4));",
                    "        }",
                    "        toString() {",
                    "            this.blocks.push('0', 'ENDSEC');",
                    "            this.entities.push('0', 'ENDSEC');",
                    "            return [...this.header, ...this.blocks, ...this.entities, '0', 'EOF'].join('\\r\\n');",
                    "        }",
                    "    }",
                    "    document.getElementById('btnExportDxf').addEventListener('click', () => {",
                    "        const zoneIndex = parseInt(document.getElementById('dxfZone').value);",
                    "        const dxf = new SimpleDxfWriter();",
                    "        let p0 = {lat: 35, lng: 139};",
                    "        if (APP_DATA.points && APP_DATA.points.length > 0) p0 = APP_DATA.points[0];",
                    "        else if (APP_DATA.customLines && APP_DATA.customLines.length > 0) p0 = {lat: APP_DATA.customLines[0].latlngs[0][0], lng: APP_DATA.customLines[0].latlngs[0][1]};",
                    "        else if (APP_DATA.areas && APP_DATA.areas.length > 0) p0 = {lat: APP_DATA.areas[0].coords[0][0], lng: APP_DATA.areas[0].coords[0][1]};",
                    "        const LAT_DEG_PER_METER = 1 / 111111;",
                    "        const lonDegPerMeter = LAT_DEG_PER_METER / Math.cos(p0.lat * Math.PI / 180);",
                    "        const llToDxf = (lat, lng) => {",
                    "            let px, py;",
                    "            if (zoneIndex >= 1 && zoneIndex <= 19) {",
                    "                const projDef = JGD2011_ZONES[zoneIndex];",
                    "                const coords = proj4(projDef, [lng, lat]);",
                    "                px = coords[0]; py = coords[1];",
                    "            } else {",
                    "                px = (lng - p0.lng) / lonDegPerMeter;",
                    "                py = (lat - p0.lat) / LAT_DEG_PER_METER;",
                    "            }",
                    "            return { x: px, y: py };",
                    "        };",
                    "        const targetScale = parseFloat(document.getElementById('scale').value || 1000);",
                    "        const textScaleFactor = (targetScale / 1000) * 1.5;",
                    "        if (APP_DATA.areas) { APP_DATA.areas.forEach((area, i) => {",
                    "            const pts = area.coords.map(c => llToDxf(c[0], c[1]));",
                    "            dxf.addPolyline(pts, true, 3);",
                    "            if(area.center) {",
                    "                const ac = llToDxf(area.center.lat, area.center.lng);",
                    "                const t1 = '区画 ' + (i+1);",
                    "                const t2 = (Math.round(((area.netArea / 10000) + Number.EPSILON) * 10000) / 10000).toFixed(4) + ' ha';",
                    "                const th = 2.5 * textScaleFactor;",
                    "                const bw = Math.max(t1.length, t2.length) * th * 1.2;",
                    "                dxf.addSolid(ac.x - bw/2, ac.y - th*1.5, ac.x + bw/2, ac.y - th*1.5, ac.x - bw/2, ac.y + th*2.5, ac.x + bw/2, ac.y + th*2.5, 255);",
                    "                dxf.addPolyline([{x:ac.x - bw/2, y:ac.y - th*1.5}, {x:ac.x + bw/2, y:ac.y - th*1.5}, {x:ac.x + bw/2, y:ac.y + th*2.5}, {x:ac.x - bw/2, y:ac.y + th*2.5}], true, 7);",
                    "                dxf.addText(t1, ac.x, ac.y + th*1.0, th, 3, 'C');",
                    "                dxf.addText(t2, ac.x, ac.y - th*0.5, th, 3, 'C');",
                    "            }",
                    "            if (area.holes) { area.holes.forEach((hole, j) => {",
                    "                const hpts = hole.coords.map(c => llToDxf(c[0], c[1]));",
                    "                dxf.addPolyline(hpts, true, 3);",
                    "            }); }",
                    "        }); }",
                    "        if (APP_DATA.edges) { APP_DATA.edges.forEach(edge => {",
                    "            const p1 = APP_DATA.points.find(p => p.id === edge.from);",
                    "            const p2 = APP_DATA.points.find(p => p.id === edge.to);",
                    "            if (p1 && p2) {",
                    "                const dp1 = llToDxf(p1.lat, p1.lng);",
                    "                const dp2 = llToDxf(p2.lat, p2.lng);",
                    "                dxf.addLine(dp1.x, dp1.y, dp2.x, dp2.y, 7);",
                    "            }",
                    "        }); }",
                    "        if (APP_DATA.customLines) { APP_DATA.customLines.forEach(line => {",
                    "            const pts = line.latlngs.map(c => llToDxf(c[0] !== undefined ? c[0] : c.lat, c[1] !== undefined ? c[1] : c.lng));",
                    "            dxf.addPolyline(pts, false, 7);",
                    "        }); }",
                    "        const radius_m = 1.0 * textScaleFactor;",
                    "        if (APP_DATA.points) { APP_DATA.points.forEach(p => {",
                    "            const dp = llToDxf(p.lat, p.lng);",
                    "            dxf.addCircle(dp.x, dp.y, radius_m, 1);",
                    "            const th = 2.5 * textScaleFactor;",
                    "            const text_x_m = dp.x + radius_m * 1.5;",
                    "            const text_y_m = dp.y + radius_m * 1.5;",
                    "            const bw = String(p.name).length * th * 0.9;",
                    "            dxf.addSolid(text_x_m, text_y_m - th*0.2, text_x_m + bw, text_y_m - th*0.2, text_x_m, text_y_m + th*1.2, text_x_m + bw, text_y_m + th*1.2, 255);",
                    "            dxf.addText(p.name, text_x_m, text_y_m, th, 7);",
                    "        }); }",
                    "        if (APP_DATA.customTexts) { APP_DATA.customTexts.forEach(t => {",
                    "            const dp = llToDxf(t.lat, t.lng);",
                    "            const angle = parseFloat(t.rotation) || 0;",
                    "            const th = (parseInt(t.fontSize) || 16) * textScaleFactor * 0.15;",
                    "            dxf.addText(t.text, dp.x, dp.y, th, 7, 'L', angle);",
                    "        }); }",
                    "        const dxfStr = dxf.toString();",
                    "        const sjisArray = Encoding.convert(Encoding.stringToCode(dxfStr), { to: 'SJIS', from: 'UNICODE', type: 'array' });",
                    "        const blob = new Blob([new Uint8Array(sjisArray)], { type: 'application/dxf' });",
                    "        const url = URL.createObjectURL(blob);",
                    "        const a = document.createElement('a'); a.href = url;",
                    "        const fname = document.getElementById('filename') ? document.getElementById('filename').value : 'export';",
                    "        a.download = fname + '.dxf';",
                    "        a.click(); URL.revokeObjectURL(url);",
                    "    });",
                    "    ",
                    sEnd
                ].join('\n');


                win.document.write(htmlStr);
                win.document.close();
            }

}
