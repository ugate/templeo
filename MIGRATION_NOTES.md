# Notes

- Version `2.2.2` replaces `vitepress-jsdoc` with JSDoc `--explain` JSON plus the project-owned `docs/generate-api.mjs` Markdown renderer.
- API generation preserves the existing VitePress routes, excludes JSDoc implementation doclets marked `undocumented`, safely code-wraps generated signatures, and validates every JSDoc tag used by Templeo before writing `docs/api/`.
- JSDoc symbolic links, including JSDoc's relative forms such as `./Engine.compile`, class references such as `./Director`, and call forms such as `./Director.toString()`, are resolved through the generated API index and written against stable heading anchors. When JSDoc marks a class declaration undocumented but publishes its members, the class reference falls back to the API page heading. Duplicate getter/setter or member doclets receive deterministic `-2`, `-3`, and later suffixes while links retain the first canonical target.
- Direct development dependencies are pinned to Express `5.2.1`, JSDoc `4.0.5`, JSDOM `30.0.1`, Level `10.0.0`, and VitePress `1.6.4`.
- `allowScripts` explicitly permits only the install scripts required by `classic-level` and `esbuild`; `underscore` is overridden to the fixed `1.13.8` transitive release.
- Level-backed tests and runtime adapters now prioritize the modern named `Level` class even when a package also exposes a non-callable default namespace, while retaining the older LevelUP-compatible path.
- File-backed partial scans and watchers ignore stale generated JavaScript renderer modules unless JavaScript is the configured raw-template extension.
- The test scope now contains 54 tests across API documentation generation, the default engine, IndexedDB/Level adapters, Express integration, file-system caching, native watchers, and Cachier regressions.
- GitHub Actions uses Node.js 24, runs the published-runtime audit, executes the full tests, builds VitePress, deploys `gh-pages`, and publishes tagged releases through npm Trusted Publisher/OIDC.
- This archive intentionally omits `package-lock.json` because the restricted build environment could not resolve the public npm registry. Direct versions are exact, and `npm install` will generate a current lock file on a machine with public npm access. Commit that generated lock file; the workflows automatically use `npm ci` whenever it is present.
- Pushing tag `v2.2.2` runs `.github/workflows/release.yml`, validates the package/tag version, and publishes `templeo@2.2.2` after all gates pass.
