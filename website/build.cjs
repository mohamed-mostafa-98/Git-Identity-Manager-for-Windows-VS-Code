const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '_site');
fs.mkdirSync(path.join(output, 'presentation'), { recursive: true });
for (const file of ['index.html', 'styles.css']) fs.copyFileSync(path.join(__dirname, file), path.join(output, file));
for (const file of ['index.html', 'slides.js', 'client-walkthrough.pdf']) fs.copyFileSync(path.join(root, 'presentation', file), path.join(output, 'presentation', file));
fs.writeFileSync(path.join(output, '.nojekyll'), '');
console.log('Built website and presentation in _site.');
