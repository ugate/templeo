<b class="jsdocp-remove-me">

# ![](https://raw.githubusercontent.com/ugate/templeo/master/jsdocp/static/favicon-32x32.png) `templeo`

[![Build Status](https://img.shields.io/travis/com/ugate/templeo/master.svg?style=flat-square)](https://travis-ci.com/ugate/templeo)
[![Dependency Status](https://img.shields.io/david/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo)
[![Dev Dependency Status](https://img.shields.io/david/dev/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo?type=dev)

</b>

### Template Engine
> ♌ `templeo` is a __zero dependency__ template engine that uses built-in JavaScript/ECMAScript [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals). __No [Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) parsing of templates here!. Just 💯% _built-in_ ES Template Literals!__ 

### Install (Browser or [Node.js](https://nodejs.org))
- `npm install templeo`
- `const Templeo = require('templeo')`

#### Features
- __💯% PURE__ <br>
No special syntax required! Everything is baked into the ECMAScript Template Literals specification itself!<br><br>
- __🌱 Grows with the language__ <br>
No need to update `templeo` when new features are added to the Template Literal spec. Any feature/syntax changes available within Template Literals are available for immediate use!<br><br>
- __🌐 Stand-Alone Rendering__ <br>
When a template is compiled into a rendering function it's no longer dependent upon `templeo` internals to render output. So, rendering functions can even be serverd from an HTTP server or any other source without any references back to `templeo`!<br><br>
- __🛡️ Secure__ <br>
Since `templeo` does not have any special parsing syntax it does not suffer from syntax-specific injections. Compilation is also locally _sandboxed_ to ensure that scope is isolated to global variable access (and [require](https://nodejs.org/api/modules.html#modules_require) when available). Since rendering is _stand-alone_, it is completely isolated from any scope other than the scope in which it is ran!<br><br>
- __⛓️ Nested Includes__ <br>
Fragments are reusable and can be included at `compile-time` or `render-time` using simple [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates).<br><br>
- __🐞 Debugging__ <br>
Compiled templates are accessible directly via the VM or through module [imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)/[requires](https://nodejs.org/api/modules.html#modules_require) - allowing for seemless debugging capabilities. <br><br>
- __🧠 Extensible__ <br>
Template Literals naturally allow for any of your helper functions to be accessible within the template literal itself as long as they are within scope of the `templeo` generated rendering function execution. However, for convenience and to ensure a truely _stand-alone_ renderer, `templeo` provides a simple way to add your own helper functions during compilation of renderers.<br><br>
- __🛎️ Auto Fetch__ <br>
Partial template fragments can _optionally_ be [fetched](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)/[requested](https://nodejs.org/api/https.html#https_https_request_url_options_callback) __automatically__ at _compile-time_ or _render-time_ from an HTTP server.<br><br>
- __🏧 Caching__ <br>
  - [In-Memory](#in-memory) - The default cache that resides in-memory for the duration of the process lifespan
  - [IndexedDB](#indexed-db) - Compiled templates are cached in an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) store.
  - [LevelDB](#level-db) - Compiled templates are cached in an [LevelDB](https://www.npmjs.com/package/level) store.
  - [File System](#file-system) - Compiled templates are cached within the [file system](https://nodejs.org/api/fs.html) and __are loaded as modules so they can be debugged just like any other module__. If template _partials_/fragments are used the corresponding files can be _registered_ by providing a _base_ directory to be _scanned_. The _base_ directory can also be _watched_ for changes that will automaticaly reregister _partials_ with the updated _partial_ content. (__Node.js only__)

For more details check out the tutorials and API docs!

* [Tutorials](https://ugate.github.io/templeo/tutorial-1-engine.html)
* [API Docs](https://ugate.github.io/templeo/module-templeo-Engine.html)

#### Basic Examples
The following examples illustrate __basic__ usage. For more advanced usage examples see the [example section](https://ugate.github.io/templeo/tutorial-3-examples.html).

#### In-Memory <sub id="in-memory"></sub>
```js
const { Engine } = require('templeo');
const engine = new Engine();
const fn = await engine.compile('<html><body>Hello ${ it.name }!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### IndexedDB <sub id="indexed-db"></sub>
```js
const { Engine } = require('templeo');
const engine = await Engine.indexedDBEngine();
const fn = await engine.compile('<html><body>Hello ${ it.name }!</body></html>');
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
const fn = await engine.compile('<html><body>Hello ${ it.name }!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### File System <sub id="file-system"></sub>
```js
const { Engine } = require('templeo');
const engine = await Engine.filesEngine(); // defaults to OS temp dir
const fn = await engine.compile('<html><body>Hello ${ it.name }!</body></html>');
const rslt = fn({ name: 'templeo' });
console.log(rslt);
// <html><body>Hello templeo!</body></html>
```

#### [More examples >>](https://ugate.github.io/templeo/tutorial-3-examples.html)