### 🏧 The Cachier
The [cachier](Cachier.html) handles transactions that are submitted during [Engine.registerPartial](Cachier.html#registerPartial), [Engine.registerPartials](Cachier.html#registerPartials), [Engine.registerHelper](Cachier.html#registerHelper) and any other process that handles template persistence. This also includes any `read`/`write` operations that may be responsible for retrieving or writing to a persistence store. The default [cachier](Cachier.html) fetches/[`reads`](Cachier.html#read) and [`writes`](Cachier.html#write) template sources to/from _temporary memory_. When either a _read_ is flagged during registeration or an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the `Cachier` will check that [`options.partialsURL`](module-templeo_options.html#.Options) is set. When set, an attempt will be made to load/`read` the template content as discussed in [the `include` section of the tutorial](tutorial-1-basics.html#include). The same occurs for missing `context` as well.

When using the default [`Cachier`](Cachier.html) and a _read_ is flagged when calling [Engine.registerPartials](Cachier.html#registerPartials) or when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply:
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made.
- When not in memory, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown

The default `Cachier` refers to a __temporary memory__ space that only persists for the duration of the individual rendering call. This prevents multiple fetches/`reads` for any partial that may be included more than once. However, it will not prevent multiple `reads` to includes in subsequent calls to the rendering function. To better understand what happens consider the example below.

```js
// assume the following is served from: https://localhost:8080/template.html
// <html><body>Included ${ await include`my/partial` } and ${ await include`my/partial` }</body></html>
// assume the following is served from: https://localhost:8080/my/partial.html
// <b>partial for ${ it.name }</b>
// assume the following is served from: https://localhost:9000/context.json
// { "name": "DEMO" }
const Engine = require('templeo');
const engine = new Engine({
  partialsURL: 'https://localhost:8080',
  contextURL: 'https://localhost:9000'
});

// compile calls made:
// https://localhost:8080/template.html
const renderer = await engine.compile();

// rendering calls made:
// https://localhost:9000/context.json
// https://localhost:8080/my/partial.html (made only 1x since the 2nd include will be in temp cache)
const rslt1 = await renderer();

// rendering calls made:
// https://localhost:9000/context.json
// https://localhost:8080/my/partial.html (made only 1x since the 2nd include will be in temp cache)
const rslt2 = await renderer();
```

As can be seen in the example above, by default, partials are not retained in memory between rendering calls. This behavior may be suitable when partials are manually registered via [Engine.registerPartials](Cachier.html#registerPartials) or when used as a single use rendering, but may not be appropriate when longer caching durations are desired. There are however other types of cachiers that persist template sources for longer durations than the default `Cachier` described in detail in the following sections.

#### 🏦 [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) / [LevelDB](https://www.npmjs.com/package/level) <sub id="db"></sub>

Using an [IndexedDB store](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (browser only) or [LevelDB store](https://www.npmjs.com/package/level) has some advantages over the in-memory persistence that comes with the default `Cachier`. Instead of template sources having to be recaptured between rendering calls, a longer term storage source can be achieved that will not expire until it is flushed from the browser's cache, or when ran on a server, removed from the server's LevelDB store (both of which can be accomplished programmatically using [Engine.clearCache](module-templeo-Engine.html#clearCache)). `templeo` comes pre-bundled with a [CachierDB](CachierDB.html) that transparently handles `reads`/`writes` to either an `IndexedDB` store or a `LevelDB` store.

The [CachierDB constructor](CachierDB.html) takes an optional [LevelDB instance](https://www.npmjs.com/package/level) that can be used in place of the default IndexedDB provided by the browser. Most browsers [support IndexedDB](https://caniuse.com/indexeddb) in the way that `templeo` uses the internal store. When constructing `CachierDB` without providing a `LevelDB` instance, an attempt is made to [open](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open) an `IndexedDB` database with the provided database name (defaults to `templeo`). In either case, when a _read_ is flagged when calling [Engine.registerPartials](Cachier.html#registerPartials) or when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply:
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made
- When not in memory, an attempt to retrieve the template from the __`IndexedDB`/`LevelDB`__ store will be made
- When not in the DB, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown

For simplicity's sake we'll use some basic in-line templates to demonstrate using `CachierDB`:

```js
const Engine = require('templeo'), Cachier = require('templeo/lib/cachier-db');
const cachier = new CachierDB({ dbLocName: 'my-indexed-db-name' } );
const engine = Engine.create(cachier);
// reads "template" from from IndexedDB "my-indexed-db-name"
const renderer = await engine.compile();
// reads "context" from IndexedDB "my-indexed-db-name"
// reads any included partials by name from IndexedDB "my-indexed-db-name"
const rslt = await renderer();
```

#### 📁 [File System (Node.js)](https://nodejs.org/api/fs.html) <sub id="fs"></sub>

Using a file system is the recommended caching mechanism to use when processing templates within a Node.js server. It offers many benefits over the default caching. One of which is that it integrates well with view plugins/middleware that expects a file system to be present. There isn't much of a need to manually register partials. Instead, they can be read from a directory/sub-directories during compilation and/or rendering initialization. Another advantage is that the file system can watch template partial directories for file changes and update template content accordingly without any manual intervention. Calling [Engine.registerPartials](Cachier.html#registerPartials) with the _read_ flag set to `true` or when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply:
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made
- When not in memory, an attempt to retrieve the template from the __file system__ will be made using [`options.partialsPath`](module-templeo_options.html#.FileOptions)
- When not in the file system, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown
