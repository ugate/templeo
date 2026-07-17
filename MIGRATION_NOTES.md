# Notes

- GitHub Actions now runs the complete Templeo test suite with Node.js 24's built-in `node:test`, `node:assert`, coverage, HTTPS, crypto, filesystem, and child-process APIs.
- The test scope remains 33 tests across the default engine, LevelDB/IndexedDB adapter, Express integration, and file-system adapter.
- Direct development dependencies were reduced to the five packages that still provide non-native functionality required by the existing scope: `express`, `jsdom`, `level`, `vitepress`, and `vitepress-jsdoc`.
- The documentation workflow builds VitePress and force-pushes the generated site to the existing `gh-pages` branch, avoiding the repository environment restriction that rejected Pages deployments from `master`.
- In **Settings → Pages**, use **Deploy from a branch**, select `gh-pages`, and publish from `/ (root)`.
- The VitePress base path remains `/templeo/` for `https://ugate.github.io/templeo/`.
- `vitepress-jsdoc` runs before each documentation build and writes API pages under `docs/api/`.
- Version `2.0.0` is ECMAScript Module-only: package and test imports use native `import`/`export`, and the browser-safe root module no longer depends on CommonJS loading.
- Pushing tag `v2.0.0` runs `.github/workflows/release.yml`, repeats the full test and documentation build, deploys the generated site to `gh-pages`, and publishes `templeo@2.0.0` to npm using the existing `NPM_TOKEN` secret convention.
