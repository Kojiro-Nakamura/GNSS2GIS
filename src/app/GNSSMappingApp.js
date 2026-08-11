import L from 'leaflet';
import { APP_CONFIG } from '../config/constants.js';
import { GeoUtils } from '../utils/GeoUtils.js';
import { PolygonDetector } from '../utils/PolygonDetector.js';

export class GNSSMappingApp {
            constructor() {
                // 前回設定値をロード
                this.defaultLineWeight = parseInt(localStorage.getItem('defaultLineWeight')) || 2;
                this.defaultLineColor = localStorage.getItem('defaultLineColor') || '#333333';
                this.defaultLineStyle = localStorage.getItem('defaultLineStyle') || '';
                this.defaultTextFontSize = parseInt(localStorage.getItem('defaultTextFontSize')) || 16;
                this.defaultTextColor = localStorage.getItem('defaultTextColor') || '#000000';

                this.state = {
                    points: [],
                    edges: [],
                    areas: [],
                    customLines: [],
                    customTexts: [],
                    mode: APP_CONFIG.MODES.LINE, // デフォルトモード
                    selectedPointId: null,
                    selectedItem: null, 
                    attributes: JSON.parse(JSON.stringify(APP_CONFIG.DEFAULT_ATTRIBUTES)),
                    isMapView: true,
                    activeTileLayer: null,
                    labelDisplay: 'all'
                };
                this.pointIdCounter = 1;
                this.map = null;
                this.layers = { 
                    polygons: L.featureGroup(), 
                    edges: L.featureGroup(), 
                    points: L.featureGroup(), 
                    customLines: L.featureGroup(),
                    customTexts: L.featureGroup(),
                    rubberBandBg: null,
                    rubberBand: null,
                    tempDrawLineBg: null,
                    tempDrawLine: null
                };
                this.pendingLoadData = null;
                this.loadedFilesData = [];

                this.history = [];
                this.historyIndex = -1;
                this.isUndoRedoing = false;

                // 各種ドラッグ・回転用
                this.isDraggingCustomLine = false;
                this.dragLineId = null;
                this.dragLineStartLatLng = null;
                this.dragLineOriginalLatLngs = null;

                this.isRotating = false;
                this.rotatingType = null;
                this.rotatingItem = null;
                this.rotatingStartAngle = 0;
                this.rotatingLineOriginalLatLngs = null;
                this.rotatingCenter = null;
                this.rotatingCenterPx = null;

                this.hoveredPoint = null; // 吸着対象ポイント
                this.hoverHighlightMarker = null;

                // 右クリックでの画面ドラッグ用
                this.isRightDragging = false;
                this.rightDragMoved = false;
                this.rightDragStart = null;

                this.initDOM();
                this.initMap();
                this.initEvents();
                this.loadState(); 
            }

            initDOM() {
                const get = id => document.getElementById(id);
                this.els = {
                    btnSaveJson: get('btnSaveJson'),
                    btnLoadJson: get('btnLoadJson'), btnSurvey: get('btnSurvey'),
                    btnUndo: get('btnUndo'), btnRedo: get('btnRedo'),
                    btnFitBounds: get('btnFitBounds'), btnViewToggle: get('btnViewToggle'),
                    fileInputJson: get('fileInputJson'),
                    modeSelect: get('modeSelect'), modeAdd: get('modeAdd'), modeLine: get('modeLine'),
                    modeDrawLine: get('modeDrawLine'), modeAddText: get('modeAddText'),
                    btnPasteSurvey: get('btnPasteSurvey'), btnClear: get('btnClear'), btnDemoData: get('btnDemoData'), btnLocation: get('btnLocation'),
                    btnExport: get('btnExport'), btnExportHtml: get('btnExportHtml'), labelDisplaySelect: get('labelDisplaySelect'),
                    tableBody: get('tableBody'), areaResults: get('areaResults'), attrTableBody: get('attrTableBody'),
                    btnPasteAttr: get('btnPasteAttr'), btnCopyAttr: get('btnCopyAttr'),
                    attrPasteModal: get('attrPasteModal'), attrPasteArea: get('attrPasteArea'),
                    btnCancelAttrPaste: get('btnCancelAttrPaste'), btnApplyAttrPaste: get('btnApplyAttrPaste'),
                    surveyPasteModal: get('surveyPasteModal'), surveyPasteArea: get('surveyPasteArea'),
                    chkPastePolygon: get('chkPastePolygon'),
                    btnCancelSurveyPaste: get('btnCancelSurveyPaste'), btnApplySurveyPaste: get('btnApplySurveyPaste'),
                    btnCopySurvey: get('btnCopySurvey'),
                    loadPreviewModal: get('loadPreviewModal'), previewMapContainer: get('previewMapContainer'),
                    previewInfo: get('previewInfo'), previewFileList: get('previewFileList'), btnCancelLoad: get('btnCancelLoad'), btnApplyLoad: get('btnApplyLoad'),
                    exportJsonModal: get('exportJsonModal'), btnCancelExportJson: get('btnCancelExportJson'), btnApplyExportJson: get('btnApplyExportJson'),
                    exportGeoJsonModal: get('exportGeoJsonModal'), btnCancelExportGeoJson: get('btnCancelExportGeoJson'), btnApplyExportGeoJson: get('btnApplyExportGeoJson'),
                    addTextModal: get('addTextModal'), addTextArea: get('addTextArea'),
                    btnCancelAddText: get('btnCancelAddText'), btnApplyAddText: get('btnApplyAddText'),
                    editPanel: get('editPanel'), btnDeleteSelected: get('btnDeleteSelected'),
                    editPropText: get('editPropText'), editTextInput: get('editTextInput'),
                    editFontSize: get('editFontSize'), editFontSizeVal: get('editFontSizeVal'),
                    editTextColor: get('editTextColor'), editTextRotation: get('editTextRotation'), editTextRotationVal: get('editTextRotationVal'),
                    editPropLine: get('editPropLine'), editLineWeight: get('editLineWeight'), editLineWeightVal: get('editLineWeightVal'),
                    editLineColor: get('editLineColor'), editLineStyle: get('editLineStyle'), editLineRotation: get('editLineRotation'), editLineRotationVal: get('editLineRotationVal'),
                    modeInstructions: get('modeInstructions')
                };
            }

            initMap() {
                const customRenderer = L.canvas({ tolerance: 15 });
                
                let initialCenter = APP_CONFIG.MAP.DEFAULT_CENTER;
                const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        if (data.points && data.points.length > 0) {
                            let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                            data.points.forEach(p => {
                                if (p.lat < minLat) minLat = p.lat;
                                if (p.lat > maxLat) maxLat = p.lat;
                                if (p.lng < minLng) minLng = p.lng;
                                if (p.lng > maxLng) maxLng = p.lng;
                            });
                            initialCenter = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
                        }
                    } catch (e) {}
                }

                this.map = L.map('mapContainer', { doubleClickZoom: false, maxZoom: 24, renderer: customRenderer })
                            .setView(initialCenter, APP_CONFIG.MAP.DEFAULT_ZOOM);
                
                const layers = {
                    "標準地図": L.tileLayer(APP_CONFIG.MAP.TILE_STD, { attribution: APP_CONFIG.MAP.ATTRIBUTION, maxNativeZoom: 18, maxZoom: 24 }),
                    "写真（オルソ）": L.tileLayer(APP_CONFIG.MAP.TILE_PHOTO, { attribution: APP_CONFIG.MAP.ATTRIBUTION, maxNativeZoom: 18, maxZoom: 24 }),
                    "淡色地図": L.tileLayer(APP_CONFIG.MAP.TILE_PALE, { attribution: APP_CONFIG.MAP.ATTRIBUTION, maxNativeZoom: 18, maxZoom: 24 })
                };
                
                layers["標準地図"].addTo(this.map);
                this.state.activeTileLayer = layers["標準地図"];
                L.control.layers(layers).addTo(this.map);
                
                this.map.on('baselayerchange', (e) => { if (this.state.isMapView) this.state.activeTileLayer = e.layer; });
                
                this.layers.polygons.addTo(this.map);
                this.layers.edges.addTo(this.map);
                this.layers.points.addTo(this.map);
                this.layers.customLines.addTo(this.map);
                this.layers.customTexts.addTo(this.map);
            }

            initEvents() {
                this._setupMapEvents();
                this._setupKeyboardEvents();
                this._setupToolbarEvents();
                this._setupModalEvents();
                this._setupDragAndDropEvents();
                this._setupEditPanelEvents();
                this.setMode(this.state.mode);
            }

            _setupMapEvents() {
                this.isMapDragging = false;
                this.isPointDragging = false;
                this.hasPointMoved = false; 
                this.isDrawingCustomLine = false;
                this.currentCustomLineLatLngs = [];
                
                this.map.on('dragstart', () => { this.isMapDragging = true; });
                this.map.on('dragend', () => { setTimeout(() => { this.isMapDragging = false; }, 100); });

                // 右クリックドラッグによる画面移動
                const mapContainer = this.map.getContainer();
                mapContainer.addEventListener('contextmenu', e => {
                    if (this.isRightDragging || this.rightDragMoved) e.preventDefault();
                });

                mapContainer.addEventListener('mousedown', e => {
                    if (e.button === 2) {
                        this.isRightDragging = true;
                        this.rightDragMoved = false;
                        this.rightDragStart = { x: e.clientX, y: e.clientY };
                        mapContainer.style.cursor = 'grabbing';
                    } else if (e.target.classList.contains('rotation-handle')) {
                        // 回転ハンドルのドラッグ処理
                        e.stopPropagation();
                        e.preventDefault();
                        
                        const id = e.target.getAttribute('data-id');
                        const type = e.target.getAttribute('data-type');
                        
                        this.isRotating = true;
                        this.rotatingType = type;
                        this.map.dragging.disable();
                        
                        if (type === 'text') {
                            this.rotatingItem = this.state.customTexts.find(t => t.id === id);
                            if (this.rotatingItem) {
                                const centerLatLng = L.latLng(this.rotatingItem.lat, this.rotatingItem.lng);
                                this.rotatingCenterPx = this.map.latLngToContainerPoint(centerLatLng);
                            }
                        } else if (type === 'line') {
                            this.rotatingItem = this.state.customLines.find(l => l.id === id);
                            if (this.rotatingItem) {
                                let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                                this.rotatingItem.latlngs.forEach(ll => {
                                    if (ll[0] < minLat) minLat = ll[0];
                                    if (ll[0] > maxLat) maxLat = ll[0];
                                    if (ll[1] < minLng) minLng = ll[1];
                                    if (ll[1] > maxLng) maxLng = ll[1];
                                });
                                const centerLat = (minLat + maxLat) / 2;
                                const centerLng = (minLng + maxLng) / 2;
                                this.rotatingCenter = { lat: centerLat, lng: centerLng };
                                
                                const centerLatLng = L.latLng(centerLat, centerLng);
                                this.rotatingCenterPx = this.map.latLngToContainerPoint(centerLatLng);
                                this.rotatingLineOriginalLatLngs = JSON.parse(JSON.stringify(this.rotatingItem.latlngs));
                                
                                const rect = mapContainer.getBoundingClientRect();
                                const mousePx = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                                this.rotatingStartAngle = Math.atan2(mousePx.y - this.rotatingCenterPx.y, mousePx.x - this.rotatingCenterPx.x) * 180 / Math.PI + 90;
                            }
                        }
                    }
                });

                window.addEventListener('mousemove', (e) => {
                    if (this.isRightDragging) {
                        const dx = e.clientX - this.rightDragStart.x;
                        const dy = e.clientY - this.rightDragStart.y;
                        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.rightDragMoved = true;
                        this.map.panBy([-dx, -dy], { animate: false });
                        this.rightDragStart = { x: e.clientX, y: e.clientY };
                        return;
                    }

                    if (this.isRotating && this.rotatingItem) {
                        const rect = this.map.getContainer().getBoundingClientRect();
                        const mousePx = {
                            x: e.clientX - rect.left,
                            y: e.clientY - rect.top
                        };
                        const dx = mousePx.x - this.rotatingCenterPx.x;
                        const dy = mousePx.y - this.rotatingCenterPx.y;
                        let angle = Math.atan2(dy, dx) * 180 / Math.PI + 90;
                        if (angle < 0) angle += 360;

                        if (this.rotatingType === 'text') {
                            this.rotatingItem.rotation = Math.round(angle);
                            this.updateEditPanel();
                            this._updateCustomItemsDrawings();
                        } else if (this.rotatingType === 'line') {
                            const angleDiff = angle - this.rotatingStartAngle;
                            this.rotatingItem.tempRotation = angleDiff;
                            this.rotatingItem.latlngs = this.rotatingLineOriginalLatLngs.map(ll => {
                                return GeoUtils.rotatePoint(ll[0], ll[1], this.rotatingCenter.lat, this.rotatingCenter.lng, angleDiff);
                            });
                            if (this.els.editLineRotation) {
                                let rotVal = Math.round(angleDiff) % 360;
                                if (rotVal < 0) rotVal += 360;
                                this.els.editLineRotation.value = rotVal;
                                this.els.editLineRotationVal.textContent = rotVal;
                            }
                            this._updateCustomItemsDrawings();
                        }
                    }
                });

                window.addEventListener('mouseup', (e) => {
                    if (e.button === 2 && this.isRightDragging) {
                        this.isRightDragging = false;
                        this.map.getContainer().style.cursor = '';
                        setTimeout(() => this.rightDragMoved = false, 50);
                    }

                    if (this.isRotating) {
                        this.isRotating = false;
                        if (this.rotatingType === 'line' && this.rotatingItem) {
                            this.rotatingItem.tempRotation = 0;
                            if (this.els.editLineRotation) {
                                this.els.editLineRotation.value = 0;
                                this.els.editLineRotationVal.textContent = 0;
                            }
                        }
                        this.rotatingItem = null;
                        this.map.dragging.enable();
                        this.saveState();
                        this._updateCustomItemsDrawings();
                    }
                });
                
                this.map.on('mouseup', (e) => {
                    if (this.isPointDragging) {
                        this.isPointDragging = false;
                        this.draggedPointId = null;
                        this.map.dragging.enable();
                        document.body.classList.remove('is-dragging-point');
                        
                        if (this.hasPointMoved) this.saveState(); 
                        setTimeout(() => { this.hasPointMoved = false; }, 50);
                    }

                    if (this.isDraggingCustomLine) {
                        this.isDraggingCustomLine = false;
                        this.dragLineId = null;
                        this.map.dragging.enable();
                        if (this.hasPointMoved) this.saveState();
                        setTimeout(() => { this.hasPointMoved = false; }, 50);
                    }
                });

                this.map.on('click', (e) => this.handleMapClick(e));
                this.map.on('mousemove', (e) => this.handleMapMouseMove(e));
                
                this.map.on('contextmenu', (e) => {
                    if (this.rightDragMoved) {
                        L.DomEvent.stopPropagation(e);
                        return;
                    }
                    L.DomEvent.stopPropagation(e);
                    if (this.state.mode === APP_CONFIG.MODES.LINE) {
                        this.cancelLineDrawing();
                    } else if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE) {
                        this.finishCustomLineDrawing();
                    }
                });

                this.map.on('dblclick', (e) => {
                    if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE) {
                        L.DomEvent.stopPropagation(e);
                        this.finishCustomLineDrawing();
                    }
                });
            }

            _setupKeyboardEvents() {
                document.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' || e.key === 'Delete') {
                        const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
                        if (activeTag === 'input' || activeTag === 'textarea') return;
                        
                        if (this.state.mode === APP_CONFIG.MODES.SELECT && this.state.selectedItem) {
                            e.preventDefault();
                            this.deleteSelectedItem();
                        }
                        return;
                    }

                    if (e.key === 'Escape' || e.key === 'Esc') {
                        let modalClosed = false;
                        const modals = [
                            document.getElementById('confirmModal'), this.els.attrPasteModal, this.els.surveyPasteModal,
                            this.els.loadPreviewModal, this.els.exportJsonModal, this.els.exportGeoJsonModal,
                            this.els.addTextModal
                        ];
                        
                        modals.forEach(modal => {
                            if (modal && modal.style.display === 'flex') {
                                this._closeModal(modal);
                                modalClosed = true;
                            }
                        });

                        if (modalClosed) {
                            this.pendingLoadData = null;
                        } else {
                            this.cancelLineDrawing();
                            this.finishCustomLineDrawing();
                            this.clearSelection();
                        }

                    } else if (e.key === 'Enter') {
                        if (this.els.exportJsonModal.style.display === 'flex') {
                            e.preventDefault(); this._closeModal(this.els.exportJsonModal); this.executeSaveJson();
                        } else if (this.els.exportGeoJsonModal.style.display === 'flex') {
                            e.preventDefault(); this._closeModal(this.els.exportGeoJsonModal); this.executeExportGeoJSON();
                        }
                    } else if (e.ctrlKey || e.metaKey) {
                        if (e.key === 'z' || e.key === 'Z') {
                            e.preventDefault();
                            if (e.shiftKey) this.redo();
                            else this.undo();
                        } else if (e.key === 'y' || e.key === 'Y') {
                            e.preventDefault(); this.redo();
                        }
                    }
                });
            }

            _setupToolbarEvents() {
                this.els.btnUndo.addEventListener('click', () => this.undo());
                this.els.btnRedo.addEventListener('click', () => this.redo());
                this.els.modeSelect.addEventListener('click', () => this.setMode(APP_CONFIG.MODES.SELECT));
                this.els.modeAdd.addEventListener('click', () => this.setMode(APP_CONFIG.MODES.ADD));
                this.els.modeLine.addEventListener('click', () => this.setMode(APP_CONFIG.MODES.LINE));
                this.els.modeDrawLine.addEventListener('click', () => this.setMode(APP_CONFIG.MODES.DRAW_LINE));
                this.els.modeAddText.addEventListener('click', () => this.setMode(APP_CONFIG.MODES.ADD_TEXT));
                this.els.btnViewToggle.addEventListener('click', () => this.toggleViewMode());
                this.els.btnClear.addEventListener('click', () => this.clearAllData());
                this.els.btnLocation.addEventListener('click', () => this.moveToCurrentLocation());
                this.els.btnFitBounds.addEventListener('click', () => this.fitBoundsToPoints());
                this.els.labelDisplaySelect.addEventListener('change', (e) => { this.state.labelDisplay = e.target.value; this.updateMapDrawings(); });
                this.els.btnSurvey.addEventListener('click', () => window.open('https://docs.google.com/forms/d/e/1FAIpQLSdInwIRMNnxbnaV5ropZq4IrxQyvNKdZdBasoVlKk8HJnHWRA/viewform?usp=publish-editor', '_blank'));
                this.els.btnDemoData.addEventListener('click', () => this.showConfirm('現在のデータが上書きされます。デモデータを読み込みますか？', () => this.addDemoData()));
            }

            _setupModalEvents() {
                const setupExportModal = (btnOpen, btnCancel, btnApply, modal, inputEl, execFunc) => {
                    btnOpen.addEventListener('click', () => {
                        if (btnOpen === this.els.btnExport) {
                            if (this.state.points.length === 0) return this.showToast('出力するデータがありません。');
                        }
                        this._openModal(modal, inputEl);
                        inputEl.value = this.getDefaultFilename();
                        setTimeout(() => inputEl.select(), 150);
                    });
                    btnCancel.addEventListener('click', () => this._closeModal(modal));
                    btnApply.addEventListener('click', () => { this._closeModal(modal); execFunc(); });
                };

                setupExportModal(this.els.btnSaveJson, this.els.btnCancelExportJson, this.els.btnApplyExportJson, this.els.exportJsonModal, document.getElementById('exportJsonFilename'), () => this.executeSaveJson());
                setupExportModal(this.els.btnExport, this.els.btnCancelExportGeoJson, this.els.btnApplyExportGeoJson, this.els.exportGeoJsonModal, document.getElementById('exportGeoJsonFilename'), () => this.executeExportGeoJSON());

                this.els.btnExportHtml.addEventListener('click', () => this.openPrintLayoutWindow());

                this.els.btnPasteAttr.addEventListener('click', () => this._openModal(this.els.attrPasteModal, this.els.attrPasteArea));
                this.els.btnCancelAttrPaste.addEventListener('click', () => this._closeModal(this.els.attrPasteModal));
                this.els.btnApplyAttrPaste.addEventListener('click', () => this.applyAttrPasteModal());

                this.els.btnPasteSurvey.addEventListener('click', () => this._openModal(this.els.surveyPasteModal, this.els.surveyPasteArea));
                this.els.btnCancelSurveyPaste.addEventListener('click', () => this._closeModal(this.els.surveyPasteModal));
                this.els.btnApplySurveyPaste.addEventListener('click', () => this.applySurveyPasteModal());

                this.els.btnCopyAttr.addEventListener('click', () => this.copyAttrToClipboard());
                this.els.btnCopySurvey.addEventListener('click', () => this.copySurveyToClipboard());

                this.els.btnLoadJson.addEventListener('click', () => this.els.fileInputJson.click());
                this.els.fileInputJson.addEventListener('change', (e) => this.loadJsonFromFile(e));
                this.els.btnCancelLoad.addEventListener('click', () => { this.pendingLoadData = null; this._closeModal(this.els.loadPreviewModal); });
                this.els.btnApplyLoad.addEventListener('click', () => this.applyLoadData());

                this.els.btnCancelAddText.addEventListener('click', () => {
                    this._closeModal(this.els.addTextModal);
                    this.pendingTextAction = null;
                });
                this.els.btnApplyAddText.addEventListener('click', () => {
                    if (this.pendingTextAction) {
                        this.pendingTextAction(this.els.addTextArea.value);
                        this.pendingTextAction = null;
                    }
                    this._closeModal(this.els.addTextModal);
                });
            }

            _setupEditPanelEvents() {
                this.els.editTextInput.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { item.text = e.target.value; this._updateCustomItemsDrawings(); }
                });
                this.els.editFontSize.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { 
                        item.fontSize = parseInt(e.target.value); 
                        this.els.editFontSizeVal.textContent = item.fontSize; 
                        this.defaultTextFontSize = item.fontSize;
                        localStorage.setItem('defaultTextFontSize', item.fontSize);
                        this._updateCustomItemsDrawings(); 
                    }
                });
                this.els.editTextColor.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { 
                        item.color = e.target.value; 
                        this.defaultTextColor = item.color;
                        localStorage.setItem('defaultTextColor', item.color);
                        this._updateCustomItemsDrawings(); 
                    }
                });
                this.els.editTextRotation.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { item.rotation = parseInt(e.target.value); this.els.editTextRotationVal.textContent = item.rotation; this._updateCustomItemsDrawings(); }
                });

                [this.els.editTextInput, this.els.editFontSize, this.els.editTextColor, this.els.editTextRotation].forEach(el => {
                    el.addEventListener('change', () => this.saveState());
                });

                this.els.editLineWeight.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { 
                        item.weight = parseInt(e.target.value); 
                        this.els.editLineWeightVal.textContent = item.weight; 
                        this.defaultLineWeight = item.weight;
                        localStorage.setItem('defaultLineWeight', item.weight);
                        this._updateCustomItemsDrawings(); 
                    }
                });
                this.els.editLineColor.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { 
                        item.color = e.target.value; 
                        this.defaultLineColor = item.color;
                        localStorage.setItem('defaultLineColor', item.color);
                        this._updateCustomItemsDrawings(); 
                    }
                });
                this.els.editLineStyle.addEventListener('change', (e) => {
                    const item = this.getSelectedItemData();
                    if(item) { 
                        item.dashArray = e.target.value; 
                        this.defaultLineStyle = item.dashArray;
                        localStorage.setItem('defaultLineStyle', item.dashArray);
                        this._updateCustomItemsDrawings(); 
                        this.saveState(); 
                    }
                });
                [this.els.editLineWeight, this.els.editLineColor].forEach(el => {
                    el.addEventListener('change', () => this.saveState());
                });

                this.els.editLineRotation.addEventListener('mousedown', () => {
                    const item = this.getSelectedItemData();
                    if (item && this.state.selectedItem.type === 'line') {
                        this.rotatingLineOriginalLatLngs = JSON.parse(JSON.stringify(item.latlngs));
                        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                        item.latlngs.forEach(ll => {
                            if (ll[0] < minLat) minLat = ll[0];
                            if (ll[0] > maxLat) maxLat = ll[0];
                            if (ll[1] < minLng) minLng = ll[1];
                            if (ll[1] > maxLng) maxLng = ll[1];
                        });
                        this.rotatingLineCenter = { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
                    }
                });

                this.els.editLineRotation.addEventListener('input', (e) => {
                    const item = this.getSelectedItemData();
                    if (item && this.state.selectedItem.type === 'line' && this.rotatingLineOriginalLatLngs && this.rotatingLineCenter) {
                        const angle = parseInt(e.target.value);
                        this.els.editLineRotationVal.textContent = angle;
                        item.latlngs = this.rotatingLineOriginalLatLngs.map(ll => {
                            return GeoUtils.rotatePoint(ll[0], ll[1], this.rotatingLineCenter.lat, this.rotatingLineCenter.lng, angle);
                        });
                        this._updateCustomItemsDrawings();
                    }
                });

                this.els.editLineRotation.addEventListener('change', () => {
                    this.els.editLineRotation.value = 0;
                    this.els.editLineRotationVal.textContent = 0;
                    this.saveState();
                });

                this.els.btnDeleteSelected.addEventListener('click', () => this.deleteSelectedItem());
            }

            _setupDragAndDropEvents() {
                const overlay = document.getElementById('dropOverlay');
                document.body.addEventListener('dragover', (e) => {
                    e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; overlay.style.display = 'flex';
                });
                document.body.addEventListener('dragleave', (e) => {
                    e.preventDefault();
                    if (!e.relatedTarget || e.relatedTarget.nodeName === "HTML") overlay.style.display = 'none';
                });
                document.body.addEventListener('drop', async (e) => {
                    e.preventDefault(); overlay.style.display = 'none';
                    const files = await this.getAllFilesFromDataTransfer(e.dataTransfer);
                    if (files.length > 0) this.handleFiles(files);
                    else this.showToast('読み込めるファイルが見つかりませんでした。');
                });
            }

            saveState() {
                const data = {
                    points: this.state.points,
                    edges: this.state.edges.map(e => ({ from: e.from, to: e.to })),
                    attributes: this.state.attributes,
                    customTexts: this.state.customTexts,
                    customLines: this.state.customLines,
                    pointIdCounter: this.pointIdCounter
                };
                localStorage.setItem(APP_CONFIG.STORAGE_KEY, JSON.stringify(data));
                
                if (!this.isUndoRedoing) {
                    this.pushToHistory(data);
                }
            }

            pushToHistory(data) {
                const snapshotStr = JSON.stringify(data);
                if (this.historyIndex >= 0 && snapshotStr === JSON.stringify(this.history[this.historyIndex])) return;
                
                if (this.historyIndex < this.history.length - 1) {
                    this.history = this.history.slice(0, this.historyIndex + 1);
                }
                
                if (this.history.length >= 50) this.history.shift();
                else this.historyIndex++;
                
                this.history.push(JSON.parse(snapshotStr));
                this.updateUndoRedoButtons();
            }

            undo() {
                if (this.historyIndex > 0) {
                    this.historyIndex--;
                    this.restoreSnapshot(this.history[this.historyIndex]);
                    this.showToast('元に戻しました。');
                }
            }

            redo() {
                if (this.historyIndex < this.history.length - 1) {
                    this.historyIndex++;
                    this.restoreSnapshot(this.history[this.historyIndex]);
                    this.showToast('やり直しました。');
                }
            }

            restoreSnapshot(snapshot) {
                this.isUndoRedoing = true;
                this.state.points = JSON.parse(JSON.stringify(snapshot.points));
                this.state.edges = JSON.parse(JSON.stringify(snapshot.edges));
                this.state.attributes = JSON.parse(JSON.stringify(snapshot.attributes));
                this.state.customTexts = JSON.parse(JSON.stringify(snapshot.customTexts || []));
                this.state.customLines = JSON.parse(JSON.stringify(snapshot.customLines || []));
                this.pointIdCounter = snapshot.pointIdCounter;
                
                this.clearSelection();
                if (this.layers.rubberBand) { 
                    this.layers.rubberBand.remove(); 
                    this.layers.rubberBand = null; 
                    if (this.layers.rubberBandBg) {
                        this.layers.rubberBandBg.remove();
                        this.layers.rubberBandBg = null;
                    }
                }

                this.updateAll();
                
                this.isUndoRedoing = false;
                this.updateUndoRedoButtons();
            }

            updateUndoRedoButtons() {
                if (this.els.btnUndo) this.els.btnUndo.disabled = this.historyIndex <= 0;
                if (this.els.btnRedo) this.els.btnRedo.disabled = this.historyIndex >= this.history.length - 1;
            }

            loadState() {
                const saved = localStorage.getItem(APP_CONFIG.STORAGE_KEY);
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        this.state.points = data.points || [];
                        this.state.edges = data.edges || [];
                        this.state.attributes = data.attributes || JSON.parse(JSON.stringify(APP_CONFIG.DEFAULT_ATTRIBUTES));
                        this.state.customTexts = data.customTexts || [];
                        this.state.customLines = data.customLines || [];
                        this.pointIdCounter = data.pointIdCounter || 1;
                        this.updateAll();
                        setTimeout(() => this.fitBoundsToPoints(true), 250);
                        this.showToast('前回のデータを復元しました。');
                    } catch (e) {
                        console.error('データの復元に失敗しました', e);
                        this.addDemoData();
                    }
                } else {
                    this.addDemoData();
                }
            }

            setMode(mode) {
                if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE && mode !== APP_CONFIG.MODES.DRAW_LINE) {
                    this.cancelCustomLineDrawing();
                }

                this.state.mode = mode;
                if (mode !== APP_CONFIG.MODES.SELECT) {
                    this.clearSelection();
                }
                this.state.selectedPointId = null;
                document.body.classList.remove('is-hovering-point');
                
                this.els.modeSelect.classList.toggle('active', mode === APP_CONFIG.MODES.SELECT);
                this.els.modeAdd.classList.toggle('active', mode === APP_CONFIG.MODES.ADD);
                this.els.modeLine.classList.toggle('active', mode === APP_CONFIG.MODES.LINE);
                this.els.modeDrawLine.classList.toggle('active', mode === APP_CONFIG.MODES.DRAW_LINE);
                this.els.modeAddText.classList.toggle('active', mode === APP_CONFIG.MODES.ADD_TEXT);
                
                const mapEl = this.map.getContainer();
                mapEl.classList.remove('map-mode-select', 'map-mode-add', 'map-mode-line', 'map-mode-drawline', 'map-mode-addtext');
                
                if (mode === APP_CONFIG.MODES.SELECT) mapEl.classList.add('map-mode-select');
                else if (mode === APP_CONFIG.MODES.ADD) mapEl.classList.add('map-mode-add');
                else if (mode === APP_CONFIG.MODES.LINE) mapEl.classList.add('map-mode-line');
                else if (mode === APP_CONFIG.MODES.DRAW_LINE) mapEl.classList.add('map-mode-drawline');
                else if (mode === APP_CONFIG.MODES.ADD_TEXT) mapEl.classList.add('map-mode-addtext');

                this.els.modeInstructions.style.display = 'block';
                if (mode === APP_CONFIG.MODES.SELECT) {
                    this.els.modeInstructions.innerHTML = "👆 <b>選択・編集モード</b>: 文字や線をクリックで選択・移動・編集できます。";
                } else if (mode === APP_CONFIG.MODES.ADD) {
                    this.els.modeInstructions.innerHTML = "📍 <b>測点モード</b>: 地図クリックで追加、ドラッグで移動、右クリックで削除します。";
                } else if (mode === APP_CONFIG.MODES.LINE) {
                    this.els.modeInstructions.innerHTML = "🔗 <b>測線モード</b>: ポイントを順にクリックして結線します。線上の右クリックで線を削除できます。";
                } else if (mode === APP_CONFIG.MODES.DRAW_LINE) {
                    this.els.modeInstructions.innerHTML = "〰️ <b>自由線モード</b>: 地図上をクリックして連続線を引きます。線上の右クリックで線を削除できます。";
                } else if (mode === APP_CONFIG.MODES.ADD_TEXT) {
                    this.els.modeInstructions.innerHTML = "🔤 <b>文字モード</b>: 地図クリックで追加、ドラッグで移動、ダブルクリックで編集します。";
                }

                this.updateMapDrawings();
            }

            toggleViewMode() {
                this.state.isMapView = !this.state.isMapView;
                const mapEl = this.map.getContainer();
                if (this.state.isMapView) {
                    this.els.btnViewToggle.innerHTML = '✏️ 図面ビュー';
                    this.els.btnViewToggle.title = '背景地図を隠して図面のみ表示します';
                    mapEl.classList.remove('map-bg-grid');
                    if (this.state.activeTileLayer) this.map.addLayer(this.state.activeTileLayer);
                } else {
                    this.els.btnViewToggle.innerHTML = '🗺️ 地図ビュー';
                    this.els.btnViewToggle.title = '背景に地図を表示します';
                    mapEl.classList.add('map-bg-grid');
                    this.map.eachLayer(layer => { if (layer instanceof L.TileLayer) this.map.removeLayer(layer); });
                }
            }
            
            fitBoundsToPoints(silent = false) {
                if (this.layers.points.getBounds().isValid()) {
                    this.map.invalidateSize();
                    this.map.fitBounds(this.layers.points.getBounds(), { padding: [50, 50] });
                } else if (!silent) {
                    this.showToast('表示するポイントがありません。');
                }
            }

            moveToCurrentLocation() {
                if (!navigator.geolocation) {
                    this.showToast('お使いのブラウザは現在地取得に対応していません。');
                    return;
                }
                this.showToast('現在地を取得中...');
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        const lat = position.coords.latitude;
                        const lng = position.coords.longitude;
                        this.map.setView([lat, lng], 18);
                        this.showToast('現在地に移動しました。');
                    },
                    (error) => {
                        let errMsg = error.message ? error.message : "詳細不明のエラー";
                        console.warn("Geolocation warning code:", error.code, "message:", errMsg);
                        
                        let msg = '現在地の取得に失敗しました。';
                        if (errMsg.includes('permissions policy')) {
                            msg = 'プレビュー環境では位置情報の取得が制限されています。';
                        } else if (error.code === 1 || error.code === error.PERMISSION_DENIED) {
                            msg = '位置情報の利用が許可されていません。設定をご確認ください。';
                        } else if (error.code === 2 || error.code === error.POSITION_UNAVAILABLE) {
                            msg = '現在地を取得できませんでした。電波状況をご確認ください。';
                        } else if (error.code === 3 || error.code === error.TIMEOUT) {
                            msg = '現在地の取得がタイムアウトしました。';
                        }
                        this.showToast(msg);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            }

            _openModal(modalEl, focusEl) {
                focusEl.value = '';
                modalEl.style.display = 'flex';
                setTimeout(() => focusEl.focus(), 100);
            }
            
            _closeModal(modalEl) {
                modalEl.style.display = 'none';
            }

            showConfirm(message, onConfirm, title = '確認') {
                const modal = document.getElementById('confirmModal');
                document.getElementById('confirmTitle').textContent = title;
                document.getElementById('confirmMessage').textContent = message;
                document.getElementById('btnCancelConfirm').onclick = () => this._closeModal(modal);
                document.getElementById('btnApplyConfirm').onclick = () => { this._closeModal(modal); onConfirm(); };
                modal.style.display = 'flex';
            }

            showToast(msg) {
                const toast = document.getElementById('toast');
                toast.textContent = msg;
                toast.classList.add('show');
                setTimeout(() => toast.classList.remove('show'), 3000);
            }

            _copyTextToClipboard(text, successMsg) {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                Object.assign(textArea.style, { position: 'fixed', left: '-9999px' });
                document.body.appendChild(textArea);
                textArea.select();
                try {
                    document.execCommand('copy') ? this.showToast(successMsg) : this.showToast('コピーに失敗しました。');
                } catch (err) { this.showToast('コピーに失敗しました。'); }
                document.body.removeChild(textArea);
            }

            handleMapClick(e) {
                if (this.isMapDragging || this.rightDragMoved) return;
                
                if (this.state.mode === APP_CONFIG.MODES.SELECT) {
                    this.clearSelection();
                } else if (this.state.mode === APP_CONFIG.MODES.ADD) {
                    this.addPoint(e.latlng.lat, e.latlng.lng);
                } else if (this.state.mode === APP_CONFIG.MODES.LINE) {
                    this.cancelLineDrawing();
                } else if (this.state.mode === APP_CONFIG.MODES.ADD_TEXT) {
                    this.pendingTextAction = (text) => {
                        if (text && text.trim() !== '') {
                            this.addCustomText(text, e.latlng.lat, e.latlng.lng);
                        }
                    };
                    this._openModal(this.els.addTextModal, this.els.addTextArea);
                } else if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE) {
                    if (!this.isDrawingCustomLine) {
                        this.isDrawingCustomLine = true;
                        this.currentCustomLineLatLngs = [[e.latlng.lat, e.latlng.lng]];
                    } else {
                        const lastPt = this.currentCustomLineLatLngs[this.currentCustomLineLatLngs.length - 1];
                        if (Math.abs(lastPt[0] - e.latlng.lat) > 0.000001 || Math.abs(lastPt[1] - e.latlng.lng) > 0.000001) {
                            this.currentCustomLineLatLngs.push([e.latlng.lat, e.latlng.lng]);
                        }
                    }
                    this._updateTempDrawLine(e.latlng);
                }
            }

            handleMapMouseMove(e) {
                if (this.state.mode === APP_CONFIG.MODES.ADD && this.isPointDragging && this.draggedPointId) {
                    const p = this.getPoint(this.draggedPointId);
                    if (p) {
                        p.lat = e.latlng.lat;
                        p.lng = e.latlng.lng;
                        this.hasPointMoved = true;
                        this.updateAll();
                    }
                } else if (this.state.mode === APP_CONFIG.MODES.LINE && this.state.selectedPointId) {
                    const p1 = this.getPoint(this.state.selectedPointId);
                    if (p1) {
                        let targetLatLng = e.latlng;
                        if (this.hoveredPoint) {
                            targetLatLng = L.latLng(this.hoveredPoint.lat, this.hoveredPoint.lng);
                        }
                        if (!this.layers.rubberBand) {
                            this.layers.rubberBandBg = L.polyline([[p1.lat, p1.lng], targetLatLng], {
                                color: '#ffffff', weight: 6, interactive: false
                            }).addTo(this.map);
                            this.layers.rubberBand = L.polyline([[p1.lat, p1.lng], targetLatLng], {
                                color: APP_CONFIG.COLORS.rubberBand, weight: 2, dashArray: '5, 5', interactive: false
                            }).addTo(this.map);
                        } else {
                            this.layers.rubberBandBg.setLatLngs([[p1.lat, p1.lng], targetLatLng]);
                            this.layers.rubberBand.setLatLngs([[p1.lat, p1.lng], targetLatLng]);
                        }
                    }
                } else if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE && this.isDrawingCustomLine) {
                    this._updateTempDrawLine(e.latlng);
                } else if (this.state.mode === APP_CONFIG.MODES.SELECT && this.isDraggingCustomLine && this.dragLineId) {
                    const item = this.state.customLines.find(l => l.id === this.dragLineId);
                    if (item && this.dragLineStartLatLng && this.dragLineOriginalLatLngs) {
                        const dLat = e.latlng.lat - this.dragLineStartLatLng.lat;
                        const dLng = e.latlng.lng - this.dragLineStartLatLng.lng;
                        item.latlngs = this.dragLineOriginalLatLngs.map(ll => [ll[0] + dLat, ll[1] + dLng]);
                        this.hasPointMoved = true;
                        this._updateCustomItemsDrawings();
                    }
                }
            }

            _updateTempDrawLine(currentLatLng) {
                const latlngs = [...this.currentCustomLineLatLngs, [currentLatLng.lat, currentLatLng.lng]];
                if (!this.layers.tempDrawLine) {
                    this.layers.tempDrawLineBg = L.polyline(latlngs, {
                        color: '#ffffff', weight: this.defaultLineWeight + 4, interactive: false
                    }).addTo(this.map);
                    this.layers.tempDrawLine = L.polyline(latlngs, {
                        color: this.defaultLineColor, weight: this.defaultLineWeight, dashArray: this.defaultLineStyle, interactive: false
                    }).addTo(this.map);
                } else {
                    this.layers.tempDrawLineBg.setLatLngs(latlngs);
                    this.layers.tempDrawLine.setLatLngs(latlngs);
                }
            }
            
            finishCustomLineDrawing() {
                if (this.isDrawingCustomLine) {
                    if (this.currentCustomLineLatLngs.length >= 2) {
                        this.addCustomLine(this.currentCustomLineLatLngs);
                    }
                    this.cancelCustomLineDrawing();
                }
            }

            cancelCustomLineDrawing() {
                this.isDrawingCustomLine = false;
                this.currentCustomLineLatLngs = [];
                if (this.layers.tempDrawLine) {
                    this.layers.tempDrawLine.remove();
                    this.layers.tempDrawLine = null;
                    if (this.layers.tempDrawLineBg) {
                        this.layers.tempDrawLineBg.remove();
                        this.layers.tempDrawLineBg = null;
                    }
                }
            }

            cancelLineDrawing() {
                if (this.state.mode === APP_CONFIG.MODES.LINE && this.state.selectedPointId) {
                    this.state.selectedPointId = null;
                    if (this.layers.rubberBand) {
                        this.layers.rubberBand.remove();
                        this.layers.rubberBand = null;
                        if (this.layers.rubberBandBg) {
                            this.layers.rubberBandBg.remove();
                            this.layers.rubberBandBg = null;
                        }
                    }
                    this.updateAll();
                }
            }

            selectItem(type, id) {
                if (this.state.selectedItem && this.state.selectedItem.type === type && this.state.selectedItem.id === id) {
                    this.showEditPanel();
                    return;
                }
                this.state.selectedItem = { type, id };
                this.updateMapDrawings();
                this.showEditPanel();
            }

            clearSelection() {
                this.state.selectedItem = null;
                this.updateMapDrawings();
                this.hideEditPanel();
            }

            getSelectedItemData() {
                if (!this.state.selectedItem) return null;
                if (this.state.selectedItem.type === 'text') return this.state.customTexts.find(t => t.id === this.state.selectedItem.id);
                if (this.state.selectedItem.type === 'line') return this.state.customLines.find(l => l.id === this.state.selectedItem.id);
                return null;
            }

            deleteSelectedItem() {
                if (!this.state.selectedItem) return;
                const { type, id } = this.state.selectedItem;
                if (type === 'text') this.state.customTexts = this.state.customTexts.filter(t => t.id !== id);
                else if (type === 'line') this.state.customLines = this.state.customLines.filter(l => l.id !== id);
                this.clearSelection();
                this.updateAll();
                this.showToast('要素を削除しました');
            }

            showEditPanel() {
                if (!this.state.selectedItem) return;
                this.els.editPanel.style.display = 'block';
                this.updateEditPanel();
            }

            hideEditPanel() {
                this.els.editPanel.style.display = 'none';
            }

            updateEditPanel() {
                const item = this.getSelectedItemData();
                if (!item) return;

                if (this.state.selectedItem.type === 'text') {
                    this.els.editPropText.style.display = 'flex';
                    this.els.editPropLine.style.display = 'none';
                    
                    this.els.editTextInput.value = item.text || '';
                    this.els.editFontSize.value = item.fontSize || 16;
                    this.els.editFontSizeVal.textContent = item.fontSize || 16;
                    this.els.editTextColor.value = item.color || '#000000';
                    this.els.editTextRotation.value = item.rotation || 0;
                    this.els.editTextRotationVal.textContent = item.rotation || 0;
                } else if (this.state.selectedItem.type === 'line') {
                    this.els.editPropText.style.display = 'none';
                    this.els.editPropLine.style.display = 'flex';
                    
                    this.els.editLineWeight.value = item.weight || 2;
                    this.els.editLineWeightVal.textContent = item.weight || 2;
                    this.els.editLineColor.value = item.color || '#333333';
                    this.els.editLineStyle.value = item.dashArray || '';
                    
                    this.els.editLineRotation.value = 0;
                    this.els.editLineRotationVal.textContent = 0;
                }
            }

            addPoint(lat, lng, name = null) {
                const id = 'p' + this.pointIdCounter++;
                let newName = name;
                if (!newName) {
                    let maxNum = 0;
                    for (const p of this.state.points) {
                        const num = parseInt(p.name, 10);
                        if (!isNaN(num) && num > maxNum) {
                            maxNum = num;
                        }
                    }
                    newName = `${maxNum + 1}`;
                }
                const newPoint = { id, name: newName, lat, lng };
                this.state.points.push(newPoint);
                this.updateAll();
                return newPoint;
            }

            getPoint(id) { return this.state.points.find(p => p.id === id); }

            deletePoint(id) {
                this.state.points = this.state.points.filter(p => p.id !== id);
                this.state.edges = this.state.edges.filter(e => e.from !== id && e.to !== id);
                if (this.state.selectedPointId === id) this.state.selectedPointId = null;
                this.updateAll();
            }

            toggleEdge(id1, id2) {
                if (id1 === id2) return;
                const idx = this.state.edges.findIndex(e => (e.from === id1 && e.to === id2) || (e.from === id2 && e.to === id1));
                if (idx >= 0) this.state.edges.splice(idx, 1);
                else this.state.edges.push({ from: id1, to: id2 });
            }

            removeEdge(edgeObj) {
                this.state.edges = this.state.edges.filter(e => e !== edgeObj);
                if (this.state.mode === APP_CONFIG.MODES.LINE) this.state.selectedPointId = null;
                this.updateAll();
                this.showToast('結線を削除しました');
            }

            removePolygonEdges(targetArea) {
                const paths = [targetArea.path, ...targetArea.holes.map(h => h.path)];
                const sharedEdges = new Set();
                
                this.state.areas.forEach(area => {
                    if (area === targetArea) return;
                    [area.path, ...area.holes.map(h => h.path)].forEach(p => {
                        for (let i = 0; i < p.length; i++) sharedEdges.add([p[i], p[(i + 1) % p.length]].sort().join('-'));
                    });
                });

                const edgesToRemove = [];
                paths.forEach(path => {
                    for (let i = 0; i < path.length; i++) {
                        const edgeKey = [path[i], path[(i + 1) % path.length]].sort().join('-');
                        if (sharedEdges.has(edgeKey)) continue;
                        
                        const edge = this.state.edges.find(e => 
                            (e.from === path[i] && e.to === path[(i + 1) % path.length]) || 
                            (e.from === path[(i + 1) % path.length] && e.to === path[i])
                        );
                        if (edge && !edgesToRemove.includes(edge)) edgesToRemove.push(edge);
                    }
                });

                if (edgesToRemove.length > 0) {
                    this.state.edges = this.state.edges.filter(e => !edgesToRemove.includes(e));
                    if (this.state.mode === APP_CONFIG.MODES.LINE) this.state.selectedPointId = null;
                    this.updateAll();
                    this.showToast('区画を削除しました（隣接地の境界線は保持しました）');
                } else {
                    this.showToast('削除できる結線がありません（すべて隣接区画と共有しています）');
                }
            }
            
            addCustomLine(latlngs) {
                const id = 'cline_' + Date.now() + Math.floor(Math.random() * 1000);
                this.state.customLines.push({ 
                    id, latlngs, 
                    weight: this.defaultLineWeight, 
                    color: this.defaultLineColor,
                    dashArray: this.defaultLineStyle
                });
                this.updateAll();
                this.selectItem('line', id);
            }

            addCustomText(text, lat, lng) {
                const id = 'ctext_' + Date.now() + Math.floor(Math.random() * 1000);
                this.state.customTexts.push({ 
                    id, text, lat, lng, 
                    fontSize: this.defaultTextFontSize, 
                    color: this.defaultTextColor, 
                    rotation: 0 
                });
                this.updateAll();
                this.selectItem('text', id);
            }

            clearAllData() {
                this.showConfirm('すべてのポイント、結線、文字、自由線を削除しますか？', () => {
                    this.state.points = [];
                    this.state.edges = [];
                    this.state.customTexts = [];
                    this.state.customLines = [];
                    this.pointIdCounter = 1;
                    this.clearSelection();
                    this.updateAll();
                });
            }

            updateAll() {
                const detector = new PolygonDetector(this.state.points, this.state.edges);
                this.state.areas = detector.detect();
                
                this.renderAttrTable();
                this.renderTable();
                this.renderAreaResults();
                this.updateMapDrawings();
                this.saveState(); 
            }

            updateMapDrawings() {
                this.layers.polygons.clearLayers();
                this.layers.edges.clearLayers();
                this.layers.points.clearLayers();
                this.layers.customLines.clearLayers();
                this.layers.customTexts.clearLayers();

                this._drawPolygons();
                this._drawEdges();
                this._drawPoints();
                this._drawCustomItems();
            }

            _updateCustomItemsDrawings() {
                this.layers.customLines.clearLayers();
                this.layers.customTexts.clearLayers();
                this._drawCustomItems();
            }

            _drawPolygons() {
                this.state.areas.forEach((area, i) => {
                    const coords = [area.coords, ...area.holes.map(h => h.coords)];
                    // 白フチを追加
                    const polyOutline = L.polygon(coords, { color: '#ffffff', weight: 4, fill: false, interactive: false }).addTo(this.layers.polygons);
                    const poly = L.polygon(coords, { color: APP_CONFIG.COLORS.polyBorder, weight: 2, fillColor: APP_CONFIG.COLORS.polyFill, fillOpacity: 0.3 }).addTo(this.layers.polygons);
                    
                    const createLabelMarker = (text, cls, center) => {
                        const icon = L.divIcon({ className: 'area-label-container', html: `<div class="area-label ${cls}">${text}</div>`, iconSize: [0, 0] });
                        L.marker([center.lat, center.lng], { icon, interactive: false }).addTo(this.layers.polygons);
                    };
                    
                    createLabelMarker(`区画${i+1}<br>${GeoUtils.m2ToHa(area.netArea).toFixed(4)} ha`, '', area.center);
                    area.holes.forEach((hole, j) => createLabelMarker(`除地${j+1}<br>${GeoUtils.m2ToHa(hole.area).toFixed(4)} ha`, 'hole-label', hole.center));

                    poly.on('click', (e) => {
                        if (this.state.mode !== APP_CONFIG.MODES.LINE) return;
                        L.DomEvent.stopPropagation(e);
                        this.removePolygonEdges(area);
                    });
                });
            }

            _drawEdges() {
                this.state.edges.forEach(edge => {
                    const p1 = this.getPoint(edge.from), p2 = this.getPoint(edge.to);
                    if (!p1 || !p2) return;
                    // 白フチを追加
                    const lineBg = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], { color: '#ffffff', weight: 5, interactive: false }).addTo(this.layers.edges);
                    const line = L.polyline([[p1.lat, p1.lng], [p2.lat, p2.lng]], { color: APP_CONFIG.COLORS.line, weight: 3 }).addTo(this.layers.edges);
                    
                    line.on('contextmenu', (e) => {
                        if (this.state.mode !== APP_CONFIG.MODES.LINE) return;
                        L.DomEvent.stopPropagation(e);
                        this.removeEdge(edge);
                    });
                });
            }

            _drawPoints() {
                if (!this.hoverHighlightMarker) {
                    this.hoverHighlightMarker = L.circleMarker([0, 0], {
                        radius: 14,
                        fillColor: '#fef08a',
                        color: '#eab308',
                        weight: 2,
                        fillOpacity: 0.6,
                        opacity: 0.8,
                        interactive: false
                    });
                }

                this.state.points.forEach((p, i) => {
                    const isSelected = this.state.selectedPointId === p.id;
                    const marker = L.circleMarker([p.lat, p.lng], {
                        radius: 6,
                        fillColor: isSelected ? APP_CONFIG.COLORS.pointSelected : APP_CONFIG.COLORS.pointFill,
                        color: isSelected ? APP_CONFIG.COLORS.pointBorderSelected : APP_CONFIG.COLORS.pointBorder,
                        weight: 2, opacity: 1, fillOpacity: 1
                    }).addTo(this.layers.points);

                    let showLabel = false;
                    if (this.state.labelDisplay === 'all') showLabel = true;
                    else if (this.state.labelDisplay !== 'none') {
                        const step = parseInt(this.state.labelDisplay, 10);
                        if ((i + 1) % step === 0 || i === 0 || i === this.state.points.length - 1) showLabel = true;
                    }

                    if (showLabel) {
                        const icon = L.divIcon({ className: 'map-label', html: p.name, iconSize: null, iconAnchor: [-8, 8] });
                        L.marker([p.lat, p.lng], { icon, interactive: false }).addTo(this.layers.points);
                    }

                    marker.on('mousedown', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.ADD) {
                            this.isPointDragging = true;
                            this.hasPointMoved = false; 
                            this.draggedPointId = p.id;
                            this.map.dragging.disable();
                            document.body.classList.add('is-dragging-point');
                        }
                    });
                    marker.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.LINE) {
                            if (this.state.selectedPointId) {
                                if (this.state.selectedPointId === p.id) {
                                    this.state.selectedPointId = null;
                                } else {
                                    this.toggleEdge(this.state.selectedPointId, p.id);
                                    this.state.selectedPointId = p.id;
                                }
                                if (this.layers.rubberBand) { 
                                    this.layers.rubberBand.remove(); 
                                    this.layers.rubberBand = null; 
                                    if (this.layers.rubberBandBg) {
                                        this.layers.rubberBandBg.remove();
                                        this.layers.rubberBandBg = null;
                                    }
                                }
                            } else {
                                this.state.selectedPointId = p.id;
                            }
                            this.updateAll();
                        }
                    });
                    marker.on('contextmenu', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.ADD) {
                            this.deletePoint(p.id);
                        }
                    });
                    
                    marker.on('mouseover', () => {
                        this.hoveredPoint = p; // 線の吸着判定用
                        if (this.state.mode === APP_CONFIG.MODES.ADD || this.state.mode === APP_CONFIG.MODES.LINE) {
                            this.hoverHighlightMarker.setLatLng([p.lat, p.lng]).addTo(this.map);
                        }
                        document.body.classList.add('is-hovering-point');
                    });
                    
                    marker.on('mouseout', () => {
                        this.hoveredPoint = null; // 吸着解除
                        if (this.hoverHighlightMarker && this.map.hasLayer(this.hoverHighlightMarker)) {
                            this.hoverHighlightMarker.remove();
                        }
                        document.body.classList.remove('is-hovering-point');
                    });
                });
            }

            _drawCustomItems() {
                this.state.customLines.forEach(lineData => {
                    const weight = lineData.weight || 2;
                    const color = lineData.color || '#333333';
                    const isSelected = this.state.selectedItem && this.state.selectedItem.type === 'line' && this.state.selectedItem.id === lineData.id;

                    // 白フチを追加
                    const bgLine = L.polyline(lineData.latlngs, { color: '#ffffff', weight: weight + 2, interactive: false }).addTo(this.layers.customLines);
                    
                    const line = L.polyline(lineData.latlngs, { 
                        color: color, 
                        weight: weight,
                        dashArray: lineData.dashArray || null
                    }).addTo(this.layers.customLines);
                    
                    if (isSelected) {
                        L.polyline(lineData.latlngs, { color: '#3b82f6', weight: weight + 8, opacity: 0.4, interactive: false }).addTo(this.layers.customLines);
                        lineData.latlngs.forEach(latlng => {
                            L.circleMarker(latlng, { radius: 4, fillColor: '#ffffff', color: '#3b82f6', weight: 2, fillOpacity: 1, interactive: false }).addTo(this.layers.customLines);
                        });

                        let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
                        lineData.latlngs.forEach(ll => {
                            if (ll[0] < minLat) minLat = ll[0];
                            if (ll[0] > maxLat) maxLat = ll[0];
                            if (ll[1] < minLng) minLng = ll[1];
                            if (ll[1] > maxLng) maxLng = ll[1];
                        });
                        const centerLat = (minLat + maxLat) / 2;
                        const centerLng = (minLng + maxLng) / 2;
                        const rot = lineData.tempRotation || 0;

                        const lineHandleHtml = `
                        <div style="position:absolute; left:0; top:0; transform: translate(-50%, -50%) rotate(${rot}deg); pointer-events: none;">
                            <div class="rotation-handle-wrapper" style="top: 0; left: 50%; transform: translateX(-50%);">
                                <div class="rotation-line" style="bottom: 0px; height: 30px;"></div>
                                <div class="rotation-handle" data-id="${lineData.id}" data-type="line" style="bottom: 30px;"></div>
                            </div>
                        </div>`;
                        const handleIcon = L.divIcon({ className: 'custom-line-rotator', html: lineHandleHtml, iconSize: [0,0] });
                        L.marker([centerLat, centerLng], { icon: handleIcon, interactive: true }).addTo(this.layers.customLines);
                    }

                    line.on('mousedown', (e) => {
                        if (this.state.mode === APP_CONFIG.MODES.SELECT) {
                            L.DomEvent.stopPropagation(e);
                            this.isDraggingCustomLine = true;
                            this.dragLineId = lineData.id;
                            this.dragLineStartLatLng = e.latlng;
                            this.dragLineOriginalLatLngs = JSON.parse(JSON.stringify(lineData.latlngs));
                            this.map.dragging.disable();
                        }
                    });

                    line.on('click', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.SELECT) {
                            this.selectItem('line', lineData.id);
                        }
                    });
                    line.on('contextmenu', (e) => {
                        if (this.state.mode === APP_CONFIG.MODES.DRAW_LINE) {
                            L.DomEvent.stopPropagation(e);
                            this.state.customLines = this.state.customLines.filter(l => l.id !== lineData.id);
                            this.updateAll();
                        }
                    });
                });

                this.state.customTexts.forEach(textData => {
                    const fontSize = textData.fontSize || 16;
                    const color = textData.color || '#000000';
                    const rotation = textData.rotation || 0;
                    const isSelected = this.state.selectedItem && this.state.selectedItem.type === 'text' && this.state.selectedItem.id === textData.id;

                    let handleHtml = '';
                    let highlightStyle = 'outline: 2px dashed transparent;';
                    if (isSelected) {
                        highlightStyle = 'outline: 2px dashed #3b82f6; outline-offset: 2px; background-color: rgba(59, 130, 246, 0.15); border-radius: 4px;';
                        handleHtml = `
                            <div class="rotation-handle-wrapper" style="top: 0; left: 50%; transform: translateX(-50%);">
                                <div class="rotation-line" style="bottom: 100%;"></div>
                                <div class="rotation-handle" data-id="${textData.id}" data-type="text" style="bottom: calc(100% + 20px);"></div>
                            </div>
                        `;
                    }

                    const htmlContent = `
                        <div style="position:absolute; left:0; top:0; transform: translate(-50%, -50%) rotate(${rotation}deg); white-space: nowrap; width: max-content; pointer-events: none;">
                            <div style="position:relative; font-size: ${fontSize}px; color: ${color}; padding: 2px 4px; transition: outline-color 0.2s; ${highlightStyle} pointer-events: auto;">
                                ${handleHtml}
                                ${textData.text.replace(/\n/g, '<br>')}
                            </div>
                        </div>
                    `;
                    
                    const icon = L.divIcon({ className: 'custom-text-marker', html: htmlContent, iconSize: [0,0] });
                    const isDraggable = this.state.mode === APP_CONFIG.MODES.SELECT || this.state.mode === APP_CONFIG.MODES.ADD_TEXT;
                    const marker = L.marker([textData.lat, textData.lng], { icon, draggable: isDraggable }).addTo(this.layers.customTexts);
                    
                    marker.on('mousedown', (e) => {
                        if (this.state.mode === APP_CONFIG.MODES.SELECT) {
                            this.selectItem('text', textData.id);
                        }
                    });

                    marker.on('dragstart', () => {
                        if (this.state.mode === APP_CONFIG.MODES.SELECT) this.selectItem('text', textData.id);
                    });

                    marker.on('dragend', (e) => {
                        const newPos = e.target.getLatLng();
                        textData.lat = newPos.lat;
                        textData.lng = newPos.lng;
                        if (this.state.mode === APP_CONFIG.MODES.SELECT) {
                            this.selectItem('text', textData.id);
                        }
                        this.saveState();
                    });

                    marker.on('contextmenu', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.SELECT || this.state.mode === APP_CONFIG.MODES.ADD_TEXT) {
                            this.state.customTexts = this.state.customTexts.filter(t => t.id !== textData.id);
                            if (this.state.selectedItem && this.state.selectedItem.id === textData.id) this.clearSelection();
                            this.updateAll();
                        }
                    });

                    marker.on('dblclick', (e) => {
                        L.DomEvent.stopPropagation(e);
                        if (this.state.mode === APP_CONFIG.MODES.SELECT || this.state.mode === APP_CONFIG.MODES.ADD_TEXT) {
                            this.pendingTextAction = (newText) => {
                                if (newText.trim() === '') {
                                    this.state.customTexts = this.state.customTexts.filter(t => t.id !== textData.id);
                                    if (this.state.selectedItem && this.state.selectedItem.id === textData.id) this.clearSelection();
                                } else {
                                    textData.text = newText;
                                    if (this.state.selectedItem && this.state.selectedItem.id === textData.id) this.updateEditPanel();
                                }
                                this.updateAll();
                            };
                            this.els.addTextArea.value = textData.text;
                            this._openModal(this.els.addTextModal, this.els.addTextArea);
                        }
                    });
                });
            }

            _createIconButton(text, title, typeClass, onClick) {
                const btn = document.createElement('button');
                btn.className = `btn-icon ${typeClass}`;
                btn.textContent = text;
                btn.title = title;
                btn.addEventListener('click', onClick);
                return btn;
            }

            getDefaultFilename() {
                let filename = '';
                const nendo = this.state.attributes.find(a => a.name === '年度')?.value || '';
                const jigyo = this.state.attributes.find(a => a.name === '事業名')?.value || '';
                const owner = this.state.attributes.find(a => a.name === '所有者名')?.value || '';
                const biko = this.state.attributes.find(a => a.name === '備考')?.value || '';
                
                if (nendo) filename += nendo + '_';
                if (jigyo) filename += jigyo + '_';
                if (owner) filename += owner + '_';
                if (biko) filename += biko;
                
                return filename.replace(/_+$/, '') || 'GNSStoGIS_Export';
            }

            applyAttrPasteModal() {
                const text = this.els.attrPasteArea.value;
                if (!text.trim()) return this.showToast('データが入力されていません。');
                
                const lines = text.split(/\r?\n/).filter(line => line.trim());
                const isSingleCol = lines.every(line => line.split(/\t|,/).length === 1);
                
                if (isSingleCol) {
                    lines.forEach((line, i) => {
                        if (i < this.state.attributes.length) {
                            this.state.attributes[i].value = line.trim();
                        }
                    });
                } else {
                    this.state.attributes = [];
                    lines.forEach(line => {
                        const parts = line.split(/\t|,/).map(s => s.trim());
                        this.state.attributes.push({ name: parts[0] || '', value: parts[1] || '' });
                    });
                }
                
                this.updateAll();
                this.showToast('属性データを反映しました。');
                this._closeModal(this.els.attrPasteModal);
            }

            copyAttrToClipboard() {
                if (this.state.attributes.length === 0) return this.showToast('コピーするデータがありません。');
                let text = "";
                this.state.attributes.forEach(a => {
                    text += `${a.name}\t${a.value}\n`;
                });
                this._copyTextToClipboard(text.trimEnd(), '属性データをクリップボードにコピーしました。');
            }

            applySurveyPasteModal() {
                const text = this.els.surveyPasteArea.value;
                if (!text.trim()) return this.showToast('データが入力されていません。');
                
                const lines = text.split(/\r?\n/).filter(line => line.trim());
                let addedCount = 0;
                const newPointIds = [];
                
                lines.forEach(line => {
                    const parts = line.split(/\t|,/).map(s => s.trim());
                    if (parts.length >= 2) {
                        let name, lat, lng;
                        if (parts.length === 2) {
                            lat = parseFloat(parts[0]);
                            lng = parseFloat(parts[1]);
                            name = `${this.pointIdCounter}`;
                        } else {
                            name = parts[0];
                            lat = parseFloat(parts[1]);
                            lng = parseFloat(parts[2]);
                        }
                        if (!isNaN(lat) && !isNaN(lng)) {
                            const id = 'p' + this.pointIdCounter++;
                            this.state.points.push({ id, name, lat, lng });
                            newPointIds.push(id);
                            addedCount++;
                        }
                    }
                });
                
                if (addedCount > 0) {
                    let msg = `${addedCount}件の測点データを追加しました。`;
                    
                    if (this.els.chkPastePolygon.checked && newPointIds.length >= 3) {
                        for (let i = 0; i < newPointIds.length; i++) {
                            const id1 = newPointIds[i];
                            const id2 = newPointIds[(i + 1) % newPointIds.length];
                            const exists = this.state.edges.some(e => (e.from === id1 && e.to === id2) || (e.from === id2 && e.to === id1));
                            if (!exists) {
                                this.state.edges.push({ from: id1, to: id2 });
                            }
                        }
                        msg = `${addedCount}件の測点データを追加し、ポリゴンとして結線しました。`;
                    }

                    this.updateAll();
                    setTimeout(() => this.fitBoundsToPoints(true), 250);
                    this.showToast(msg);
                    this._closeModal(this.els.surveyPasteModal);
                } else {
                    this.showToast('有効なデータが見つかりませんでした。形式を確認してください。');
                }
            }

            copySurveyToClipboard() {
                if (this.state.points.length === 0) return this.showToast('コピーするデータがありません。');
                let text = "測点名\t緯度\t経度\n";
                this.state.points.forEach(p => {
                    text += `${p.name}\t${p.lat.toFixed(8)}\t${p.lng.toFixed(8)}\n`;
                });
                this._copyTextToClipboard(text, '測量データをクリップボードにコピーしました。');
            }

            renderAttrTable() {
                this.els.attrTableBody.innerHTML = '';
                this.state.attributes.forEach((attr, index) => {
                    const tr = document.createElement('tr');
                    
                    const createInputTd = (val, placeholder, onChange) => {
                        const td = document.createElement('td');
                        const inp = document.createElement('input');
                        inp.type = 'text'; inp.value = val; inp.placeholder = placeholder;
                        inp.addEventListener('input', onChange);
                        td.appendChild(inp);
                        return td;
                    };
                    
                    tr.appendChild(createInputTd(attr.name, '項目名', e => this.state.attributes[index].name = e.target.value));
                    tr.appendChild(createInputTd(attr.value, '値', e => this.state.attributes[index].value = e.target.value));
                    
                    const tdAction = document.createElement('td');
                    tdAction.appendChild(this._createIconButton('＋', '下に行を挿入', 'primary', () => {
                        this.state.attributes.splice(index + 1, 0, { name: '', value: '' });
                        this.renderAttrTable();
                    }));
                    tdAction.appendChild(this._createIconButton('－', 'この行を削除', 'danger', () => {
                        this.state.attributes.splice(index, 1);
                        this.renderAttrTable();
                    }));
                    
                    tr.appendChild(tdAction);
                    this.els.attrTableBody.appendChild(tr);
                });
            }

            renderTable() {
                this.els.tableBody.innerHTML = '';
                this.state.points.forEach((p, index) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td><input type="text" value="${p.name}" data-field="name"></td>
                        <td><input type="number" step="any" value="${p.lat.toFixed(6)}" data-field="lat"></td>
                        <td><input type="number" step="any" value="${p.lng.toFixed(6)}" data-field="lng"></td>
                        <td></td>
                    `;
                    
                    const tdAction = tr.querySelector('td:last-child');
                    tdAction.appendChild(this._createIconButton('＋', '下にポイントを複製して挿入', 'primary', () => {
                        const newPoint = { id: 'p' + this.pointIdCounter++, name: `${this.pointIdCounter - 1}`, lat: p.lat, lng: p.lng };
                        this.state.points.splice(index + 1, 0, newPoint);
                        this.updateAll();
                    }));
                    tdAction.appendChild(this._createIconButton('－', 'このポイントを削除', 'danger', () => {
                        this.deletePoint(p.id);
                    }));
                    
                    tr.querySelectorAll('input').forEach(inp => {
                        inp.addEventListener('change', (e) => {
                            const field = e.target.dataset.field;
                            p[field] = field === 'name' ? e.target.value : parseFloat(e.target.value) || p[field];
                            this.updateAll();
                        });
                    });

                    tr.addEventListener('click', (e) => {
                        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') this.map.panTo([p.lat, p.lng]);
                    });

                    this.els.tableBody.appendChild(tr);
                });
            }

            renderAreaResults() {
                if (this.state.areas.length === 0) {
                    this.els.areaResults.style.display = 'none';
                    return;
                }
                
                this.els.areaResults.style.display = 'block';
                let html = `
                    <div class="flex-row gap-2" style="margin-bottom: 2px;">
                        <div style="font-weight: bold; font-size: 0.75rem; color: #0f766e;">📐 区画ごとの面積</div>
                        <button id="btnCopyArea" class="btn-navy btn-xs" title="面積結果をクリップボードにコピー" style="height: 20px; font-size: 0.65rem; padding: 0 6px;">📋 コピー</button>
                    </div>
                `;
                let total = 0;
                
                this.state.areas.forEach((a, i) => {
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
                
                if (this.state.areas.length > 1) {
                    html += `<div class="area-item" style="background:#e0f2fe; border-color:#bae6fd; color:#0369a1; margin-top:2px; align-items: center;"><span>合計</span><strong>${total.toFixed(4)} ha</strong></div>`;
                }
                this.els.areaResults.innerHTML = html;

                document.getElementById('btnCopyArea').addEventListener('click', () => this.copyAreaToClipboard());
            }

            copyAreaToClipboard() {
                if (this.state.areas.length === 0) return this.showToast('コピーするデータがありません。');
                
                let text = "区画名\t面積(ha)\n";
                let total = 0;
                this.state.areas.forEach((a, i) => {
                    const ha = GeoUtils.m2ToHa(a.netArea);
                    total += ha;
                    text += `区画 ${i+1}\t${ha.toFixed(4)}\n`;
                    a.holes.forEach((h, j) => {
                        text += `(内 除地${j+1})\t${GeoUtils.m2ToHa(h.area).toFixed(4)}\n`;
                    });
                });
                if (this.state.areas.length > 1) {
                    text += `合計\t${total.toFixed(4)}\n`;
                }

                this._copyTextToClipboard(text, '面積結果をクリップボードにコピーしました。');
            }

            executeSaveJson() {
                const filename = document.getElementById('exportJsonFilename').value || this.getDefaultFilename();
                const data = {
                    points: this.state.points,
                    edges: this.state.edges.map(e => ({ from: e.from, to: e.to })),
                    attributes: this.state.attributes,
                    customTexts: this.state.customTexts,
                    customLines: this.state.customLines,
                    pointIdCounter: this.pointIdCounter
                };
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${filename}.json`;
                a.click();
                URL.revokeObjectURL(url);
                this.showToast('状況をJSONファイルで保存しました。');
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
                
                await this.handleFiles(files);
                event.target.value = '';
            }

            async handleFiles(files) {
                const jsonFiles = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.json'));
                
                if (jsonFiles.length === 0) {
                    this.showToast('JSONファイルが含まれていません。');
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
                    this.loadedFilesData = [];

                    results.forEach(res => {
                        try {
                            const data = JSON.parse(res.content);
                            if (data.points && data.edges) {
                                this.loadedFilesData.push({
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

                    if (this.loadedFilesData.length > 0) {
                        this.showLoadPreviewModal();
                    } else {
                        this.showToast('有効なデータを含むファイルがありませんでした。');
                    }
                } catch (error) {
                    console.error("File reading error:", error);
                    this.showToast('ファイルの読み込みに失敗しました。');
                }
            }

            showLoadPreviewModal() {
                this.els.previewFileList.innerHTML = '';
                
                this.loadedFilesData.forEach((fileData, index) => {
                    const li = document.createElement('li');
                    li.className = 'preview-file-item';
                    li.textContent = fileData.filename;
                    li.title = fileData.filename;
                    
                    li.onclick = () => this.selectPreviewFile(index);
                    li.ondblclick = () => {
                        this.selectPreviewFile(index);
                        this.applyLoadData();
                    };
                    
                    this.els.previewFileList.appendChild(li);
                });

                this.selectPreviewFile(0);
                this.els.loadPreviewModal.style.display = 'flex';
            }

            selectPreviewFile(index) {
                const listItems = this.els.previewFileList.querySelectorAll('.preview-file-item');
                listItems.forEach((li, i) => {
                    if (i === index) li.classList.add('active');
                    else li.classList.remove('active');
                });

                const data = this.loadedFilesData[index];
                this.pendingLoadData = data;

                const detector = new PolygonDetector(data.points, data.edges);
                const areas = detector.detect();

                this.els.previewMapContainer.innerHTML = this.generatePreviewSVG(data.points, data.edges, areas, data);

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

                this.els.previewInfo.innerHTML = `
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
                if (!this.pendingLoadData) return;
                
                this.state.points = this.pendingLoadData.points;
                this.state.edges = this.pendingLoadData.edges;
                this.state.attributes = this.pendingLoadData.attributes;
                this.state.customTexts = this.pendingLoadData.customTexts || [];
                this.state.customLines = this.pendingLoadData.customLines || [];
                this.pointIdCounter = this.pendingLoadData.pointIdCounter;
                
                this.updateAll();
                setTimeout(() => this.fitBoundsToPoints(true), 250);
                
                this.showToast('JSONファイルを読み込みました。');
                this.pendingLoadData = null;
                this._closeModal(this.els.loadPreviewModal);
            }

            executeExportGeoJSON() {
                const filename = document.getElementById('exportGeoJsonFilename').value || this.getDefaultFilename();
                const features = [];
                const customProps = {};
                this.state.attributes.forEach(attr => { if (attr.name) customProps[attr.name] = attr.value; });
                
                this.state.areas.forEach((a, i) => {
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

                this.state.edges.forEach(e => {
                    const p1 = this.getPoint(e.from), p2 = this.getPoint(e.to);
                    if (p1 && p2) features.push({
                        type: "Feature", properties: { "結線": `${p1.name} - ${p2.name}`, ...customProps },
                        geometry: { type: "LineString", coordinates: [[p1.lng, p1.lat], [p2.lng, p2.lat]] }
                    });
                });

                this.state.points.forEach(p => features.push({
                    type: "Feature", properties: { "測点名": p.name, "緯度": p.lat, "経度": p.lng, ...customProps },
                    geometry: { type: "Point", coordinates: [p.lng, p.lat] }
                }));

                this.state.customLines.forEach((l, i) => {
                    features.push({
                        type: "Feature", properties: { "種別": "自由線", "id": l.id, "太さ": l.weight || 2, "色": l.color || '#333333', "線種": l.dashArray || '実線', ...customProps },
                        geometry: { type: "LineString", coordinates: l.latlngs.map(latlng => [latlng[1], latlng[0]]) }
                    });
                });

                this.state.customTexts.forEach(t => {
                    features.push({
                        type: "Feature", properties: { "種別": "テキスト", "テキスト": t.text, ...customProps },
                        geometry: { type: "Point", coordinates: [t.lng, t.lat] }
                    });
                });

                const blob = new Blob([JSON.stringify({ type: "FeatureCollection", features: features }, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = `${filename}.geojson`;
                a.click(); URL.revokeObjectURL(url);
                this.showToast('GeoJSONを出力しました。');
            }

            openPrintLayoutWindow() {
                if (this.state.points.length === 0) return this.showToast('出力するデータがありません。');
                
                const win = window.open('', '_blank');
                if (!win) return this.showToast('ポップアップブロックを解除して、もう一度お試しください。');

                const filename = this.getDefaultFilename();
                
                let currentTileUrl = 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png';
                if (this.map) {
                    this.map.eachLayer(layer => {
                        if (layer instanceof L.TileLayer) {
                            currentTileUrl = layer._url;
                        }
                    });
                }
                const isBgVisible = this.state.isMapView;

                const exportData = {
                    points: this.state.points,
                    edges: this.state.edges,
                    areas: this.state.areas,
                    customTexts: this.state.customTexts,
                    customLines: this.state.customLines,
                    attributes: this.state.attributes,
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
                    "            <option value='auto'>平面直角座標 (自動選択)</option>",
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
                    "        const zoneVal = document.getElementById('dxfZone').value;",
                    "        const dxf = new SimpleDxfWriter();",
                    "        let p0 = {lat: 35, lng: 139};",
                    "        if (APP_DATA.points && APP_DATA.points.length > 0) p0 = APP_DATA.points[0];",
                    "        else if (APP_DATA.customLines && APP_DATA.customLines.length > 0) p0 = {lat: APP_DATA.customLines[0].latlngs[0][0], lng: APP_DATA.customLines[0].latlngs[0][1]};",
                    "        else if (APP_DATA.areas && APP_DATA.areas.length > 0) p0 = {lat: APP_DATA.areas[0].coords[0][0], lng: APP_DATA.areas[0].coords[0][1]};",
                    "        let zoneIndex = 0;",
                    "        if (zoneVal === 'auto') {",
                    "            const lat = p0.lat, lng = p0.lng;",
                    "            if (lat < 30) {",
                    "                if (lng > 150) zoneIndex = 19;",
                    "                else if (lng > 140) zoneIndex = 14;",
                    "                else if (lng > 133) zoneIndex = 18;",
                    "                else if (lng > 129) zoneIndex = 17;",
                    "                else if (lng > 126) zoneIndex = 15;",
                    "                else zoneIndex = 16;",
                    "            } else if (lat >= 41.3) {",
                    "                if (lng < 141) zoneIndex = 11;",
                    "                else if (lng < 143) zoneIndex = 12;",
                    "                else zoneIndex = 13;",
                    "            } else if (lat >= 39) { zoneIndex = 10; }",
                    "            else if (lng >= 139.5) { zoneIndex = 9; }",
                    "            else if (lng >= 137.8) { zoneIndex = 8; }",
                    "            else if (lng >= 136.5) { zoneIndex = 7; }",
                    "            else if (lng >= 134.8) { zoneIndex = 6; }",
                    "            else if (lng >= 133.5) { zoneIndex = (lat < 34.5) ? 4 : 5; }",
                    "            else if (lng >= 131.5) { zoneIndex = (lat < 34.5) ? 4 : 3; }",
                    "            else if (lng >= 130.2) { zoneIndex = 2; }",
                    "            else { zoneIndex = 1; }",
                    "        } else {",
                    "            zoneIndex = parseInt(zoneVal);",
                    "        }",
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

            addDemoData() {
                const defaultData = {
                  "points": [
                    {"id": "p1", "name": "1", "lat": 34.13404829, "lng": 135.5017165},
                    {"id": "p2", "name": "2", "lat": 34.13433871, "lng": 135.5018832},
                    {"id": "p3", "name": "3", "lat": 34.13418358, "lng": 135.5022936},
                    {"id": "p4", "name": "4", "lat": 34.13405929, "lng": 135.5025381},
                    {"id": "p5", "name": "5", "lat": 34.13400244, "lng": 135.5026457},
                    {"id": "p6", "name": "6", "lat": 34.13376205, "lng": 135.5028236},
                    {"id": "p7", "name": "7", "lat": 34.13341211, "lng": 135.5030163},
                    {"id": "p8", "name": "8", "lat": 34.13321849, "lng": 135.5032157},
                    {"id": "p9", "name": "9", "lat": 34.13311732, "lng": 135.5032452},
                    {"id": "p10", "name": "10", "lat": 34.13292034, "lng": 135.503339},
                    {"id": "p11", "name": "11", "lat": 34.13273933, "lng": 135.5034836},
                    {"id": "p12", "name": "12", "lat": 34.1326124, "lng": 135.5035013},
                    {"id": "p13", "name": "13", "lat": 34.13254633, "lng": 135.5033672},
                    {"id": "p14", "name": "14", "lat": 34.13241911, "lng": 135.503195},
                    {"id": "p15", "name": "15", "lat": 34.13242275, "lng": 135.5030156},
                    {"id": "p16", "name": "16", "lat": 34.13240737, "lng": 135.5027221},
                    {"id": "p17", "name": "17", "lat": 34.1323301, "lng": 135.5023658},
                    {"id": "p18", "name": "18", "lat": 34.13224491, "lng": 135.5021522},
                    {"id": "p19", "name": "19", "lat": 34.13218441, "lng": 135.5019085},
                    {"id": "p20", "name": "20", "lat": 34.13234878, "lng": 135.5016766},
                    {"id": "p21", "name": "21", "lat": 34.13247685, "lng": 135.5014894},
                    {"id": "p22", "name": "22", "lat": 34.13253097, "lng": 135.5015774},
                    {"id": "p23", "name": "23", "lat": 34.13260999, "lng": 135.5016615},
                    {"id": "p24", "name": "24", "lat": 34.13267637, "lng": 135.5017693},
                    {"id": "p25", "name": "25", "lat": 34.13276028, "lng": 135.5018834},
                    {"id": "p26", "name": "26", "lat": 34.13285292, "lng": 135.5019102},
                    {"id": "p27", "name": "27", "lat": 34.13295731, "lng": 135.5019728},
                    {"id": "p28", "name": "28", "lat": 34.13312587, "lng": 135.5020486},
                    {"id": "p29", "name": "29", "lat": 34.13329049, "lng": 135.5020538},
                    {"id": "p30", "name": "30", "lat": 34.13348977, "lng": 135.5019688},
                    {"id": "p31", "name": "31", "lat": 34.13370562, "lng": 135.5018919},
                    {"id": "p32", "name": "32", "lat": 34.13382126, "lng": 135.501866},
                    {"id": "p33", "name": "33", "lat": 34.13392602, "lng": 135.5017583},
                    {"id": "p34", "name": "34", "lat": 34.13400221, "lng": 135.5017623},
                    {"id": "p35", "name": "35", "lat": 34.13324823, "lng": 135.50239081},
                    {"id": "p36", "name": "36", "lat": 34.13346581, "lng": 135.50275019},
                    {"id": "p37", "name": "37", "lat": 34.13306627, "lng": 135.50301302},
                    {"id": "p38", "name": "38", "lat": 34.13302183, "lng": 135.502423},
                    {"id": "p39", "name": "39", "lat": 34.134438, "lng": 135.50216017},
                    {"id": "p40", "name": "40", "lat": 34.13444688, "lng": 135.50249273},
                    {"id": "p41", "name": "41", "lat": 34.13474875, "lng": 135.50250345},
                    {"id": "p42", "name": "42", "lat": 34.13477983, "lng": 135.50300766},
                    {"id": "p43", "name": "43", "lat": 34.13448684, "lng": 135.50302911},
                    {"id": "p44", "name": "45", "lat": 34.13370109, "lng": 135.50160233},
                    {"id": "p45", "name": "46", "lat": 34.13359898, "lng": 135.50132877},
                    {"id": "p46", "name": "47", "lat": 34.13341254, "lng": 135.5011464}
                  ],
                  "edges": [
                    {"from": "p1", "to": "p2"}, {"from": "p2", "to": "p3"}, {"from": "p3", "to": "p4"}, {"from": "p4", "to": "p5"},
                    {"from": "p5", "to": "p6"}, {"from": "p6", "to": "p7"}, {"from": "p7", "to": "p8"}, {"from": "p8", "to": "p9"},
                    {"from": "p9", "to": "p10"}, {"from": "p10", "to": "p11"}, {"from": "p11", "to": "p12"}, {"from": "p12", "to": "p13"},
                    {"from": "p13", "to": "p14"}, {"from": "p14", "to": "p15"}, {"from": "p15", "to": "p16"}, {"from": "p16", "to": "p17"},
                    {"from": "p17", "to": "p18"}, {"from": "p18", "to": "p19"}, {"from": "p19", "to": "p20"}, {"from": "p20", "to": "p21"},
                    {"from": "p21", "to": "p22"}, {"from": "p22", "to": "p23"}, {"from": "p23", "to": "p24"}, {"from": "p24", "to": "p25"},
                    {"from": "p25", "to": "p26"}, {"from": "p26", "to": "p27"}, {"from": "p27", "to": "p28"}, {"from": "p28", "to": "p29"},
                    {"from": "p29", "to": "p30"}, {"from": "p30", "to": "p31"}, {"from": "p31", "to": "p32"}, {"from": "p32", "to": "p33"},
                    {"from": "p33", "to": "p34"}, {"from": "p34", "to": "p1"}, {"from": "p35", "to": "p36"}, {"from": "p36", "to": "p37"},
                    {"from": "p37", "to": "p38"}, {"from": "p38", "to": "p35"}, {"from": "p39", "to": "p40"}, {"from": "p40", "to": "p41"},
                    {"from": "p41", "to": "p42"}, {"from": "p42", "to": "p43"}, {"from": "p44", "to": "p45"}, {"from": "p45", "to": "p46"},
                    {"from": "p44", "to": "p32"}, {"from": "p2", "to": "p39"}, {"from": "p40", "to": "p43"}, {"from": "p29", "to": "p6"}
                  ],
                  "customTexts": [],
                  "customLines": [],
                  "attributes": [
                    { "name": "年度", "value": "令和8年度" },
                    { "name": "事業名", "value": "育成複層林整備" },
                    { "name": "所有者名", "value": "山田太郎" },
                    { "name": "備考", "value": "No.10" }
                  ],
                  "pointIdCounter": 47
                };

                this.state.points = defaultData.points;
                this.state.edges = defaultData.edges;
                this.state.attributes = defaultData.attributes;
                this.state.customTexts = defaultData.customTexts;
                this.state.customLines = defaultData.customLines;
                this.pointIdCounter = defaultData.pointIdCounter;

                this.updateAll();
                setTimeout(() => this.fitBoundsToPoints(true), 250);
            }
        }