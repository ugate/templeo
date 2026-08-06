'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, describe, test } from 'node:test';
import {
  renderApiDocsFromDoclets,
  resolveInheritedDoclets,
  validateSupportedTags
} from '../docs/generate-api.mjs';
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map(dir => fs.rm(dir, { recursive: true, force: true })));
});
describe('API documentation generator', () => {
  test('rejects unsupported JSDoc tags instead of silently dropping them', () => {
    assert.throws(
      () => validateSupportedTags('/**\n * @unsupported value\n */', 'fixture.js'),
      /Unsupported JSDoc tag "@unsupported" in fixture\.js/
    );
  });
  test('inherits overridden member documentation', () => {
    const doclets = [
      { kind: 'class', name: 'Base', longname: 'Base', meta: { filename: 'cachier.js', lineno: 1 } },
      { kind: 'function', name: 'read', longname: 'Base#read', memberof: 'Base', scope: 'instance', description: 'Reads data.', params: [{ name: 'name', type: { names: ['String'] }, description: 'Data name.' }], returns: [{ type: { names: ['Object'] }, description: 'Read data.' }], meta: { filename: 'cachier.js', lineno: 2 } },
      { kind: 'class', name: 'Child', longname: 'Child', augments: ['Base'], meta: { filename: 'cachier-db.js', lineno: 1 } },
      { kind: 'function', name: 'read', longname: 'Child#read', memberof: 'Child', scope: 'instance', override: true, meta: { filename: 'cachier-db.js', lineno: 2 } }
    ];
    const resolved = resolveInheritedDoclets(doclets);
    const child = resolved.find(doclet => doclet.longname === 'Child#read');
    assert.equal(child.description, 'Reads data.');
    assert.equal(child.params[0].name, 'name');
    assert.equal(child.returns[0].type.names[0], 'Object');
  });
  test('excludes undocumented JSDoc symbols and safely renders signatures', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-docs-'));
    tempDirs.push(dir);
    const doclets = [
      { kind: 'module', name: 'templeo', longname: 'module:templeo', description: 'Micro rendering template engine.', meta: { filename: 'index.js', lineno: 1 } },
      { kind: 'function', name: '<anonymous>', longname: 'module:templeo~<anonymous>', undocumented: true, meta: { filename: 'index.js', lineno: 2 } },
      { kind: 'class', name: 'Engine', longname: 'module:templeo~Engine', description: 'Engine class.', params: [{ name: 'factory<Class>', type: { names: ['Class<Engine>'] }, description: 'Factory.' }], meta: { filename: 'index.js', lineno: 3 } }
    ];
    const result = await renderApiDocsFromDoclets(doclets, dir);
    assert.equal(result.docletCount, 2);
    const engine = await fs.readFile(path.join(dir, 'engine.md'), 'utf8');
    assert.doesNotMatch(engine, /<anonymous>/);
    assert.match(engine, /## `new Engine\(factory<Class>\)`/);
    assert.match(engine, /`Class<Engine>`/);
  });
  test('assigns unique anchors to duplicate accessor doclets and keeps links canonical', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-docs-'));
    tempDirs.push(dir);
    const doclets = [
      { kind: 'class', name: 'Engine', longname: 'module:templeo~Engine', description: 'Engine class.', meta: { filename: 'index.js', lineno: 1 } },
      { kind: 'member', name: 'legacyRenderOptions', longname: 'module:templeo~Engine#legacyRenderOptions', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Reads legacy options.', returns: [{ type: { names: ['Object'] } }], meta: { filename: 'index.js', lineno: 2 } },
      { kind: 'member', name: 'legacyRenderOptions', longname: 'module:templeo~Engine#legacyRenderOptions', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Writes legacy options.', params: [{ name: 'options', type: { names: ['Object'] } }], meta: { filename: 'index.js', lineno: 3 } },
      { kind: 'function', name: 'usesLegacyOptions', longname: 'module:templeo~Engine#usesLegacyOptions', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Uses [Engine.legacyRenderOptions](./Engine.legacyRenderOptions).', meta: { filename: 'index.js', lineno: 4 } }
    ];
    await renderApiDocsFromDoclets(doclets, dir);
    const engine = await fs.readFile(path.join(dir, 'engine.md'), 'utf8');
    assert.equal([...engine.matchAll(/\{#engine-legacyrenderoptions}/g)].length, 1);
    assert.equal([...engine.matchAll(/\{#engine-legacyrenderoptions-2}/g)].length, 1);
    assert.match(engine, /\[Engine\.legacyRenderOptions]\(#engine-legacyrenderoptions\)/);
  });
  test('resolves class links to page headings when JSDoc marks the class undocumented', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-docs-'));
    tempDirs.push(dir);
    const doclets = [
      { kind: 'class', name: 'Director', longname: 'Director', undocumented: true, meta: { filename: 'director.js', lineno: 1 } },
      { kind: 'function', name: 'getDirectives', longname: 'Director.getDirectives', memberof: 'Director', scope: 'static', description: 'Uses [Director](./Director).', meta: { filename: 'director.js', lineno: 2 } },
      { kind: 'function', name: 'usesDirector', longname: 'Sandbox.usesDirector', memberof: 'Sandbox', scope: 'static', description: 'Uses [Director](./Director).', meta: { filename: 'sandbox.js', lineno: 1 } }
    ];
    await renderApiDocsFromDoclets(doclets, dir);
    const director = await fs.readFile(path.join(dir, 'lib', 'director.md'), 'utf8');
    const sandbox = await fs.readFile(path.join(dir, 'lib', 'sandbox.md'), 'utf8');
    assert.match(director, /\[Director]\(#director\)/);
    assert.match(sandbox, /\[Director]\(\.\/director#director\)/);
    assert.doesNotMatch(director, /\]\(\.\/Director\)/);
    assert.doesNotMatch(sandbox, /\]\(\.\/Director\)/);
  });
  test('rewrites JSDoc relative symbol links to generated anchors', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-docs-'));
    tempDirs.push(dir);
    const doclets = [
      { kind: 'class', name: 'Engine', longname: 'module:templeo~Engine', description: 'Engine class.', meta: { filename: 'index.js', lineno: 1 } },
      { kind: 'function', name: 'compile', longname: 'module:templeo~Engine#compile', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Compiles.', meta: { filename: 'index.js', lineno: 2 } },
      { kind: 'member', name: 'legacyRenderOptions', longname: 'module:templeo~Engine#legacyRenderOptions', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Legacy options.', meta: { filename: 'index.js', lineno: 3 } },
      { kind: 'function', name: 'registerPartial', longname: 'module:templeo~Engine#registerPartial', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Registers a partial.', meta: { filename: 'index.js', lineno: 4 } },
      { kind: 'function', name: 'register', longname: 'module:templeo~Engine#register', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Registers data.', meta: { filename: 'index.js', lineno: 5 } },
      { kind: 'function', name: 'renderPartial', longname: 'module:templeo~Engine#renderPartial', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Renders a partial.', meta: { filename: 'index.js', lineno: 6 } },
      { kind: 'function', name: 'linkExamples', longname: 'module:templeo~Engine#linkExamples', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Uses [Engine.legacyRenderOptions](./Engine.legacyRenderOptions), [Engine.compile](./Engine.compile), [Engine.registerPartial](./Engine.registerPartial), [Engine.register](./Engine.register), and [Engine.renderPartial](./Engine.renderPartial).', meta: { filename: 'index.js', lineno: 7 } },
      { kind: 'class', name: 'Director', longname: 'Director', description: 'Director class.', meta: { filename: 'director.js', lineno: 1 } },
      { kind: 'function', name: 'toString', longname: 'Director.toString', memberof: 'Director', scope: 'static', description: 'Uses [Director](./Director) and [Director.toString()](./Director.toString()).', meta: { filename: 'director.js', lineno: 2 } },
      { kind: 'class', name: 'TemplateOpts', longname: 'TemplateOpts', description: 'Template options.', meta: { filename: 'template-options.js', lineno: 1 } },
      { kind: 'function', name: 'defaultOptions', longname: 'TemplateOpts.defaultOptions', memberof: 'TemplateOpts', scope: 'static', description: 'Builds defaults.', meta: { filename: 'template-options.js', lineno: 2 } },
      { kind: 'function', name: 'defaultOptionMerge', longname: 'TemplateOpts.defaultOptionMerge', memberof: 'TemplateOpts', scope: 'static', description: 'Uses [TemplateOpts.defaultOptions](./TemplateOpts.defaultOptions) and [TemplateOpts.defaultOptionMerge](./TemplateOpts.defaultOptionMerge).', meta: { filename: 'template-options.js', lineno: 3 } },
      { kind: 'function', name: 'externalLinks', longname: 'Sandbox.externalLinks', memberof: 'Sandbox', scope: 'static', description: 'Uses [Engine.compile](./Engine.compile), [Director](./Director), and [TemplateOpts.defaultOptions](./TemplateOpts.defaultOptions).', meta: { filename: 'sandbox.js', lineno: 1 } }
    ];
    await renderApiDocsFromDoclets(doclets, dir);
    const engine = await fs.readFile(path.join(dir, 'engine.md'), 'utf8');
    const director = await fs.readFile(path.join(dir, 'lib', 'director.md'), 'utf8');
    const options = await fs.readFile(path.join(dir, 'lib', 'template-options.md'), 'utf8');
    const sandbox = await fs.readFile(path.join(dir, 'lib', 'sandbox.md'), 'utf8');
    for (const markdown of [engine, director, options, sandbox]) assert.doesNotMatch(markdown, /\]\(\.\/(?:Engine|Director|TemplateOpts)/);
    assert.match(engine, /\[Engine\.legacyRenderOptions]\(#engine-legacyrenderoptions/);
    assert.match(engine, /\[Engine\.compile]\(#engine-compile/);
    assert.match(engine, /\[Engine\.registerPartial]\(#engine-registerpartial/);
    assert.match(engine, /\[Engine\.register]\(#engine-register/);
    assert.match(engine, /\[Engine\.renderPartial]\(#engine-renderpartial/);
    assert.match(director, /\[Director]\(#new-director/);
    assert.match(director, /\[Director\.toString\(\)]\(#director-tostring/);
    assert.match(options, /\[TemplateOpts\.defaultOptions]\(#templateopts-defaultoptions/);
    assert.match(options, /\[TemplateOpts\.defaultOptionMerge]\(#templateopts-defaultoptionmerge/);
    assert.match(sandbox, /\[Engine\.compile]\(\.\.\/engine#engine-compile/);
    assert.match(sandbox, /\[Director]\(\.\/director#new-director/);
    assert.match(sandbox, /\[TemplateOpts\.defaultOptions]\(\.\/template-options#templateopts-defaultoptions/);
  });
  test('renders descriptions, parameters, properties, returns, examples and links', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-docs-'));
    tempDirs.push(dir);
    const doclets = [
      { kind: 'module', name: 'templeo', longname: 'module:templeo', description: 'Micro rendering template engine.', examples: ['const engine = true;'], meta: { filename: 'index.js', lineno: 1 } },
      { kind: 'class', name: 'Engine', longname: 'module:templeo~Engine', description: 'Engine class.', params: [{ name: 'opts', optional: true, type: { names: ['Object'] }, description: 'Options.' }], meta: { filename: 'index.js', lineno: 2 } },
      { kind: 'function', name: 'compile', longname: 'module:templeo~Engine#compile', memberof: 'module:templeo~Engine', scope: 'instance', description: 'Compiles with {@link Cachier}.', params: [{ name: 'content', type: { names: ['String'] }, description: 'Template content.' }], returns: [{ type: { names: ['Function'] }, description: 'Renderer.' }], examples: ['await engine.compile("hello");'], see: ['{@link Sandbox.compile}'], meta: { filename: 'index.js', lineno: 3 } },
      { kind: 'typedef', name: 'Options', longname: 'module:templeo/options.Options', type: { names: ['Object'] }, properties: [{ name: 'debugger', optional: true, defaultvalue: false, type: { names: ['Boolean'] }, description: 'Enables debugging.' }], meta: { filename: 'template-options.js', lineno: 1 } },
      { kind: 'class', name: 'Cachier', longname: 'Cachier', description: 'Cache class.', meta: { filename: 'cachier.js', lineno: 1 } },
      { kind: 'class', name: 'Sandbox', longname: 'Sandbox', description: 'Sandbox class.', meta: { filename: 'sandbox.js', lineno: 1 } },
      { kind: 'function', name: 'compile', longname: 'Sandbox.compile', memberof: 'Sandbox', scope: 'static', description: 'Compiles a renderer.', meta: { filename: 'sandbox.js', lineno: 2 } }
    ];
    const result = await renderApiDocsFromDoclets(doclets, dir);
    assert.equal(result.pageCount, 10);
    const engine = await fs.readFile(path.join(dir, 'engine.md'), 'utf8');
    assert.match(engine, /# Engine/);
    assert.match(engine, /new Engine\(\[opts\]\)/);
    assert.match(engine, /\| content \| `String` \| Template content\. \|/);
    assert.match(engine, /#### Returns/);
    assert.match(engine, /```js\nawait engine\.compile/);
    assert.match(engine, /Compiles with \[Cachier\]/);
    const options = await fs.readFile(path.join(dir, 'lib', 'template-options.md'), 'utf8');
    assert.match(options, /#### Properties/);
    assert.match(options, /\[debugger=false\]/);
  });
});
