# Changelog

All notable changes to Templeo are documented in this file.

The historical entries below are consolidated from the repository commit history. Repeated dependency updates, documentation corrections, test maintenance, and closely related refactors are grouped into their corresponding release instead of being listed commit-by-commit.

## [3.0.0] - 2026-08-06

### Breaking

- Generated renderer modules now default to native ECMAScript module semantics (`useCommonJs: false`) and `.mjs` output. Set `useCommonJs: true` to retain CommonJS semantics and `.cjs` output.

### Changed

- Render-time file-cache renderer writes now use the configured `outputPath` instead of writing generated JavaScript beside raw partial templates.
- File-cache generated renderer paths preserve source hierarchy relative to `relativeTo`; the primary renderer remains at the output root, and temporary output directories are not duplicated into nested paths.
- Render-time generated renderer extensions now consistently follow `useCommonJs` for memory, file and database cache operations.
- Added VitePress `docs/.vitepress/cache/` and `docs/.vitepress/dist/` to `.gitignore`.

### Fixed

- Fixed function-style option lookup for `useCommonJs`, which could previously produce `.true` or no generated source extension instead of `.cjs` / `.mjs`.
- Fixed `CachierDB.compile()` so `URLSearchParams` and explicit extensions are forwarded using the inherited `compile(name, template, params, extension)` signature.
- Fixed `CachierDB.register()` when both persistence flags are false; memory-only registration no longer dereferences a missing database-storage wrapper.
- Fixed `Engine.unregister()` / `Cachier.unregister()` so raw public names actually remove their resolved cache entries, including parameterized variants.
- Fixed `getRegistered()` so returned `URLSearchParams` remain usable and are copied without mutating the cached instance.
- Fixed cache naming and HTTP reads when a template name already contains a query string; existing and supplied search parameters are preserved, canonicalized and not duplicated.
- Fixed render-time extension detection for parameterized include paths so query strings are not mistaken for part of the template extension.
- Fixed render-time file path extraction when the primary template is outside `partialsPath`; generated renderer names no longer collapse to `.mjs` / `.cjs` and create a directory at that filename.

### Tests

- Added eleven v3 regression tests covering ESM-default/CommonJS opt-in naming, native import/require loading, query merging, raw-name unregister behavior, `URLSearchParams` copies, memory-only DB registration, DB compile argument forwarding, render-time primary-template path extraction, the legacy Files fixture path shape, and compile/render-time file output placement and extensions.

## [2.3.0] - 2026-08-06

### Added

- Added canonical cache operation keys with stable URL search-parameter ordering.
- Added in-flight read, write and compile deduplication so concurrent requests for the same resource share one promise.
- Added optional `maxCacheEntries`, `maxCacheBytes`, and idle `cacheTTL` controls; all default to `0` to preserve unlimited, non-expiring behavior.
- Added cache statistics through `Cachier.stats` and `Engine.cacheStats`, including hits, misses, reads, writes, compiles, deduplicated work, evictions, watcher events, entry/byte totals, and pending operation counts.
- Added `resetStats()` / `resetCacheStats()` and separate `clearMemory()` and `close()` lifecycle methods; `CachierDB.close()` closes an active database connection without deleting persisted records.
- Added `CachierFiles.startWatching()`, `reconcileWatching()`, `stopWatching()`, and `clearGeneratedFiles()` plus matching Engine watcher controls.

### Changed

- In-memory cache storage now uses null-prototype objects and least-recently-used tracking when limits are configured.
- Native file watchers now use abort signals, cancel pending debounce timers during shutdown, serialize events per path, and record file modification time, size, and revision metadata.
- Generated renderer files are written atomically through temporary sibling files before rename.
- Generated CommonJS and ESM renderers are deserialized directly from their source files instead of using timestamped dynamic imports, preventing unbounded Node.js ESM module-cache growth.
- `CachierFiles` statistics now combine its base-memory and file-operation stores. `clear()` / `Engine.clearCache()` perform full cleanup: stop watchers, clear both memory stores, and remove generated files. `close()` preserves generated files.
- `Engine.clearCache()` now preserves each cache implementation's own default cleanup scope; `CachierDB.clear()` correctly distinguishes connection-only cleanup from deleting all persisted records.

### Fixed

- Added the transitive `optionValue` cache helper to serialized `CachierDB` render-time operation scopes so LRU and TTL pruning work inside generated renderers.
- Updated the browser ESM test bundle to include the shared cache utility module and remove multiline static imports without removing dynamic `import()` expressions.

### Tests

- Added eleven native tests covering canonical cache keys, concurrent memory/database read-write-compile deduplication, entry/byte LRU eviction, idle TTL expiration, statistics reset, database close semantics, separated file/watcher lifecycle, explicit reconciliation, rapid watcher updates, atomic writes, repeated renderer reloads, serialized database helper scope, and browser bundle module syntax.

### Compatibility

- All new cache limits and watcher controls are opt-in or additive. Existing unlimited cache behavior and `watchPaths` automation remain the defaults.
- No runtime dependency was added.

## [2.2.2] - 2026-08-06

### Changed

- Replaced the unmaintained `vitepress-jsdoc` integration with JSDoc's structured `--explain` output and a dependency-free, project-owned Markdown renderer while retaining the existing VitePress API page layout.
- Upgraded the direct development dependencies to stable releases: Express `5.2.1`, JSDoc `4.0.5`, JSDOM `30.0.1`, and Level `10.0.0`; retained VitePress `1.6.4` as the current stable VitePress release.
- Pinned direct development dependency versions exactly, overrode JSDoc's transitive `underscore` dependency to the fixed `1.13.8` release, and documented the two required install-time scripts through `allowScripts` for `classic-level` and `esbuild`.
- Added `audit:runtime` and `audit:development` scripts and made the published runtime audit a CI and release gate.
- Updated GitHub Actions to use `npm ci` when a refreshed lock file is present and fall back to `npm install` when consuming this lock-free archive.

### Fixed

- Fixed Level 10 module loading when the package exposes a non-callable default namespace alongside the named `Level` constructor.
- Ignored generated `.js`, `.mjs`, and `.cjs` renderer artifacts during raw partial-directory scans and watcher updates unless JavaScript is the configured template extension.
- Made the test fixture loader deterministic when stale generated renderer files are present beside HTML or JSON partials.

### Compatibility

- Added support for the modern named `Level` class export, explicit database opening, `status`-based open detection, and async `iterator()` record enumeration while preserving the legacy LevelUP initializer and `createReadStream()` paths.
- Updated the legacy stream path to wait for asynchronous record processing before completing.
- No production dependency or public Templeo API was added or changed.

### Documentation

- Added source-tag validation so documentation builds fail rather than silently dropping unsupported JSDoc tags.
- Filtered JSDoc's undocumented implementation doclets from public API output and rendered signatures as inline code so internal names such as `<anonymous>` cannot be interpreted as Vue/HTML elements during the VitePress build.
- Normalized JSDoc symbolic links such as `./Engine.compile` and `./Director.toString()` to their generated API pages and added stable explicit anchors to every documented class, member, function, constant, and typedef.
- Assigned deterministic numeric suffixes to duplicate accessor/member anchors on the same API page while keeping symbolic links pointed at the first canonical occurrence.
- Resolved class references to their API page heading when JSDoc marks the class declaration undocumented but publishes its documented members.
- Preserved descriptions, parameters, properties, return values, examples, inheritance, and cross-reference links in the generated API pages.

### Tests

- Added native tests for API Markdown generation, unsupported-tag detection, inherited documentation, undocumented-symbol filtering, safe signature rendering, duplicate accessor anchors, symbolic-link normalization, and the modern Level class/iterator interface.

## [2.2.1] - 2026-08-06

### Fixed

- Fixed `registerPartial()` so `URLSearchParams` values are retained and used when generating parameterized cache keys.
- Fixed `Cachier.waiter()` so rejected promises preserve their error code, combined stack, captured result position, and subsequent successful results.
- Fixed generated renderers so compile-time partials are copied into a supplied shared store without overwriting entries already present in that store.
- Fixed in-memory writes so string template content is retained, compiled source strings/functions are formatted with `writeFormatOptions`, and formatted source is deserialized back into a rendering function.
- Fixed Fetch API reads so response bodies are consumed exactly once and read formatters operate on the resolved response text.
- Fixed browser Fetch API writes so Templeo does not depend on Node.js `Buffer` or manually set the restricted `Content-Length` header.

### Tests

- Added seven native Node.js regression tests covering parameterized registration, cumulative promise errors, shared-store initialization, memory content/source writes, formatted fetch reads, and browser-compatible fetch writes.

### Compatibility

- This patch does not add dependencies or change the public API.

## [2.2.0] - 2026-08-06

### Added

- Added opt-in native Node.js `fs.watch` support to `CachierFiles` through the existing `watchPaths` option.
- Added automatic registration for created files, re-registration for changed files, and unregistration for deleted files.
- Added dynamic watcher management for newly created, renamed, and removed partial subdirectories.
- Added shared render-time watcher state so updates persist across renderer calls that use the same shared-store object.
- Added `watchedDirs` to `CachierFiles.metadata` and documented compile-time and render-time watcher lifecycles.
- Added native Node.js tests for file changes, directory changes, render-time shared updates, and `unwatchPaths` cleanup.

### Fixed

- Fixed watched partial deletion so the correct cache key is unregistered.
- Fixed file reads under a non-default `relativeTo` directory by using resolved source paths.
- Fixed render-time watcher registration so changed content updates the renderer's shared cache.

### Compatibility

- Watchers remain disabled by default and introduce no runtime dependency.
- Native watchers use `{ persistent: false }`, so they do not keep the Node.js process running.

## [2.1.0] - 2026-07-18

### Added

- Added native dynamic ECMAScript module loading to generated primary and included renderers through `await importModule(specifier)`.
- Added Node.js ESM coverage for loading a module from generated renderer code.
- Added browser-realm coverage confirming dynamic imports work when CommonJS `require` is unavailable.
- Added a Helper Directives example documenting `importModule()` usage and its asynchronous behavior.

### Compatibility

- Existing optional `require` support remains unchanged when it is available.
- Existing rendering, caching, include, and serialization behavior remains unchanged.

## [2.0.0] - 2026-07-17

### Breaking changes

- Converted Templeo from CommonJS to ECMAScript modules and declared the package as `type: module`.
- Updated consumers and examples to use native `import`/`export` syntax.
- Made the package entry point browser-safe by removing its dependency on CommonJS loading.

### Changed

- Replaced the JSDocP documentation build with VitePress and `vitepress-jsdoc` while preserving the existing tutorials, API documentation, examples, JSON inclusion examples, branding, and static assets.
- Replaced the Lab/Code test harness with native `node:test` and `node:assert` while retaining the existing test scope.
- Replaced generated test certificates and unnecessary test tooling with native Node.js capabilities and static local test certificates.
- Reduced direct development dependencies to the packages still required for Express, DOM, LevelDB, and documentation testing/building.
- Replaced Travis CI and legacy documentation/publishing jobs with GitHub Actions workflows for CI, VitePress deployment, and tagged npm releases on Node.js 24.
- Added package/tag version validation to the release workflow.
- Configured npm publication for GitHub Actions Trusted Publisher authentication through OIDC instead of a stored npm token.

### Historical note

- Repository commits labeled `v1.0.1` were intermediate 2026 migration work and were never published to npm or created as a Git tag. Their completed changes are therefore consolidated into this `2.0.0` entry.

## [1.0.0] - 2019-11-13

### Added

- Added `Engine.getRegistered(name, params, extension)` for retrieving registered template data.
- Added Express integration and test coverage.
- Added compile-time versus render-time primary-template loading through the `Engine.compile(true)` and `Engine.compile()` modes.
- Added render-time read/write formatters, policies, lifecycle hooks, and stand-alone file/DB handling.
- Added search-parameter-aware cached partial variants and broader template/context/partial persistence support.

### Changed

- Generalized cache data spaces and naming so templates, partials, context, and generated sources use consistent read/write behavior.
- Consolidated compile-time and render-time cache operations across memory, file-system, IndexedDB, and LevelDB implementations.
- Improved file scanning, path normalization, extension detection, source output, error fallback across readers, and descriptive logging.
- Limited file watching to the compile-time workflow because generated renderers operate independently from the Templeo engine.
- Expanded documentation and test coverage and refreshed supported Node.js and development dependency versions.

### Fixed

- Fixed DB connection closure and serialization behavior.
- Fixed render-time read policies, source writes, partial registration, file output, and template/context/partial read/write edge cases.
- Fixed several cache, watcher, path, and renderer error-reporting issues.

## [0.1.0] - 2019-02-06

### Added

- Published the initial public release of the zero-runtime-dependency template engine built on native JavaScript template literals.
- Added asynchronous and nested includes with URL search parameters and JSON values scoped to included templates.
- Added custom helper registration through `Engine.registerHelper`.
- Added template/context auto-fetching, debugger insertion, renderer metadata, and JSON rendering support.
- Added in-memory, file-system, IndexedDB, and LevelDB-backed template/partial caching.
- Added static partial registration, directory scanning/watch support, cache clearing, and stand-alone renderer generation.
- Added Hapi/Vision integration and HTTPS-backed template/partial loading tests.
- Exposed sandbox support for custom cache implementations and retained `require` access in generated Node.js renderers when available.

### Changed

- Replaced the original regular-expression-driven template parser with native template-literal compilation.
- Converted compilation and inclusion processing to asynchronous operation.
- Simplified the engine, cache, director, and testing APIs during the initial development cycle.

[3.0.0]: https://github.com/ugate/templeo/compare/v2.3.0...v3.0.0
[2.3.0]: https://github.com/ugate/templeo/compare/v2.2.2...v2.3.0
[2.2.2]: https://github.com/ugate/templeo/compare/v2.2.1...v2.2.2
[2.2.1]: https://github.com/ugate/templeo/compare/v2.2.0...v2.2.1
[2.2.0]: https://github.com/ugate/templeo/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/ugate/templeo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/ugate/templeo/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ugate/templeo/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ugate/templeo/tree/v0.1.0
