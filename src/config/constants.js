export const APP_CONFIG = {
            MAP: {
                DEFAULT_CENTER: [34.133, 135.502],
                DEFAULT_ZOOM: 17,
                TILE_STD: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
                TILE_PHOTO: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
                TILE_PALE: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
                ATTRIBUTION: '国土地理院'
            },
            COLORS: {
                polyFill: '#6366f1', polyBorder: '#4f46e5',
                line: '#0ea5e9', lineHover: '#ef4444', rubberBand: '#f59e0b',
                pointFill: '#ffffff', pointHoverFill: '#fef3c7', pointSelected: '#f59e0b',
                pointBorder: '#4f46e5', pointBorderSelected: '#d97706'
            },
            MODES: { SELECT: 'SELECT', ADD: 'ADD', LINE: 'LINE', DRAW_LINE: 'DRAW_LINE', ADD_TEXT: 'ADD_TEXT' },
            DEFAULT_ATTRIBUTES: [
                { name: '年度', value: '令和8年度' },
                { name: '事業名', value: '育成複層林整備' },
                { name: '所有者名', value: '山田太郎' },
                { name: '備考', value: 'No.10' }
            ],
            STORAGE_KEY: 'gnss_survey_data'
        };

        // ==========================================
        // ユーティリティ・計算エンジン
        // ==========================================