<b class="jsdocp-remove-me">

# ![](https://raw.githubusercontent.com/ugate/templeo/master/jsdocp/static/favicon-32x32.png) templeo

[![Build Status](https://img.shields.io/travis/com/ugate/templeo/master.svg?style=flat-square)](https://travis-ci.com/ugate/templeo)
[![Dependency Status](https://img.shields.io/david/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo)
[![Dev Dependency Status](https://img.shields.io/david/dev/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo?type=dev)

</b>

### Micro Template Engine
`templeo` is a __micro lib__ that combines most of the benefits of _logic-less_ template semantics with the flexibility of _logic-based_ template semantics. All language-specific conditionals, iterations, etc. that make _logic-based_ template semantics error-prone and difficult to read are replaced with intuitive denotations while retaining the ability to make use of properties, functions, etc. within a sandboxed environment. To install run `npm install templeo`. Runs in the browser or [Node.js](https://nodejs.org) with __zero__ external dependencies. `templeo` also provides __built-in cache support__:

- [In-Memory](#in-memory) - The default cache that resides in-memory for the duration of execution.
- [IndexedDB](#indexed-db) - Templates are cached in an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) store.
- [LevelDB](#level-db) - Templates are cached in an [LevelDB](https://www.npmjs.com/package/level) store.
- [File System](#file-system) - Templates are cached within the [file system](https://nodejs.org/api/fs.html) (Node.js only)

For more details check out the tutorials or API docs!

* [Tutorials](https://ugate.github.io/templeo/tutorial-1-engine.html)
* [API Docs](https://ugate.github.io/templeo/module-templeo-Engine.html)

#### In-Memory <sub id="in-memory"></sub>
```js

```
#### IndexedDB <sub id="indexed-db"></sub>
```js

```

#### LevelDB <sub id="level-db"></sub>
```js

```

#### File System <sub id="file-system"></sub>
```js

```