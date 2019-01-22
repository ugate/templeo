### 🚂 The Template Engine
At the heart of template compilation and rendering is the [Template Engine](module-templeo-Engine.html). It handles compiling [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) into __stand-alone/independent__ _rendering functions_ that __can be ran in either the same VM in which they were compiled or an entirely new VM!__ Each rendering function is responsible for outputting templated results based upon _context_ data supplied to the function in JSON format. The `Engine` is also responsible for handling _partial_ template fragments that may be included/nested within other template(s) that are being rendered. Any distribution of included partial templates can be resolved/loaded/read during __compile-time__ or __render-time__. This flexibility allows for some partial template inclusions to be loaded during compilation while others can be loaded when the template(s) are actually encountered during rendering.

> The following tutorials assume a basic knowledge of [Template Literals](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals) and [Tagged Template Literal Functions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates).

#### ⛓️ `include`

The `include` _directive_ provides a standard [ECMAScript Tagged Template](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Template_literals#Tagged_templates) function that accepts a template literal and loads/outputs one or more resolved partial templates that have a matching partial `name` used during [registration](module-templeo.Engine.html#registerPartial).

> There are better ways to [automatically register partials using `Cachier`s](), but for illustrational purposes we'll be registering them manually using `registerPartial`.

__Although, we are not limited to HTML__, we'll start with some simple HTML templates to illustrate its use. Assume that we have the following templates...

```html
<!-- template.html -->
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
<!-- first.html -->
<ol>
  <li>This is the first partial named ${ it.first }</li>
  ${ await include`second/item` }
</ol>
```

```html
<!-- second.html -->
<li>This is the second partial named ${ it.second }</li>
```

Also assume the following __context__ JSON...

```json
{
  "name": "templeo",
  "first": "#1",
  "second": "#2"
}
```

Using the aforementioned sources we can compile and render the results.

```js
// There are different supplied methods to load resources - see Cachier
// "template" contains the HTML template
// "first" contains the HTML for 1st partial
// "second" contains the HTML for the 2nd partial
// "context" contains the JSON data
const { Engine } = require('templeo');
const engine = new Engine();
engine.registerPartial('first/item', first);
engine.registerPartial('second/item', second);
const renderer = await engine.compile(template);
const rslt = await renderer(context);
console.log(rslt);
```

The output to the console would contain the following:

```html
<!-- rendered results -->
<!DOCTYPE html>
<html>
  <head>
    <title>Hello templeo!</title>
  </head>
  <body>
    <ol>
      <li>This is the first partial named #1</li>
      <li>This is the second partial named #2</li>
    </ol>
  </body>
</html>
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
So far, we've illustrated __compile-time__ inclusions. We could also 