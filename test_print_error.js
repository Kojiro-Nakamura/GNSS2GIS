import puppeteer from 'puppeteer';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    await page.goto('http://localhost:3000/');
    
    await page.waitForSelector('#btnExport');
    
    // In GNSStoGIS02 there's a btnPrint
    // The print window opens in a new tab, we need to catch it
    browser.on('targetcreated', async target => {
        if (target.type() === 'page') {
            const newPage = await target.page();
            newPage.on('console', msg => console.log('NEW PAGE LOG:', msg.text()));
            newPage.on('pageerror', error => console.log('NEW PAGE ERROR:', error.message));
        }
    });

    await page.evaluate(() => {
        // Trigger print layout
        document.getElementById('btnPrint').click();
    });

    await new Promise(r => setTimeout(r, 2000));
    await browser.close();
})();
