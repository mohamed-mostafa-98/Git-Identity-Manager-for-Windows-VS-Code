# Product website

Static, dependency-free product site. Edit `index.html` and `styles.css`; keep version downloads and claims aligned with RELEASES.md and verified implementation.

Run `node website/build.cjs` from the repository root to assemble `_site`, including the presentation. Serve `_site` with any static server. The GitHub Pages workflow deploys this folder; repository Settings → Pages must use GitHub Actions as its source.

Downloads point directly to the VSIX files on the repository's main branch. Update the hero version, release list, presentation and source documents when publishing a new product version. The product version does not change for website-only edits.
