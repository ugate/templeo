<b class="jsdocp-remove-me">

# ![](https://raw.githubusercontent.com/ugate/templeo/master/jsdocp/static/favicon-32x32.png) `templeo`

[![Build Status](https://img.shields.io/travis/com/ugate/templeo/master.svg?style=flat-square)](https://travis-ci.com/ugate/templeo)
[![Dependency Status](https://img.shields.io/david/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo)
[![Dev Dependency Status](https://img.shields.io/david/dev/ugate/templeo.svg?style=flat-square)](https://david-dm.org/ugate/templeo?type=dev)

</b>

### Template Literals Engine
> ♌ `templeo` is a __0️⃣ dependency__ template engine that uses built-in JavaScript/ECMAScript [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals). __No [Regular Expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions) parsing or special syntax in templates here! Just 💯% _built-in_ ES Template Literals!__

For more details check out the tutorials and API docs!

* [Tutorials](https://ugate.github.io/templeo/tutorial-1-basics.html)
* [API Docs](https://ugate.github.io/templeo/module-templeo-Engine.html)
* [Examples](https://ugate.github.io/templeo/tutorial-3-examples.html)

#### Features
- __💯% PURE__ <br>
No special syntax required! Everything is baked into the ECMAScript Template Literals specification itself! And since `templeo`/Template Literals are output-agnostic, a single `Engine` instance can output virtually any format (e.g. HTML, DOM Nodes, JSON, YAML, etc.).<br><br>
- __🌱 Grows with the language__ <br>
No need to update `templeo` when new features are added to the Template Literal spec. Any feature/syntax changes available within [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) are available for immediate use!<br><br>
- __🌐 Stand-Alone Rendering__ <br>
When a template is compiled into a rendering function it's no longer dependent upon `templeo` internals to render output - making rendering functions fully __portable__! Rendering functions can even be serverd from an HTTP server or any other source without any dependencies or references back to `templeo`!<br><br>
- __🛡️ Secure__ <br>
Since `templeo` does not have any special parsing syntax it does not suffer from syntax-specific injections. Compilation is also locally _sandboxed_ to ensure that scope is isolated to global variable access (and [require](https://nodejs.org/api/modules.html#modules_require) when available). Since rendering is _stand-alone_ and _portable_, it is completely isolated from any scope other than the scope in which it is ran!<br><br>
- __⛓️ Parameterized/Nested Includes__ <br>
Fragments are reusable and can be [included](https://ugate.github.io/templeo/tutorial-1-basics.html#include) at _compile-time_ and/or _render-time_ using simple [Tagged Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates). Also, supports [passing parameters](https://ugate.github.io/templeo/tutorial-1-basics.html#include-params) into included templates where the parameter scope is confined to the partial being included.<br><br>
- __🐞 Debugging__ <br>
Compiled templates are accessible directly via the VM `sourceURL` or through module [imports](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/import)/[requires](https://nodejs.org/api/modules.html#modules_require) - allowing for seemless debugging capabilities. <br><br>
- __🧠 Extensible__ <br>
Template Literals naturally allow for any of your own helper functions to be accessible within the template literal itself as long as they are within scope of the `templeo` generated rendering function execution (or via registration). And since rendering functions are independent of `templeo`, included template content can evolve based upon a given `context` without having to be re-compiled!<br><br>
- __🛎️ Auto Fetch__ <br>
By default, template(s) and rendering context can be [fetched](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)/[requested](https://nodejs.org/api/https.html#https_https_request_url_options_callback) __automatically__ at _compile-time_ and/or _render-time_ from an HTTP/S server. Also, render-time includes decouples the included template sources from the renderer allowing for newly dicovered template fragments to be included without re-compiling a new renderer!<br><br>
- __🏧 Caching__ <sub id="caching"></sub><br>
By default, templates are cached in-memory for the duration of the `Engine`/template lifespan. There are a few other extensions that may be more suitable depending upon your needs.
  - __[IndexedDB (Browser) / LevelDB (Node.js)](https://ugate.github.io/templeo/tutorial-1-cache.html#db)__<br>
  __Recommended when templates need to be persistent between usage.__ Compiled templates are cached in either an [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) store or a [LevelDB](https://www.npmjs.com/package/level) store.
  - __[File System (Node.js)](https://ugate.github.io/templeo/tutorial-1-cache.html#files)__<br>
  __Recommended when running on the server.__ Compiled templates are cached within the [file system](https://nodejs.org/api/fs.html) and __are loaded as modules so they can be debugged just like any other module__. If template _partials_/fragments are used the corresponding files can be _registered_ by providing a _base_ directory to be _scanned_. The _base_ directory can also be [_watched_ for changes](module-templeo_options.html) that will automaticaly reregister _partials_ with the updated _partial_ content!