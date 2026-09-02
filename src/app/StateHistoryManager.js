import { APP_CONFIG } from '../config/constants.js';

export class StateHistoryManager {
    constructor(app) {
        this.app = app;
    }

            saveState() {
                const data = {
                    points: this.app.state.points,
                    edges: this.app.state.edges.map(e => ({ from: e.from, to: e.to })),
                    attributes: this.app.state.attributes,
                    customTexts: this.app.state.customTexts,
                    customLines: this.app.state.customLines,
                    pointIdCounter: this.app.pointIdCounter
                };
                localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(data));
                
                if (!this.app.isUndoRedoing) {
                    this.app.pushToHistory(data);
                }
            }

            pushToHistory(data) {
                const snapshotStr = JSON.stringify(data);
                if (this.app.historyIndex >= 0 && snapshotStr === JSON.stringify(this.app.history[this.app.historyIndex])) return;
                
                if (this.app.historyIndex < this.app.history.length - 1) {
                    this.app.history = this.app.history.slice(0, this.app.historyIndex + 1);
                }
                
                if (this.app.history.length >= 50) this.app.history.shift();
                else this.app.historyIndex++;
                
                this.app.history.push(JSON.parse(snapshotStr));
                this.app.updateUndoRedoButtons();
            }

            undo() {
                if (this.app.historyIndex > 0) {
                    this.app.historyIndex--;
                    this.app.restoreSnapshot(this.app.history[this.app.historyIndex]);
                    this.app.showToast('元に戻しました。');
                }
            }

            redo() {
                if (this.app.historyIndex < this.app.history.length - 1) {
                    this.app.historyIndex++;
                    this.app.restoreSnapshot(this.app.history[this.app.historyIndex]);
                    this.app.showToast('やり直しました。');
                }
            }

            restoreSnapshot(snapshot) {
                this.app.isUndoRedoing = true;
                this.app.state.points = JSON.parse(JSON.stringify(snapshot.points));
                this.app.state.edges = JSON.parse(JSON.stringify(snapshot.edges));
                this.app.state.attributes = JSON.parse(JSON.stringify(snapshot.attributes));
                this.app.state.customTexts = JSON.parse(JSON.stringify(snapshot.customTexts || []));
                this.app.state.customLines = JSON.parse(JSON.stringify(snapshot.customLines || []));
                this.app.pointIdCounter = snapshot.pointIdCounter;
                
                this.app.clearSelection();
                if (this.app.layers.rubberBand) { 
                    this.app.layers.rubberBand.remove(); 
                    this.app.layers.rubberBand = null; 
                    if (this.app.layers.rubberBandBg) {
                        this.app.layers.rubberBandBg.remove();
                        this.app.layers.rubberBandBg = null;
                    }
                }

                this.app.updateAll();
                
                this.app.isUndoRedoing = false;
                this.app.updateUndoRedoButtons();
            }

            updateUndoRedoButtons() {
                if (this.app.els.btnUndo) this.app.els.btnUndo.disabled = this.app.historyIndex <= 0;
                if (this.app.els.btnRedo) this.app.els.btnRedo.disabled = this.app.historyIndex >= this.app.history.length - 1;
            }

            loadState() {
                const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        this.app.state.points = data.points || [];
                        this.app.state.edges = data.edges || [];
                        this.app.state.attributes = data.attributes || JSON.parse(JSON.stringify(APP_CONFIG.DEFAULT_ATTRIBUTES));
                        this.app.state.customTexts = data.customTexts || [];
                        this.app.state.customLines = data.customLines || [];
                        this.app.pointIdCounter = data.pointIdCounter || 1;
                        this.app.updateAll();
                        setTimeout(() => this.app.fitBoundsToPoints(true), 250);
                        this.app.showToast('前回のデータを復元しました。');
                    } catch (e) {
                        console.error('データの復元に失敗しました', e);
                        this.app.addDemoData();
                    }
                } else {
                    this.app.addDemoData();
                }
            }

}
