# Notes

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
