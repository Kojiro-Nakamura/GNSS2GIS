import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
    try {
        const browser = await puppeteer.launch({
            executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
            headless: 'new'
        });
        const page = await browser.newPage();
        
        const server = http.createServer((req, res) => {
            let filePath = path.join(__dirname, '..', 'dist', req.url === '/' ? 'index.html' : req.url);
            if (fs.existsSync(filePath)) {
                res.writeHead(200);
                res.end(fs.readFileSync(filePath));
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        server.listen(3000);
        console.log('Server started');

        let popupOpened = false;

        browser.on('targetcreated', async (target) => {
            if (target.type() === 'page' ) {
                const newPage = await target.page();
                console.log('New window opened: ' + target.url());
                popupOpened = true;
                newPage.on('console', msg => console.log('POPUP LOG:', msg.text()));
                newPage.on('pageerror', err => console.log('POPUP ERROR:', err.toString()));
                
                await wait(2000); // let the popup render
                
                const html = await newPage.content();
                fs.writeFileSync('scratch/popup.html', html);
                
                await newPage.evaluate(() => {
                    console.log('EVALUATING POPUP');
                    const plMap = document.getElementById('pl-map');
                    if (plMap) {
                        const rect = plMap.getBoundingClientRect();
                        console.log('pl-map rect:', rect.x, rect.y, rect.width, rect.height);
                        console.log('pl-map z-index:', window.getComputedStyle(plMap).zIndex);
                        console.log('pl-map pointer-events:', window.getComputedStyle(plMap).pointerEvents);

                        const svg = plMap.querySelector('svg');
                        if (svg) {
                            console.log('svg rect:', svg.getBoundingClientRect().width, svg.getBoundingClientRect().height);
                            console.log('svg pointer-events:', window.getComputedStyle(svg).pointerEvents);
                            console.log('svg z-index:', window.getComputedStyle(svg).zIndex);
                        }

                        const cropper = document.getElementById('map-cropper');
                        if (cropper) {
                            console.log('cropper rect:', cropper.getBoundingClientRect().width, cropper.getBoundingClientRect().height);
                            console.log('cropper pointer-events:', window.getComputedStyle(cropper).pointerEvents);
                            console.log('cropper bg:', window.getComputedStyle(cropper).backgroundColor);
                        }
                        
                        // Check what element receives a click at the center
                        const centerX = rect.x + rect.width / 2;
                        const centerY = rect.y + rect.height / 2;
                        const elAtCenter = document.elementFromPoint(centerX, centerY);
                        if (elAtCenter) {
                            console.log('Element at center:', elAtCenter.tagName, elAtCenter.className, elAtCenter.id);
                        }
                        
                        // SIMULATE A DRAG on pl-map directly to see if it registers
                        console.log('SIMULATING DRAG...');
                        const mousedown = new MouseEvent('mousedown', { clientX: centerX, clientY: centerY, bubbles: true });
                        elAtCenter.dispatchEvent(mousedown);
                        
                        const mousemove = new MouseEvent('mousemove', { clientX: centerX + 50, clientY: centerY + 50, bubbles: true });
                        document.dispatchEvent(mousemove);
                        
                        const mouseup = new MouseEvent('mouseup', { clientX: centerX + 50, clientY: centerY + 50, bubbles: true });
                        document.dispatchEvent(mouseup);
                        
                        console.log('After drag, plMap left:', plMap.style.left, 'top:', plMap.style.top);
                        
                    } else {
                        console.log('pl-map NOT FOUND!');
                    }
                });
                
                server.close();
                await browser.close();
                process.exit(0);
            }
        });
        
        await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle0' });
        console.log('Main page loaded');
        page.on('console', msg => console.log('MAIN LOG:', msg.text()));
        page.on('pageerror', err => console.log('MAIN ERROR:', err.toString()));
        
        await wait(2000);
        
        await page.evaluate(() => {
            // Find the btnExportHtml button and click it!
            window.APP_DATA = { points: [{lat: 35, lng: 139, id: '1', name: 'A'}], edges: [], areas: [], attributes: [], settings: { mapBg: true } };
            const btn = document.getElementById('btnExportHtml');
            if(btn) {
                console.log('Clicking print layout button...');
                btn.click();
            } else {
                console.log('BTN NOT FOUND');
            }
        });
        
        await wait(5000);
        if (!popupOpened) {
            console.log('Popup never opened or intercepted.');
        }
        server.close();
        await browser.close();
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
