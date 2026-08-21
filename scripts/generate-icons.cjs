const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const logoFile = path.resolve(__dirname, '../public/logo.png');
    const logoBase64 = fs.readFileSync(logoFile).toString('base64');
    const dataUri = `data:image/png;base64,${logoBase64}`;

    const sizes = [16, 32, 48, 72, 96, 128, 144, 192, 256, 384, 512];

    for (const size of sizes) {
      await page.setViewportSize({ width: size, height: size });
      await page.setContent(`
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              * { margin: 0; padding: 0; box-sizing: border-box; }
              html, body { width: ${size}px; height: ${size}px; overflow: hidden; background: transparent; }
              img { width: ${size}px; height: ${size}px; object-fit: contain; }
            </style>
          </head>
          <body>
            <img src="${dataUri}" />
          </body>
        </html>
      `);
      const outPath = path.resolve(__dirname, `../public/icon-${size}.png`);
      await page.screenshot({ path: outPath, omitBackground: true });
      console.log(`Generado: icon-${size}.png (${size}x${size})`);
    }

    // Copiar icon-32.png como favicon.png
    fs.copyFileSync(
      path.resolve(__dirname, '../public/icon-32.png'),
      path.resolve(__dirname, '../public/favicon.png')
    );

    // Copiar icon-192.png como apple-touch-icon.png
    fs.copyFileSync(
      path.resolve(__dirname, '../public/icon-192.png'),
      path.resolve(__dirname, '../public/apple-touch-icon.png')
    );

    await browser.close();
    console.log('¡Todos los iconos fueron generados exitosamente!');
  } catch (err) {
    console.error('Error generando iconos:', err);
    process.exit(1);
  }
})();
