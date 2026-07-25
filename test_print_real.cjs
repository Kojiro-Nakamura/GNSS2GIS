const fs = require('fs');
const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            headless: 'new',
            args: ['--disable-popup-blocking']
        });
        
        // Setup listener for new targets BEFORE opening the page
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                console.log('New window/popup opened!');
                
                newPage.on('console', msg => console.log('POPUP LOG:', msg.text()));
                newPage.on('pageerror', err => console.log('POPUP ERROR:', err.toString()));
                
                await new Promise(r => setTimeout(r, 2000));
                const html = await newPage.content();
                fs.writeFileSync('dist/popup.html', html);
                console.log('Popup HTML saved.');
                await new Promise(r => setTimeout(r, 1000));
                await newPage.screenshot({path: 'dist/popup-test.png'});
                console.log('Popup HTML saved.');
            }
        });

        const page = await browser.newPage();
        page.on('console', msg => console.log('MAIN PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('MAIN PAGE ERROR:', err.toString()));
        
        await page.goto('http://localhost:8080/', { waitUntil: 'networkidle0' });
        
        console.log('Page loaded. Adding dummy data...');
        
        // Add a line so that calcAutoScale logic runs
        await page.evaluate(() => {
            const app = document.querySelector('gnss-mapping-app');
            if(app) {
                app.state.customLines.push({
                    id: 'l1',
                    latlngs: [[35.0, 139.0], [35.001, 139.001]],
                    type: 'straight'
                });
                app.isMapView = false;
            }
        });

        console.log('Clicking the "平面図出力" button...');
        // Find the button and click it
        await page.evaluate(() => {
            window.APP_DATA = { points: [{lat: 35, lng: 139, id: '1', name: 'A'}], edges: [], areas: [], customLines: [], customTexts: [], attributes: [] };
            const buttons = Array.from(document.querySelectorAll('button'));
            const btn = buttons.find(b => b.textContent.includes('平面図出力'));
            if(btn) {
                console.log('Found print button! Clicking...');
                btn.click();
            } else {
                console.log('Print button not found!');
            }
        });
        
        await new Promise(r => setTimeout(r, 4000));
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
