### 🏎️ The Template Engine
At the heart of template compilation/rendering is the [Template Engine](module-templeo-Engine.html). It handles compiling features, options and any number of nested "_partial_" templates into a __stand-alone__ rendering function that __can be ran in either the same VM in which it was compiled or an entirely new VM!__ Rendering functions are fully independent from _any_ internal or external dependencies and can be serialized/deserialized on-demand. They are responsible for outputting parsed [template literal expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) using a specified JSON context as a primary datasource for rendering. The `Engine` handles _partial_ template fragments that may be included/nested within other template(s) that are being rendered. Any distribution of included partial templates can be resolved/loaded/read during __compile-time__ or __render-time__. This flexibility allows for some partial template inclusions to be loaded during compilation while others can be loaded when the template(s) are actually encountered during rendering.

> TOC
- [Metadata &amp; Context](#meta-context)
- [Directives](#directives)
  - [`include`](#include)
  - [`repeat`](#repeat)
  - [`comment`](#comment)
- [Conditional Statements](#conditionals)
- [Helper Directives](#helpers)

The following tutorials assume a basic knowledge of [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) and [Tagged Template Literal Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates).

The example below illustrates basic usage that is typical with most template engine implementations.

```js
// Raw Template Literal:
const it = { name: 'World' };
console.log(`<html><body>Hello ${ it.name }!</body></html>`);

// Compiled/Rendered Template Literals using an Engine
const Engine = require('templeo');
const engine = new Engine();
const renderer = await engine.compile('<html><body>Hello ${ it.name }!</body></html>');
const rslt = renderer({ name: 'World' });
console.log(rslt);

// Both examples above output:
// <html><body>Hello World!</body></html>
```

You may have noticed that there isn't much difference between the _raw_ template example above and the _compiled_/_rendered_ template example. One advantage that an `Engine` has over parsing raw template literals is reusability. Parsing raw templates requires both the template and the context to be known up-front and leaves the template exposed to any variables that may be in scope. Using an `Engine` isolates the template variables to global scope (and `require`, when available). The rendering function can also be serialized/deserialized to a file system or other persistent source. __Although you'd typically would not need to manually serialize/deserialize rendering functions__, the example below demonstrates a simplified serialization/deserialization sequence that is typically performed by the [Cachier](Cachier.html) assigned to an `Engine`. There are also [other ways](#primary-template-read) to read and/or write the template content and context instead of passing them in as arguements.

```js
// Demo purposes only:
// save the rendering function to a persistent source
saveRenderFunction('myRenderFunction.js', renderer.toString());
// ... sometime later (maybe even on another machine/VM/etc.)
const renderer = loadRenderFunction('myRenderFunction.js');
const rslt = renderer({ name: 'World' });
```

There are many other advantages to using an `Engine` over raw template literals that we'll discuss in more details in subsequent tutorial sections.

#### 📃 Metadata and Context <sub id="meta-context"></sub>

Each template has a finite set of variable data that is accessible from within the template scope. As seen in the previous example, there is the `context` variable that is passed into the `renderer`. Other than the supplied [directive functions](#directives), there are a few variables that are defined within scope of each template:
- __`context`__ The variable passed into the rendering function that is accessible to both the template being rendered and any child/partial templates that may be included within it. Also available via the [`options.varName`](module-templeo_options.html#.Options) alias (defaults to `it`, e.g. `renderer({ myVar: 'Hello' })` would be accessed via `${ it.myVar } World!` and interpolated into `Hello World!`).
- __`metadata`__ Contains metadata about the template such as the _name_ assigned to the template, _parent_ metadata when the template is nested and other data pertaining to the template compilation/rendering.
- __`params`__ Any [include parameters](#include-params) passed into the template. The `params` name may vary depending upon [options.includesParametersName](module-templeo_options.html#.Options).

## ⚡ Directives <sub id="directives"></sub>

The built-in directives (also see the [conditionals section](#conditionals)):
- [🔗 `include`](#include)
- [🔁 `repeat`](#repeat)
- [💭 `comment`](#comment)

Directives are functions that assist in the templatating process to ease the amount of effort exerted during template creation. Each function performs a specific task during [interpolation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Expression_interpolation).

### 🔗 include <sub id="include"></sub>

The `include` _directive_ provides a standard [ECMAScript Tagged Template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates) _async_ function that accepts a template literal and loads/outputs one or more resolved partial templates that have a matching partial `name` used during [registration](module-templeo.Engine.html#registerPartial).

> There are many different ways an `include` can capture/read template __content__ and/or __context__. The built-in technique is either _manual registration_ or reading/loading them via [HTTP client requests](Cachier.html). Reads can also come from a [file system](index.html#caching), a [database](index.html#caching) or any other desired source. What happens when a `read` takes place is determined by the [Cachier](Cachier.html) used on the `Engine` using [`Engine.create(cachier:Cachier)`](module-templeo.Engine.html#.create).

Although, we are not limited to just HTML, we'll start with some simple HTML templates to illustrate basic `include` usage. Assume that we have the following templates and context...

```html
<!-- https://localhost:8080/template.html -->
<!DOCTYPE html>
<html>
  <head>
    <title>Hello ${ it.name }!</title>
  </head>
  <body>
    ${ await include`first/item` }
  </body>
</html>
```

```html
<!-- https://localhost:8080/first/item.html -->
<ol>
  <li>This is the first partial named ${ it.first }</li>
  ${ await include`second/item` }
</ol>
```

```html
<!-- https://localhost:8080/second/item.html -->
<li>This is the second partial named ${ it.second }</li>
```

```js
// https://localhost:9000/context.json
{
  "name": "World",
  "first": "#1",
  "second": "#2"
}
```

__The primary template (compile-time or render-time)__ <sub id="primary-template-read"></sub><br/>
Using the example sources above, when `true` is passed as the template _content_ when calling [`Engine.compile(true)`](module-templeo.Engine.html#compile), an attempt will be made to read the primary template content __during compilation__ and will be reused for each call to the generated `renderer`. When the template _content_ is __not of type `string`__, an attempt will be made to read/fetch the content from `https://localhost:8080/template.html` _every time_ the `renderer` is called. The "template" name can be configured using [`options.defaultTemplateName`](module-templeo_options.html#.Options) and the file extension is determined by [`options.defaultExtension`](module-templeo_options.html#.Options).

__Partials (compile-time or render-time)__<br/>
Assuming that the aforementioned sources are accessible from an HTTP server, we can assign a server URL to the [`options.partialsURL`](module-templeo_options.html#.Options). Any partial template that are __not__ registered during compilation by calling [`Engine.register`](module-templeo.Engine.html#register) will be fetched from the server by appending the partial name from the include to the `partialsURL`. For example, with `partialsURL = 'https://localhost:8080'` and an `` include`first/item` ``, a read/fetch will be made to `https://localhost:8080/first/item.html`. The file extension is determined by [`options.defaultExtension`](module-templeo_options.html#.Options).

__The context (render-time)__<br/>
The same read/fetch criteria applies to the _context_ used when invoking the rendering function. If no context is specified when calling `renderer(context)`, an attempt will be made to read/fetch `https://localhost:9000/context.json` when the renderer is called (assuming that [`options.contextURL`](module-templeo_options.html#.Options) is set to `https://localhost:9000`). The "context" name can be configured using [`options.defaultContextName`](module-templeo_options.html#.Options) and the file extension is determined by [`options.defaultContextExtension`](module-templeo_options.html#.Options).

```js
// read the template at compile-time, the template context at render-time
// and the partial templates as includes are encountered during render-time
const Engine = require('templeo');
const engine = new Engine({
  contextURL: 'https://localhost:9000',
  partialsURL: 'https://localhost:8080'
});
// Read the template a single time during compilation
// and use it each time the renderer is called:
const renderer = await engine.compile(true);
// Defer reads until the renderer is called:
// const renderer = await engine.compile();
const rslt = await renderer();
console.log(rslt);
```

OUTPUT:

```html
<!-- rendered results -->
<!DOCTYPE html>
<html>
  <head>
    <title>Hello World!</title>
  </head>
  <body>
    <ol>
      <li>This is the first partial named #1</li>
      <li>This is the second partial named #2</li>
    </ol>
  </body>
</html>
```

The same output could also be accomplished by either registering partials _manually_ by passing them into [`Engine.register(data)`](module-templeo.Engine.html#register). Any partials that are not registered will be read/loaded either at __compile-time__ (when calling `register`) or at __render-time__ when an `include` is encountered during rendering that has not yet been registered.

```js
// OPTION 1:
// manually register partial content prior to compiling
engine.register([
  { name: 'first/item', content: preloadedContent1 },
  { name: 'second/item', content: preloadedContent2 }
]);
// OPTION 2:
// read/load defined partials prior to compiling
engine.register([
  { name: 'first/item' },
  { name: 'second/item' }
], true); // true for read/fetch during compile
// OPTION 3:
// omit engine.register to read/load partials
// as includes are encountered at render-time
```

Like registering partial templates, the primary template and context can also be _passed_ instead of read/loaded by the `Engine` (as illustrated below).

```js
const templateString = getMyTemplate();
const contextJSON = getMyContext();
const renderer = await engine.compile(templateString);
const rslt = await renderer(contextJSON);
```

#### Parameter Passing <sub id="include-params"></sub>

Not only can _includes_ load/`read` template and context at compile-time or render-time, but they can also contain __parameters__ obtained during [interpolation](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Expression_interpolation). There are two types of parameters that can be passed into an `include`:
- [`URLSearchParams`](https://developer.mozilla.org/en-US/docs/Web/API/URLSearchParams) - When an expression being passed into the `include` interpolates into a `URLSearchParams` instance, either the partial template content from a prior include with the same parameters/values is used __or__ the parameters are passed into the [`read` operation](Cachier.html#read) in order to fetch a new copy of the raw partial template contents.
- `JSON` - When an expression interpolates into an ordinary JSON object, the object will be in accessible __only__ within the partial for which it is being included into. Access is made available via the [`options.includesParametersName`](module-templeo_options.html#.Options) alias (defaults to "`params`"). JSON parameters are never passed when fetching/reading partial content.

This makes for some interesting capabilities. `URLSearchParams` can be used to dynamically generate template sources based on parameters being passed, while JSON parameters can dynamically generate template sources within the partial template itself. Consider the following examples.

```js
// register some partials
engine.register([
  {
    name: 'second/item',
    params: new URLSearchParams({
      param1: 123
    })
  }
], true);
const renderer = await engine.compile(myTemplate);
const rslt = await renderer({
  my1stParams: {
    param1: 456
  }
});
// Assume the following snippets exist in "myTemplate"...

// 1st include:
// initiates a read w/o parameters since "first/item" is not registered and has no content
${ await include`first/item` }
// 2nd include:
// initiates a read with new parameters: { param1: 456 }
${ await include`first/item ${ new URLSearchParams(it.my1stParams) }` }
// 3rd include:
// uses the last cached "first/item" content from the 1st include w/o params
${ await include`first/item` }
// 4th include:
// uses the last cached "first/item" content from the 1st include w/o params
// and "params" is accessible only within this included partial fragment
// as: ${ params.env === 'TEST' }
${ await include`first/item ${ { env: 'TEST' } }` }

// 1st include:
// initiates a read with compile-time parameters: { param1: 123 }
${ await include`second/item` }
// 2nd include:
// initiates a read with new parameters: { param2: 789 }
${ await include`second/item ${ new URLSearchParams({ param2: 789 }) }` }
// 3rd include:
// uses last cached "second/item" content from 2nd include with same params/values
${ await include`second/item ${ new URLSearchParams({ param2: 789 }) }` }

// includes can even be combined
// Each pair of partial name and parameter expression are handled independently from one another
// e.g. first/item with param1=456 and second/item with env=TEST are independent from one another
${ await include`first/item ${ new URLSearchParams(it.my1stParams) } second/item ${ { env: 'TEST' } }` }
```

So far, the inclusion examples we've used have been on HTML, but any format that can be represented as a string value can be processed by Template Literals. Lets take a look at an example using the `include` directive with `json`.

```jsdocp test/views/template.jsont
// https://localhost:8080/template.json
```
```jsdocp test/views/partials/json/one.jsont
// https://localhost:8080/one.json
```
```jsdocp test/views/partials/json/two.jsont
// https://localhost:8080/two.json
```
```jsdocp test/views/partials/json/three.jsont
// https://localhost:8080/three.json
```
```jsdocp test/context/json/context.json
// https://localhost:9000/context.json
```

Using the sources above, the JSON could be rendered doing:

```js
// read the template at compile-time, the template context at render-time
// and the partial templates as includes are encountered during render-time
const Engine = require('templeo');
const engine = new Engine({
  contextURL: 'https://localhost:9000',
  partialsURL: 'https://localhost:8080'
});
const renderer = await engine.compile();
const rslt = await renderer();
console.log(rslt);
// { "one": { "two": { "three": 3 } } }
```

### 🔁 repeat <sub id="repeat"></sub>

The `repeat` directive iterates over a series of values or properties. Each iterated template is natively parsed only when iterating occurs within the scope of the passed function. The `repeat` directive takes two arguments:
- `iterable` - The iterable array, array-like objects, etc. that will be repeated in the form of a [`for of`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...of) loop or an iterable non-symbol enumerable whose properties will be traversed in the form of a [`for in`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/for...in) loop
- `function` - The function that will return a result for each iteration.
  - When using `for of` the follwing arguments will be passed:
    - `item` The item being iterated
    - `index` The index of the current iteration
  - When using `for in` the following will be passed:
    - `key` The property/key being traversed
    - `value` The value accessed using the current key
    - `index` The index of the current traversal

The subsequent example illustrates the use of a `for of` loop:

```html
<!-- for of -->
<select id="mySelectionList">
  ${ repeat(it.mySelectionList, (value, index) => `
    <option id="mySelectionList${ index }" value="${ value }">${ value }</option>
  `)}
</select>
```
Lets assume we have a context that contains an object called "_states_" where each _property name_ is an abbreviation for a state in the USA and the full state name is it's _value_ (i.e. `{ states: { AL: "Alabama", ... } }`).

```html
<!-- for in -->
<select id="state">
  ${ repeat(it.states, (abbr, state, index) => `
    <option id="stateSelect${ abbr }" value="${ abbr }" data-index="${ index }">${ state }</option>
  `)}
</select>
```

### 💭 comment <sub id="comment"></sub>

The `comment` directive is a standard [ECMAScript Tagged Template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates) that simply _consumes_ an interpolated value from the output.

```html
<!-- input -->
<div>
  ${ comment` This is a comment ` }
  Other content here...
</div>

<!-- output -->
<div>

  Other content here...
</div>
```

### ↩️ Conditional Statements <sub id="conditionals"></sub>

There isn't any built-in directives for control flow since the syntax is already made available using [ternary operators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator) or a [helper directive](#helpers).

```html
<!-- ternary operator example -->
<div>
  ${ it.person.name ? `
    <h1> Hello ${ it.person.name }! </h3>
  ` : `
    <input id="personName" placeholder="Please enter your name">
  `
  }
</div>
```

### 🖐️ Helper Directives <sub id="helpers"></sub>

Helper directives are __serializable named functions__ that can be accessed within template interpolations. Each function must contain a valid __name__ and should _not_ contain any external scope/closure references other than:
- _global variables_
- [metadata](#meta-context)
- [context](#meta-context)
- [built-in directives](#directives)
- `require` (when available)

They can be registered as _synchronous_ or _`async`hronous_ functions at compile-time using [`Engine.registerHelper`](module-templeo.Engine.html#registerHelper) and should return a value that will be interpolated. Below is an example of how a helper directive can be used to produce conditional template sources.

```js
const Engine = require('templeo');
const engine = new Engine();

const template = '<html><body>${ hasPerson(it) }</body></html>';
const renderer = await engine.compile(template);
// helper directive functions must have a name
engine.registerHelper(function hasPerson(it) {
  if (it.person && it.person.name) {
    return `<h1> Hello ${ it.person.name }! </h1>`;
  } else {
    return `<input id="personName" placeholder="Please enter your name">`;
  }
});

const rslt = await renderer({ person: { name: 'World' } });
console.log(rslt);
// <html><body><h1> Hello World! </h1></body></html>
```