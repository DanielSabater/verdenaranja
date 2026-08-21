const fs = require('fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const buf = fs.readFileSync('./public/logo.png');
  const base64 = buf.toString('base64');
  await page.setContent(`<img id="img" src="data:image/png;base64,${base64}" />`);
  const info = await page.evaluate(() => {
    const img = document.getElementById('img');
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let transparentPixels = 0;
    let opaquePixels = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] < 10) transparentPixels++;
      else opaquePixels++;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      transparent: transparentPixels,
      opaque: opaquePixels,
      corners: [
        [data[0], data[1], data[2], data[3]],
        [data[4], data[5], data[6], data[7]]
      ]
    };
  });
  console.log('Info logo:', JSON.stringify(info, null, 2));
  await browser.close();
})();
