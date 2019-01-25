### 🚂 The Template Engine
At the heart of template compilation and rendering is the [Template Engine](module-templeo-Engine.html). It handles compiling [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) into __stand-alone/independent__ _rendering functions_ that __can be ran in either the same VM in which they were compiled or an entirely new VM!__ Each rendering function is responsible for outputting templated results based upon _context_ data supplied to the function in JSON format. The `Engine` is also responsible for handling _partial_ template fragments that may be included/nested within other template(s) that are being rendered. Any distribution of included partial templates can be resolved/loaded/read during __compile-time__ or __render-time__. This flexibility allows for some partial template inclusions to be loaded during compilation while others can be loaded when the template(s) are actually encountered during rendering.

> The following tutorials assume a basic knowledge of [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) and [Tagged Template Literal Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates).

### ⛓️ include <sub id="include"></sub>

The `include` _directive_ provides a standard [ECMAScript Tagged Template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates) function that accepts a template literal and loads/outputs one or more resolved partial templates that have a matching partial `name` used during [registration](module-templeo.Engine.html#registerPartial).

> There are many different ways an `include` can capture/read template __content__ and/or __context__. The built-in technique is either _manual registration_ or reading/loading them via [HTTP client requests](Cachier.html). Reads can also come from a [file system](index.html#caching), a [database](index.html#caching) or any other desired source. What happens when a `read` takes place is determined by the [Cachier](Cachier.html) used on the `Engine` using [`Engine.create(cachier:Cachier)`](module-templeo.Engine.html#.create).

__Although, we are not limited to just HTML__, we'll start with some simple HTML templates to illustrate basic `include` usage. Assume that we have the following templates and context...

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

Assuming that the aforementioned sources are accessible from an HTTP server, we can assign a server URL to the [`options.templatePathBase`](module-templeo_options.html#.Options). Any partial template that is not registered when calling [`Engine.registerPartials(partials)`](module-templeo.Engine.html#registerPartials) will be fetched from the server by appending the partial name from the include to the `templatePathBase`. For example, with `templatePathBase = 'https://localhost:8080'` and an `` include`first/item` ``, a read/fetch will be made to `https://localhost:8080/first/item.html` (the file extension is determined by [`options.defaultExtension`](module-templeo_options.html#.Options)).

Likewise, if template _content_ is not specified when calling [`Engine.compile(content)`](module-templeo.Engine.html#compile), an atempt will be made to read/fetch the content from `https://localhost:8080/template.html`. The "template" name can be configured using [`options.defaultTemplateName`](module-templeo_options.html#.Options).

The same read/fetch criteria applies to the _context_ used when invoking the rendering function. If no context is specified when calling `renderer(context)`, an attempt will be made to read/fetch `https://localhost:9000/context.json` at render-time (assuming that [`options.contextPathBase`](module-templeo_options.html#.Options) is set to `https://localhost:9000`). The "context" name can be configured using [`options.defaultContextName`](module-templeo_options.html#.Options).

```js
// read the template at compile-time, the template context at render-time
// and the partial templates as includes are encountered during render-time
const { Engine } = require('templeo');
const engine = new Engine({
  templatePathBase: 'https://localhost:8080',
  contextPathBase: 'https://localhost:9000'
});
const renderer = await engine.compile();
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

The same output could also be accomplished by either registering partials _manually_ by passing them into [registerPartials(partials)](module-templeo.Engine.html#registerPartials). Any partials that are not registered will be read/loaded either at __compile-time__ (when calling `registerPartials`) or at __render-time__ when an `include` is encountered during rendering that has not yet been registered.

```js
// OPTION 1:
// manually register partial content
engine.registerPartails([
  { name: 'first/item', content: preloadedContent1 },
  { name: 'second/item', content: preloadedContent2 }
]);
// OPTION 2:
// read/load defined partials at compile-time
engine.registerPartails([
  { name: 'first/item' },
  { name: 'second/item' }
], true); // true for read/fetch on compile
// OPTION 3:
// omit engine.registerPartials to read/load partials
// as includes are encountered at render-time
```

As seen in the previous examples, each `include` directive is [awaited](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await) and returns the template literal parsed output for the partials being included. A single `include` can also contain more than one partial name separated by literal strings/expressions and will be resolved in the order they are defined.

```js
engine.registerPartial('name/two', 'Two, ');
engine.registerPartial('name/four', 'Four');
const tmpl = 'One, ${ await include`name/two${ it.three }name/four` }';
const renderer = await engine.compile(tmpl);
const rslt = await renderer({ three: 'Three, ' });
console.log(rslt);
// One, Two, Three, Four
```

So far, the inclusion examples we've used have been on HTML, but any format that can be represented as a string value can be processed by Template Literals. Lets take a look at an example using the `include` directive with `json`.

```jsdocp test/views/template.jsont
// template.json
```
```jsdocp test/views/partials/json/one.jsont
// one.json
```
```jsdocp test/views/partials/json/two.jsont
// two.json
```
```jsdocp test/views/partials/json/three.jsont
// three.json
```
```jsdocp test/context/json/it.json
// context.json
```

```js
engine.registerPartial('one', );
engine.registerPartial('name/four', 'Four');
const tmpl = 'One, ${ await include`name/two${ it.three }name/four` }';
const renderer = await engine.compile(tmpl);
const rslt = await renderer({ three: 'Three, ' });
console.log(rslt);
{
  "one": {
    "two": {
      "three": 3
    }
  }
}
```