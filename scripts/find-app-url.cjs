const fs = require('fs');
const p = process.env.LOCALAPPDATA + '/Google/Chrome/User Data/Default/Preferences';
if (fs.existsSync(p)) {
  const content = fs.readFileSync(p, 'utf8');
  const idx = content.indexOf('pkojibjnhbhpaihkednmkdnldiecncfe');
  if (idx !== -1) {
    console.log('Snippet:', content.substring(Math.max(0, idx - 200), idx + 400));
  } else {
    console.log('No encontrada en Preferences');
  }
}
