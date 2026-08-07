---
layout: home

hero:
  name: templeo
  text: Native template literals, compiled for reuse
  tagline: A zero-dependency JavaScript template engine with portable renderers, nested includes, debugging, and extensible caching.
  image:
    src: /android-chrome-192x192.png
    alt: templeo
  actions:
    - theme: brand
      text: The Basics
      link: /guide/1-basics
    - theme: brand
      text: Cache
      link: /guide/2-cache
    - theme: alt
      text: API Reference
      link: /api/
    - theme: alt
      text: GitHub
      link: https://github.com/ugate/templeo

features:
  - icon: 💯
    title: Pure template literals
    details: Use built-in ECMAScript template literal syntax without a custom parser or template language.
  - icon: 🌐
    title: Stand-alone rendering
    details: Compiled rendering functions are portable and do not depend on templeo internals at render time.
  - icon: ⛓️
    title: Nested and parameterized includes
    details: Resolve reusable partials at compile time or render time and pass parameters into their isolated scope.
  - icon: 🏧
    title: Extensible caching
    details: Keep templates in memory or use the bundled database and file-system cache implementations.
---

# templeo {#details}

`templeo` is a **zero-dependency** template engine that uses built-in JavaScript/ECMAScript [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals). There is no regular-expression parser or special template syntax—just native ES template literals.

For more details, see [The Basics](/guide/1-basics), [Cache](/guide/2-cache), [Examples](/guide/3-examples), and the [API Reference](/api/).


## Features

- **💯% PURE** — No special syntax is required. Everything is part of the ECMAScript Template Literals specification, and a single `Engine` can output HTML, DOM nodes, JSON, YAML, or virtually any other format.
- **🌱 Grows with the language** — New template literal syntax and language features are immediately usable without a `templeo` parser update.
- **🌐 Stand-Alone Rendering** — Once compiled, a rendering function no longer depends on `templeo` internals and can be serialized, deserialized, or served from another source.
- **🛡️ Secure** — Compilation is sandboxed from local scope, and portable renderers remain isolated from the scope in which they were compiled.
- **⛓️ Parameterized/Nested Includes** — Reusable partials can be [included](/guide/1-basics#include) at compile time or render time, with parameters confined to the included partial.
- **🐞 Debugging** — Compiled templates remain accessible through VM `sourceURL` values or module imports/requires for direct debugging.
- **🧠 Extensible** — Register helper functions for use in template literal expressions, while rendered output remains independent of `templeo`.
- **🛎️ Auto Fetch** — Templates, partials, and context can be fetched automatically at compile time or render time from HTTP/S sources.
- **🏧 Caching** — Templates are cached in memory by default. Bundled extensions support [IndexedDB/LevelDB](/guide/2-cache#db) and the [Node.js file system](/guide/2-cache#fs).
