const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logoFile = path.resolve(__dirname, '../public/logo.png');
  const logoBase64 = fs.readFileSync(logoFile).toString('base64');
  const dataUri = `data:image/png;base64,${logoBase64}`;

  // 1. Iconos "any" (transparentes, centrados)
  for (const size of [192, 512, 180, 144, 96, 48, 32, 16]) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; }
            html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
            img { width: 100%; height: 100%; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${dataUri}" />
        </body>
      </html>
    `);
    const outPath = path.resolve(__dirname, `../public/icon-${size}.png`);
    await page.screenshot({ path: outPath, omitBackground: true });
    console.log(`Generado: icon-${size}.png`);
  }

  // 2. Iconos "maskable" (con safe zone 80% y fondo #ffffff o tema)
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    const pad = Math.round(size * 0.1);
    const imgSize = size - (pad * 2);
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            * { margin: 0; padding: 0; }
            html, body { 
              width: ${size}px; 
              height: ${size}px; 
              overflow: hidden; 
              background: #ffffff; 
              display: flex; 
              align-items: center; 
              justify-content: center; 
            }
            img { width: ${imgSize}px; height: ${imgSize}px; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${dataUri}" />
        </body>
      </html>
    `);
    const outPath = path.resolve(__dirname, `../public/icon-maskable-${size}.png`);
    await page.screenshot({ path: outPath });
    console.log(`Generado: icon-maskable-${size}.png`);
  }

  await browser.close();
  console.log('¡Iconos generados exitosamente!');
})();
