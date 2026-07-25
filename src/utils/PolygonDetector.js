import { GeoUtils } from './GeoUtils.js';

export class PolygonDetector {
            constructor(points, edges) { this.points = points; this.edges = edges; }
            
            detect() {
                if (this.points.length < 3 || this.edges.length < 3) return [];
                const p0 = this.points[0];
                const lonDegPerMeter = GeoUtils.getLonDegPerMeter(p0.lat);
                const nodes = this._buildNodes(p0, lonDegPerMeter);
                const adj = this._buildAdjacencyList(nodes);
                const faces = this._findFaces(nodes, adj, p0, lonDegPerMeter);
                return this._buildHierarchy(faces);
            }

            _buildNodes(p0, lonDegPerMeter) {
                const nodes = new Map();
                this.points.forEach(p => {
                    nodes.set(p.id, {
                        id: p.id, lat: p.lat, lng: p.lng,
                        x: (p.lng - p0.lng) / lonDegPerMeter, y: (p.lat - p0.lat) / GeoUtils.LAT_DEG_PER_METER
                    });
                });
                return nodes;
            }

            _buildAdjacencyList(nodes) {
                const adj = new Map();
                const addEdge = (u, v) => {
                    if (!adj.has(u)) adj.set(u, []);
                    const nU = nodes.get(u), nV = nodes.get(v);
                    if (nU && nV) adj.get(u).push({ id: v, angle: Math.atan2(nV.y - nU.y, nV.x - nU.x) });
                };
                this.edges.forEach(e => { addEdge(e.from, e.to); addEdge(e.to, e.from); });
                for (let [, neighbors] of adj) neighbors.sort((a, b) => a.angle - b.angle);
                return adj;
            }

            _findFaces(nodes, adj, p0, lonDegPerMeter) {
                const visitedHalfEdges = new Set(), allFaces = [];
                this.edges.forEach(edge => {
                    [{from: edge.from, to: edge.to}, {from: edge.to, to: edge.from}].forEach(he => {
                        if (visitedHalfEdges.has(`${he.from}|${he.to}`)) return;
                        
                        const currentFace = [];
                        let currU = he.from, currV = he.to, isClosed = false, steps = 0;
                        const maxSteps = this.edges.length * 2;

                        while (!visitedHalfEdges.has(`${currU}|${currV}`) && steps < maxSteps) {
                            visitedHalfEdges.add(`${currU}|${currV}`);
                            currentFace.push(currU);
                            const neighbors = adj.get(currV);
                            if (!neighbors) break;
                            const idx = neighbors.findIndex(n => n.id === currU);
                            if (idx === -1) break;

                            const nextV = neighbors[(idx - 1 + neighbors.length) % neighbors.length].id;
                            currU = currV; currV = nextV; steps++;
                            if (currU === he.from && currV === he.to) { isClosed = true; break; }
                        }
                        if (isClosed && currentFace.length >= 3) {
                            const faceData = this._calculateFaceProperties(currentFace, nodes, p0, lonDegPerMeter);
                            if (faceData) allFaces.push(faceData);
                        }
                    });
                });
                return allFaces;
            }

            _calculateFaceProperties(currentFace, nodes, p0, lonDegPerMeter) {
                let signedArea = 0, cx = 0, cy = 0;
                const pts = currentFace.map(id => nodes.get(id)), coords = [];
                for (let i = 0; i < pts.length; i++) {
                    const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                    const a = (p1.x * p2.y - p2.x * p1.y);
                    signedArea += a; cx += (p1.x + p2.x) * a; cy += (p1.y + p2.y) * a;
                    coords.push([p1.lat, p1.lng]);
                }
                signedArea /= 2;
                if (signedArea > 1) { 
                    cx /= (6 * signedArea); cy /= (6 * signedArea);
                    return { 
                        path: currentFace, area: signedArea, coords: coords,
                        center: { lat: p0.lat + cy * GeoUtils.LAT_DEG_PER_METER, lng: p0.lng + cx * lonDegPerMeter }
                    };
                }
                return null;
            }

            _buildHierarchy(allFaces) {
                allFaces.sort((a, b) => b.area - a.area);
                const isPolyInside = (inner, outer) => GeoUtils.isPointInPolygon(inner.center, outer.coords);
                
                allFaces.forEach((poly, i) => {
                    poly.children = []; poly.parent = null;
                    for (let j = i - 1; j >= 0; j--) {
                        if (isPolyInside(poly, allFaces[j])) {
                            poly.parent = allFaces[j];
                            allFaces[j].children.push(poly);
                            break;
                        }
                    }
                });

                const complexAreas = [];
                const buildAreas = (poly, depth) => {
                    if (depth % 2 === 0) {
                        let innerArea = 0;
                        poly.children.forEach(child => innerArea += child.area);
                        poly.netArea = poly.area - innerArea;
                        poly.holes = poly.children;
                        complexAreas.push(poly);
                    }
                    poly.children.forEach(child => buildAreas(child, depth + 1));
                };
                allFaces.filter(p => p.parent === null).forEach(rootPoly => buildAreas(rootPoly, 0));
                return complexAreas;
            }
        }

        // ==========================================
        // メインアプリケーション
        // ==========================================