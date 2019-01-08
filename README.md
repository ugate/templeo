<b class="jsdocp-remove-me">

# ![](https://raw.githubusercontent.com/ugate/templeo/master/jsdocp/static/favicon-32x32.png) templeo

[![Build Status](https://img.shields.io/travis/com/ugate/templeo/master.svg?style=flat-square)](https://travis-ci.com/ugate/templeo)
[![Dependency Status](https://img.shields.io/david/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo)
[![Dev Dependency Status](https://img.shields.io/david/dev/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo?type=dev)

</b>

### Micro Template Engine
> `templeo` is a __zero dependency__ template engine that uses built-in JavaScript [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) syntax.

`templeo` combines the benefits of [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) semantics with the flexibility of running __client-side, server-side or even serverless__. All language-specific conditionals, iterations, etc. that make _logic-based_ template semantics error-prone and difficult to read are replaced with intuitive expressions while retaining the ability to make use of properties, functions, etc. within a sandboxed environment. To install run `npm install templeo`. Runs in the browser or [Node.js](https://nodejs.org) with __zero__ external dependencies.

#### Features
- __No special Syntax__: No special syntax required! Everything is baked into JavaScript itself! Properties, functions, etc. are fully available within every template expression (e.g. `{{= it.myArray.sort().join()}}`).
- __Includes__: _Partial_ template fragments can contain _nested_ includes in order to maximize template reusability
- __Debugging__: Compiled templates are accessible directly via the VM or through module imports/requires- allowing for seemless debugging capabilities
- __Extensible__: Directives can easily be added to add any stand-alone [Tag Function](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates) and are fully customizable and easy to extend. And with a decoupled caching mechanism, cache extensibility is a easy as overriding `read` and/or `write` operations. 
- __Auto Loading/Uploading__: _Partials_/fragments can optionally be __loaded__ from (and even __uploaded__ to) an HTTPS server. Loading/uploading is performed by [window.fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) when running in the browser or the [https module](https://nodejs.org/api/https.html) when running in `node`.
- __Built-in Cache Support__:
  - [In-Memory](#in-memory) - The default cache that resides in-memory for the duration of the process lifespan
  - [IndexedDB](#indexed-db) - Compiled templates are cached in an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) store.
  - [LevelDB](#level-db) - Compiled templates are cached in an [LevelDB](https://www.npmjs.com/package/level) store.
  - [File System](#file-system) - Compiled templates are cached within the [file system](https://nodejs.org/api/fs.html) and __are loaded as modules so they can be debugged just like any other module__. If template _partials_/fragments are used the corresponding files can be _registered_ by providing a _base_ directory to be _scanned_. The _base_ directory can also be _watched_ for changes that will automaticaly reregister _partials_ with the updated _partial_ content. (Node.js only)

For more details check out the tutorials and API docs!

* [Tutorials](https://ugate.github.io/templeo/tutorial-1-engine.html)
* [API Docs](https://ugate.github.io/templeo/module-templeo-Engine.html)

#### Basic Examples
The following examples illustrate __basic__ usage. For more advanced usage examples see the [example section](https://ugate.github.io/templeo/tutorial-3-examples.html).

#### In-Memory <sub id="in-memory"></sub>
```js
const { Engine } = require('templeo');
const engine = new Engine();
const fn = await engine.compile('<html><body>Hello {{=it.name}}!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### IndexedDB <sub id="indexed-db"></sub>
```js
const { Engine } = require('templeo');
const engine = await Engine.indexedDBEngine();
const fn = await engine.compile('<html><body>Hello {{=it.name}}!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### LevelDB <sub id="level-db"></sub>
```js
const Level = require('level');
const levelDB = Level('/path/to/mydb');

const { Engine } = require('templeo');
const engine = await Engine.indexedDBEngine(null, null, levelDB);
const fn = await engine.compile('<html><body>Hello {{=it.name}}!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### File System <sub id="file-system"></sub>
```js
const { Engine } = require('templeo');
const engine = await Engine.filesEngine(); // defaults to OS temp dir
const fn = await engine.compile('<html><body>Hello {{=it.name}}!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### [More examples >>](https://ugate.github.io/templeo/tutorial-3-examples.html)