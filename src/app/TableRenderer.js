import { GeoUtils } from '../utils/GeoUtils.js';
export class TableRenderer {
    constructor(app) {
        this.app = app;
    }

            renderAttrTable() {
                this.app.els.attrTableBody.innerHTML = '';
                this.app.state.attributes.forEach((attr, index) => {
                    const tr = document.createElement('tr');
                    
                    const createInputTd = (val, placeholder, onChange) => {
                        const td = document.createElement('td');
                        const inp = document.createElement('input');
                        inp.type = 'text'; inp.value = val; inp.placeholder = placeholder;
                        inp.addEventListener('input', onChange);
                        td.appendChild(inp);
                        return td;
                    };
                    
                    tr.appendChild(createInputTd(attr.name, '項目名', e => this.app.state.attributes[index].name = e.target.value));
                    tr.appendChild(createInputTd(attr.value, '値', e => this.app.state.attributes[index].value = e.target.value));
                    
                    const tdAction = document.createElement('td');
                    tdAction.appendChild(this.app._createIconButton('＋', '下に行を挿入', 'primary', () => {
                        this.app.state.attributes.splice(index + 1, 0, { name: '', value: '' });
                        this.app.renderAttrTable();
                    }));
                    tdAction.appendChild(this.app._createIconButton('－', 'この行を削除', 'danger', () => {
                        this.app.state.attributes.splice(index, 1);
                        this.app.renderAttrTable();
                    }));
                    
                    tr.appendChild(tdAction);
                    this.app.els.attrTableBody.appendChild(tr);
                });
            }

            renderTable() {
                this.app.els.tableBody.innerHTML = '';
                this.app.state.points.forEach((p, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="text" value="${p.name}" data-field="name"></td>
                        <td><input type="number" step="any" value="${p.lat.toFixed(6)}" data-field="lat"></td>
                        <td><input type="number" step="any" value="${p.lng.toFixed(6)}" data-field="lng"></td>
                        <td></td>
                    `;
                    
                    const tdAction = tr.querySelector('td:last-child');
                    tdAction.appendChild(this.app._createIconButton('＋', '下にポイントを複製して挿入', 'primary', () => {
                        const newPoint = { id: 'p' + this.app.pointIdCounter++, name: `${this.app.pointIdCounter - 1}`, lat: p.lat, lng: p.lng };
                        this.app.state.points.splice(index + 1, 0, newPoint);
                        this.app.updateAll();
                    }));
                    tdAction.appendChild(this.app._createIconButton('－', 'このポイントを削除', 'danger', () => {
                        this.app.deletePoint(p.id);
                    }));
                    
                    tr.querySelectorAll('input').forEach(inp => {
                        inp.addEventListener('change', (e) => {
                            const field = e.target.dataset.field;
                            p[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || p[field];
                            this.app.updateAll();
                        });
                    });

                    tr.addEventListener('click', (e) => {
                        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') this.app.map.panTo([p.lat, p.lng]);
                    });

                    this.app.els.tableBody.appendChild(tr);
                });
            }

            renderAreaResults() {
                if (this.app.state.areas.length === 0) {
                    this.app.els.areaResults.style.display = 'none';
                    return;
                }
                
                this.app.els.areaResults.style.display = 'block';
                let html = `
                    <div class="flex-row gap-2" style="margin-bottom: 2px;">
                        <div style="font-weight: bold; font-size: 0.75rem; color: #0f766e;">📐 区画ごとの面積</div>
                        <button id="btnCopyArea" class="btn-navy btn-xs" title="面積結果をクリップボードにコピー" style="height: 20px; font-size: 0.65rem; padding: 0 6px;">📋 コピー</button>
                    </div>
                `;
                let total = 0;
                
                this.app.state.areas.forEach((a, i) => {
                    const ha = GeoUtils.m2ToHa(a.netArea);
                    total += ha;
                    let holeTxt = '';
                    if (a.holes.length > 0) {
                        const holeDetails = a.holes.map((h, j) => `除地${j + 1}: ${GeoUtils.m2ToHa(h.area).toFixed(4)}ha`).join(', ');
                        holeTxt = `<span style="font-size:0.65rem; color:#ef4444; margin-left: 6px; font-weight: normal;">(内 ${holeDetails})</span>`;
                    }
                    html += `
                        <div class="area-item" style="align-items: center;">
                            <span style="white-space: nowrap;">区画 ${i+1}</span>
                            <div style="text-align: right;"><strong>${ha.toFixed(4)} ha</strong>${holeTxt}</div>
                        </div>`;
                });
                
                if (this.app.state.areas.length > 1) {
                    html += `<div class="area-item" style="background:#e0f2fe; border-color:#bae6fd; color:#0369a1; margin-top:2px; align-items: center;"><span>合計</span><strong>${total.toFixed(4)} ha</strong></div>`;
                }
                this.app.els.areaResults.innerHTML = html;

                document.getElementById('btnCopyArea').addEventListener('click', () => this.app.copyAreaToClipboard());
            }

            copyAreaToClipboard() {
                if (this.app.state.areas.length === 0) return this.app.showToast('コピーするデータがありません。');
                
                let text = "区画名\t面積(ha)\n";
                let total = 0;
                this.app.state.areas.forEach((a, i) => {
                    const ha = GeoUtils.m2ToHa(a.netArea);
                    total += ha;
                    text += `区画 ${i+1}\t${ha.toFixed(4)}\n`;
                    a.holes.forEach((h, j) => {
                        text += `(内 除地${j+1})\t${GeoUtils.m2ToHa(h.area).toFixed(4)}\n`;
                    });
                });
                if (this.app.state.areas.length > 1) {
                    text += `合計\t${total.toFixed(4)}\n`;
                }

                this.app._copyTextToClipboard(text, '面積結果をクリップボードにコピーしました。');
            }

}
