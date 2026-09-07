const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const site = path.join(root, '_site');
for (const name of ['index.html', 'presentation/index.html']) {
    const file = path.join(site, name);
    const html = fs.readFileSync(file, 'utf8');
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, 'Duplicate IDs');
    for (const [, href] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
        if (href === '#') continue;
        if (href.startsWith('#')) { assert(ids.includes(href.slice(1)), href); continue; }
        if (href.startsWith('https://')) {
            const match = href.match(/Git-Identity-Manager-for-Windows-VS-Code\/(?:blob\/main|raw\/refs\/heads\/main)\/(.+)$/);
            if (match) assert(fs.existsSync(path.join(root, match[1])), href);
            continue;
        }
        assert(fs.existsSync(path.resolve(path.dirname(file), href)), href);
    }
}
const home = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
assert.equal((home.match(/class="release"/g) || []).length, 10);
assert(home.includes(`v${JSON.parse(fs.readFileSync(path.join(root, 'package.json'))).version}`));
assert.equal((fs.readFileSync(path.join(site, 'presentation/index.html'), 'utf8').match(/class="slide"/g) || []).length, 10);
console.log('Passed: site links, source/document/download targets, unique IDs, latest version and 10 slides/releases.');
