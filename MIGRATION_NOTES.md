# Notes

- GitHub Actions now runs the complete Templeo test suite with Node.js 24's built-in `node:test`, `node:assert`, coverage, HTTPS, crypto, filesystem, and child-process APIs.
- The test scope remains 33 tests across the default engine, LevelDB/IndexedDB adapter, Express integration, and file-system adapter.
- Direct development dependencies were reduced to the five packages that still provide non-native functionality required by the existing scope: `express`, `jsdom`, `level`, `vitepress`, and `vitepress-jsdoc`.
- The documentation workflow builds VitePress and force-pushes the generated site to the existing `gh-pages` branch, avoiding the repository environment restriction that rejected Pages deployments from `master`.
- In **Settings → Pages**, use **Deploy from a branch**, select `gh-pages`, and publish from `/ (root)`.
- The VitePress base path remains `/templeo/` for `https://ugate.github.io/templeo/`.
- `vitepress-jsdoc` runs before each documentation build and writes API pages under `docs/api/`.
