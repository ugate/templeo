# Notes

- Version `3.0.1` adds a real Playwright Chromium/native-ESM release gate while keeping the existing public package entry unchanged for Node.js and browsers.
- Install the Playwright Chromium headless shell and required Linux libraries explicitly with `npm run test:browser:install` before running browser-inclusive tests on a clean host. `npm test` does not install browsers or operating-system packages.
- Shared HTTP/S template operations now use the standard Fetch API; Node.js 24 and modern browsers provide it natively.
- `CachierFiles` generated renderer paths now preserve the source hierarchy under `outputPath`, and primary templates outside `partialsPath` no longer collapse to a bare `.mjs` / `.cjs` path.
- Native IndexedDB persistence is corrected: opens retain the real `IDBDatabase`, stores are created from the upgrade database handle, single-record operations settle against the correct stores, cursor exhaustion is normal completion, asynchronous registration callbacks are awaited, and closed handles are not reused.
- Direct development dependencies are pinned to Express `5.2.1`, JSDoc `4.0.5`, JSDOM `30.0.1`, Level `10.0.0`, Playwright `1.62.1`, and VitePress `1.6.4`.
- Playwright is development-only and no production runtime dependency was added.
- This archive omits `package-lock.json`; retain or regenerate the lock file with `npm install` before committing.
- Pushing tag `v3.0.1` runs the release workflow, validates the package/tag version, and publishes `templeo@3.0.1` through npm Trusted Publisher/OIDC after all gates pass.

- Version `3.0.0` changes the generated renderer module default from CommonJS to native ECMAScript modules. `useCommonJs` now defaults to `false`, generated ESM files use `.mjs`, and projects that require CommonJS should explicitly set `useCommonJs: true` to generate `.cjs` files.
- This is the only intentional breaking change in v3. All Cachier coordination, lifecycle, cache-limit and observability APIs added in v2.3 remain available.
- Function-style option lookup now resolves `useCommonJs` correctly, and both compile-time and render-time generated renderer paths use the selected `.mjs` / `.cjs` extension consistently.
- `CachierFiles` render-time writers now place generated renderer files under `outputPath` (or the derived temporary output directory) rather than beside raw files under `partialsPath`.
- `CachierDB.compile()` now preserves the inherited `(name, template, params, extension)` signature, and memory-only `CachierDB.register()` calls no longer require a persistence-operation wrapper.
- `unregister(name)` now resolves raw public names and removes matching parameterized cache variants. `getRegistered()` preserves copied `URLSearchParams` instances.
- Existing query strings are now merged with supplied `URLSearchParams` for cache names and HTTP reads without generating malformed double-`?` URLs, dropping existing parameters, or duplicating supplied parameters.
- Render-time include extension detection ignores query/hash suffixes before deriving generated renderer paths.
- `docs/.vitepress/cache/` and `docs/.vitepress/dist/` are now ignored by Git.
- The test scope contains 74 native tests, including nine v3 regressions for the module-format default and the bug fixes above.
- Direct development dependencies remain pinned to Express `5.2.1`, JSDoc `4.0.5`, JSDOM `30.0.1`, Level `10.0.0`, and VitePress `1.6.4`.
- This archive omits `package-lock.json`; retain or regenerate the lock file with `npm install` before committing.
- Pushing tag `v3.0.0` runs `.github/workflows/release.yml`, validates the package/tag version, and publishes `templeo@3.0.0` through npm Trusted Publisher/OIDC after all gates pass.

## v2.3.0 reference

- Version `2.3.0` adds backward-compatible Cachier coordination, lifecycle and observability improvements.
- Cache names canonicalize `URLSearchParams` order, while concurrent reads, writes and compiles for the same key share one in-flight promise.
- `maxCacheEntries`, `maxCacheBytes` and `cacheTTL` are optional and default to `0`, preserving unlimited non-expiring cache behavior.
- `Cachier.stats` / `Engine.cacheStats` report hits, misses, reads, writes, compiles, deduplicated work, evictions, watcher events, entry/byte totals and pending operations.
- `clearMemory()`, `close()`, `CachierFiles.clearGeneratedFiles()`, `startWatching()`, `reconcileWatching()` and `stopWatching()` separate cleanup and watcher lifecycle responsibilities. `CachierDB.close()` closes connections without deleting records, while `Engine.clearCache()` uses each cache implementation's default full-cleanup scope and `CachierDB.clear(false)` remains available for connection-only cleanup.
- File watcher work is debounced and serialized per path, uses abortable native watchers, cancels pending timers during shutdown, and records `mtimeMs`, size and revision metadata.
- Generated renderer files are written through atomic temporary siblings and deserialized directly from source, avoiding timestamped dynamic imports and unbounded ESM module-cache growth.
- The test scope contains 65 native tests. Eleven new v2.3 tests cover canonical keys, memory/database read-write-compile in-flight deduplication, entry/byte LRU limits, TTL behavior, statistics, database close semantics, lifecycle separation, explicit watcher reconciliation, watcher sequencing, atomic writes, renderer reloads, serialized database helper scope, and browser bundle module syntax.
- Serialized `CachierDB` render-time operations now include the transitive `optionValue` helper required by cache pruning, and the browser ESM test bundle includes `cache-utils.js` while stripping multiline static imports without stripping dynamic `import()` calls.
- Direct development dependencies remain pinned to Express `5.2.1`, JSDoc `4.0.5`, JSDOM `30.0.1`, Level `10.0.0`, and VitePress `1.6.4`.
- This archive omits `package-lock.json` because the build environment cannot resolve the public npm registry. Retain the lock file from the v2.2.2 checkout or regenerate it with `npm install` before committing.
- Pushing tag `v2.3.0` runs `.github/workflows/release.yml`, validates the package/tag version, and publishes `templeo@2.3.0` through npm Trusted Publisher/OIDC after all gates pass.
