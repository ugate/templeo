# Changelog

All notable changes to Templeo are documented in this file.

The historical entries below are consolidated from the repository commit history. Repeated dependency updates, documentation corrections, test maintenance, and closely related refactors are grouped into their corresponding release instead of being listed commit-by-commit.

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

[2.2.0]: https://github.com/ugate/templeo/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/ugate/templeo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/ugate/templeo/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/ugate/templeo/compare/v0.1.0...v1.0.0
[0.1.0]: https://github.com/ugate/templeo/tree/v0.1.0
