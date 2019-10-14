### 🏧 The Cachier
The [cachier](Cachier.html) handles transactions that are submitted during [Engine.registerPartial](Cachier.html#registerPartial) (memory), [Engine.register](Cachier.html#register), [Engine.registerHelper](Cachier.html#registerHelper) and any other process that handles template persistence. This also includes any `read`/`write` operations that may be responsible for retrieving or writing to a persistence store. The default `Cachier`'s persistence store is assumed to be maintained externally by an HTTP/S server and will be fetched/read and/or written to accordingly (when configured).

__👓 Reading from persistence storage:__<br/>
[Engine.register](module-templeo-Engine.html#register) - Reads the all template sources from persistent storage that have a corresponding _name_ in the passed _data_. For example, the following reads _test1_ and _test2_ from persistent storage and stored in __memory__ for use during compilation/rendering.

```js
// 2nd arg is read flag
await engine.register([
  {
    name:'test1'
  },
  {
    name:'test2'
  }
], true);
```

__✏️ Writting to persistence storage:__<br/>
[Engine.register](module-templeo-Engine.html#register) - Stores one or more template sources in __memory__ and/or writes them to persistent storage. For example, the following will write _test1_ and _test2_ to persistence storage as well as storing them in __memory__ for use during compilation/rendering.

```js
// 3rd arg is write flag
await engine.register([
  {
    name:'test1',
    content:'Test template source ${one}'
  },
  {
    name:'test2',
    content:'Test template source ${two}'
  }
], false, true);
```

__✏️ Writting directly to _memory_:__<br/>
[Engine.registerPartial](module-templeo-Engine.html#registerPartial) - Stores a template source in __memory only__- bypassing the persistent store altogether. For example, the following will write _test1_ and _test2_ to __memory__ for use during compilation/rendering.

```js
await engine.registerPartial('test1', 'Test template source ${one}');
await engine.registerPartial('test2', 'Test template source ${two}');
```

__❌ Removing from _memory_:__<br/>
[Engine.unregister](module-templeo-Engine.html#unregister) - Removes a template source from __memory only__. For example, the following will remove _test1_ and _test2_ from __memory__, making them unavaliable for use during compilation/rendering.

```js
await engine.unregister('test1');
await engine.unregister('test2');
```

__❌ Removing everything from _memory_ and persistence storage:__<br/>
[Engine.clear](module-templeo-Engine.html#clear) - Removes all template sources from __memory__ as well as the persistence store. For example, the following will remove _everything_ from __memory__ and the persistence store, making them unavaliable for use during compilation/rendering.

```js
await engine.clear();
```

All `Cachier`s inherit a __temporary memory__ space for template sources set during _registration_. The template memory space persists over the lifespan of a rendering function regardless of how many times it's called. However, due to the decoupling of generated rendering functions from depending upon `templeo`, __it's important to note that any template sources that are registered/added/updated/removed after a rendering function has been compiled, will not be reflected during subsequent rendering function calls__.

The __temporary memory__ space also prevents multiple fetches/`reads` for any partial that may be included more than once. However, it will not prevent multiple `reads` to includes in subsequent calls to the rendering function unless they were registered prior to compilation. To better understand what happens consider the example below.

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

As can be seen in the example above, by default, partials that are captured during rendering are not retained in memory between rendering calls. This behavior may be suitable when partials are typically registered prior to compilation, when used as a single use rendering function or when consecutive HTTP/S are not not an issue, but may not be appropriate when longer caching durations are desired. There are however other types of cachiers that persist template sources for longer durations than the default `Cachier` described in detail in the following sections.

When using the default [`Cachier`](Cachier.html) and a _read_ is flagged when calling [Engine.register](module-templeo-Engine.html#register __or__ when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply. There are also several different policies that can be applied that determines when and how _reads_/_writes_ are executed during rendering using the [`renderTimePolicy` option](tutorial-2-cache.html).
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made.
- When not in memory, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown

#### 🏦 [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) / [LevelDB](https://www.npmjs.com/package/level) <sub id="db"></sub>

Using an [IndexedDB store](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (browser only) or [LevelDB store](https://www.npmjs.com/package/level) has some advantages over the in-memory persistence that comes with the default `Cachier`. Instead of template sources having to be recaptured between rendering calls, a longer term storage source can be achieved that will not expire until it is flushed from the browser's cache, or when ran on a server, removed from the server's LevelDB store (both of which can be accomplished programmatically using [Engine.clearCache](module-templeo-Engine.html#clearCache)). `templeo` comes pre-bundled with a [CachierDB](CachierDB.html) that transparently handles `reads`/`writes` to either an `IndexedDB` store or a `LevelDB` store.

The [CachierDB constructor](CachierDB.html) takes an optional [LevelDB instance](https://www.npmjs.com/package/level) that can be used in place of the default IndexedDB provided by the browser. Most browsers [support IndexedDB](https://caniuse.com/indexeddb) in the way that `templeo` uses the internal store. When constructing `CachierDB` without providing a `LevelDB` instance, an attempt is made to [open](https://developer.mozilla.org/en-US/docs/Web/API/IDBFactory/open) an `IndexedDB` database with the provided database name (defaults to `templeo`). In either case, when a _read_ is flagged when calling [Engine.register](Cachier.html#register) or when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply:
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made
- When not in memory, an attempt to retrieve the template from the __`IndexedDB`/`LevelDB`__ store will be made
- When not in the DB, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown

Just like any other type of `Cachier`, templates can be __written__ to _cache_ via [Engine.register](Cachier.html#register). For simplicity's sake we'll use some basic in-line templates to demonstrate using `CachierDB`:

```js
const Engine = require('templeo'), CachierDB = require('templeo/lib/cachier-db');
const cachier = new CachierDB({ dbLocName: 'my-indexed-db-name' });
const engine = Engine.create(cachier);

// write to the DB (3rd arg "true")
await engine.register([{
  name: 'template',
  content: '\
    <ol>\
      <li>${ await include`part1` }</li>\
      <li>${ await include`part2` }</li>\
    </ol>\
  '
},{
  name: 'part1',
  content: 'First Name: "${it.firstName}"'
},{
  name: 'part2',
  content: 'Last Name: "${it.lastName}"'
},{
  name: 'context',
  content: {
    firstName: 'John',
    lastName: 'Doe'
  }
}], false, true);

// reads "template" from from IndexedDB "my-indexed-db-name"
const renderer = await engine.compile();
// reads "context" from IndexedDB "my-indexed-db-name"
// reads any included partials by name from IndexedDB "my-indexed-db-name"
const rslt = await renderer();
/* rslt:
  <ol>
    <li>First Name: "John"</li>
    <li>Last Name: "Doe"</li>
  </ol>
*/
```

Alternatively, we could have invoked the same renderer by passing in a different context:

```js
// use a different context on the same renderer
const rslt = await renderer({
  firstName: 'Jane',
  lastName: 'Doe'
});
/* rslt:
  <ol>
    <li>First Name: "Jane"</li>
    <li>Last Name: "Doe"</li>
  </ol>
*/
```

Now that the template, partials and context are written to the database, we can use the written content as default values when a template, partial and/or context are not specified. This decouples stored content from any single `Engine` instance or rederering function.

```js
const Engine = require('templeo'), CachierDB = require('templeo/lib/cachier-db');
const cachier = new CachierDB({ dbLocName: 'my-indexed-db-name' });
const engine = Engine.create(cachier);

// reads "template" from from IndexedDB "my-indexed-db-name"
const renderer = await engine.compile();
// reads "context" from IndexedDB "my-indexed-db-name"
// reads any included partials by name from IndexedDB "my-indexed-db-name"
const rslt = await renderer();
/* rslt:
  <ol>
    <li>First Name: "John"</li>
    <li>Last Name: "Doe"</li>
  </ol>
*/
```

The versatility of `CachierDB` really shines when using different databases/[`options.dbLocName`](module-templeo_options.html#.DBOptions) to define multiple template content/context for distinct use cases.

#### 📁 [File System (Node.js)](https://nodejs.org/api/fs.html) <sub id="fs"></sub>

Using a file system is the recommended caching mechanism to use when processing templates within a Node.js server. It offers many benefits over the default caching. One of which is that it integrates well with view plugins/middleware that expect a file system to be present. There isn't much of a need to manually register partials. Instead, they can be read from a directory/sub-directories during compilation and/or rendering initialization. Another advantage is that the file system can [watch template partial directories](#watchers) for file changes and update template content accordingly without any manual intervention. Calling [Engine.register](Cachier.html#register) with the _read_ flag set to `true` or when an [include](tutorial-1-basics.html#include) is encountered during rendering that does not have a registered template source, the follwing sequence will apply:
- An attempt to retrieve the template from the __rendering function's temporary memory__ will be made
- When not in memory, an attempt to retrieve the template from the __file system__ will be made using [`options.partialsPath`](module-templeo_options.html#.FileOptions)
- When not in the file system, an attempt to retrieve the template from __the HTTP/S [`options.partialsURL`](module-templeo_options.html#.Options)__
- When no `options.partialsURL` is set or retrieval fails, an error is thrown

```js
const Engine = require('templeo'), CachierFiles = require('templeo/lib/cachier-files');
// create a cachier for the file system that uses the current directory
// for HTML partials
const cachier = new CachierFiles({
  relativeTo: '.',
  partialsPath: 'views/partials/html'
});
const engine = Engine.create(cachier);
```

__👁️ File/Directory Watchers:<sub id="watchers"></sub>__<br/><br/>
Template directories can be automatically watched for newly create, updated and removed templates. When a newly created template file is created it will automatically be registered in memory as a new template source using a formatted version of the file name as the registered template name.