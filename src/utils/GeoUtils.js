export class GeoUtils {
            static LAT_DEG_PER_METER = 1 / 111111;
            static getLonDegPerMeter(lat) { return this.LAT_DEG_PER_METER / Math.cos(lat * Math.PI / 180); }

            // m2からhaに変換し、小数第5位を四捨五入して数値を返す
            static m2ToHa(sqMeters) {
                const ha = sqMeters / 10000;
                return Math.round((ha + Number.EPSILON) * 10000) / 10000;
            }

            // Ray-casting アルゴリズムによる点包含判定
            static isPointInPolygon(point, polygonCoords) {
                let x = point.lng, y = point.lat, inside = false;
                for (let i = 0, j = polygonCoords.length - 1; i < polygonCoords.length; j = i++) {
                    let xi = polygonCoords[i][1], yi = polygonCoords[i][0];
                    let xj = polygonCoords[j][1], yj = polygonCoords[j][0];
                    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                    if (intersect) inside = !inside;
                }
                return inside;
            }

            // 指定した中心点を基準に回転させる
            static rotatePoint(lat, lng, centerLat, centerLng, angleDeg) {
                const angleRad = angleDeg * Math.PI / 180;
                const latPerM = this.LAT_DEG_PER_METER;
                const lngPerM = this.getLonDegPerMeter(centerLat);

                const dy = (lat - centerLat) / latPerM;
                const dx = (lng - centerLng) / lngPerM;

                const nx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
                const ny = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

                return [centerLat + ny * latPerM, centerLng + nx * lngPerM];
            }
        }