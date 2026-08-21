const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const messages = [];
  page.on('console', msg => messages.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => messages.push({ type: 'pageerror', text: err.message }));
  page.on('requestfailed', req => messages.push({ type: 'requestfailed', url: req.url(), failure: req.failure() }));

  // Vamos a cargar el HTML build o dev
  // Servidor http simple para public + dist
  const express = require('http');
  const fs = require('fs');

  const server = express.createServer((req, res) => {
    let filePath = path.join(__dirname, '../public', req.url === '/' ? 'index.html' : req.url);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(__dirname, '../index.html');
    }
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.json': 'application/manifest+json',
      '.webmanifest': 'application/manifest+json',
      '.png': 'image/png',
      '.ico': 'image/x-icon',
      '.js': 'application/javascript',
      '.css': 'text/css'
    };
    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  });

  server.listen(5199, async () => {
    await page.goto('http://localhost:5199');
    console.log('Pagina cargada');
    console.log('Mensajes consola:', messages);

    // Verificar manifest
    const manifestUrl = await page.evaluate(() => {
      const link = document.querySelector('link[rel="manifest"]');
      return link ? link.href : null;
    });
    console.log('Manifest URL:', manifestUrl);

    if (manifestUrl) {
      const resp = await page.goto(manifestUrl);
      const manifestJson = await resp.json();
      console.log('Manifest parsed:', manifestJson.short_name, 'Iconos:', manifestJson.icons.length);
    }

    server.close();
    await browser.close();
  });
})();
