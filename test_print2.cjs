const fs = require('fs');
const puppeteer = require('puppeteer-core');

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            headless: 'new'
        });
        const page = await browser.newPage();
        
        page.on('console', msg => console.log('MAIN PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('MAIN PAGE ERROR:', err.toString()));
        
        // Listen for new targets (popups/new windows)
        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page') {
                const newPage = await target.page();
                console.log('New window opened!');
                newPage.on('console', msg => console.log('POPUP LOG:', msg.text()));
                newPage.on('pageerror', err => console.log('POPUP ERROR:', err.toString()));
                
                await newPage.waitForTimeout(1000);
                
                const html = await newPage.content();
                fs.writeFileSync('dist/popup.html', html);
                console.log('Popup HTML saved.');
                
                // try to click print button!
                await newPage.evaluate(() => {
                    console.log('Popup: trying to click btnPrint');
                    const btn = document.getElementById('btnPrint');
                    if(btn) {
                        btn.click();
                        console.log('Popup: clicked btnPrint');
                    } else {
                        console.log('Popup: btnPrint NOT FOUND!');
                    }
                });
            }
        });
        
        await page.goto('file:///' + __dirname.replace(/\\/g, '/') + '/dist/index.html', { waitUntil: 'networkidle0' });
        
        console.log('Page loaded. Clicking print button...');
        await page.waitForTimeout(1000);
        
        // Setup data without points
        await page.evaluate(() => {
            window.APP_DATA = { points: [], edges: [], areas: [], customLines: [], bgLayerUrl: null };
            const chkBg = document.getElementById('chkImageBg');
            if(chkBg) chkBg.checked = true; // Use image background mode (isMapView = false)
            
            const app = document.querySelector('gnss-mapping-app');
            if(app) {
                app.isMapView = false;
                app.openPrintLayoutWindow();
            }
        });
        
        await page.waitForTimeout(3000);
        await browser.close();
    } catch (e) {
        console.error(e);
    }
})();
