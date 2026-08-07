'use strict';

import { afterEach, describe, test } from 'node:test';
import * as Assert from 'node:assert/strict';
import * as Fs from 'node:fs';
import * as Http from 'node:http';
import * as Os from 'node:os';
import * as Path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import Engine from '../index.js';
import Cachier from '../lib/cachier.js';
import CachierDB from '../lib/cachier-db.js';
import CachierFiles from '../lib/cachier-files.js';
import TemplateOpts from '../lib/template-options.js';

const TEST_TIMEOUT_MS = 10000;
const roots = new Set();
const engines = new Set();

describe('Templeo v3 regressions', { concurrency: false }, () => {
  afterEach(async () => {
    for (const engine of engines) await engine.close();
    engines.clear();
    for (const root of roots) await Fs.promises.rm(root, { recursive: true, force: true });
    roots.clear();
  });

  test('defaults generated modules to ESM and preserves explicit CommonJS opt-in', async () => {
    const esm = new Cachier();
    Assert.equal(new TemplateOpts().useCommonJs, false);
    Assert.equal(await esm.readWriteName('renderer', esm.options, null, {}, false), 'renderer.mjs');
    Assert.equal(await esm.readWriteName('renderer', name => esm.options[name], null, {}, false), 'renderer.mjs');
    const commonJs = new Cachier({ useCommonJs: true });
    Assert.equal(await commonJs.readWriteName('renderer', commonJs.options, null, {}, false), 'renderer.cjs');
    Assert.equal(await commonJs.readWriteName('renderer', name => commonJs.options[name], null, {}, false), 'renderer.cjs');
  });

  test('writes generated files that load through native import and require semantics', { timeout: TEST_TIMEOUT_MS }, async () => {
    for (const [useCommonJs, extension] of [[false, 'mjs'], [true, 'cjs']]) {
      const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), `templeo-v3-load-${extension}-`));
      roots.add(root);
      await Fs.promises.mkdir(Path.join(root, 'partials'), { recursive: true });
      const cachier = new CachierFiles({
        relativeTo: root,
        partialsPath: 'partials',
        outputPath: 'compiled',
        useCommonJs
      });
      const engine = Engine.create(cachier);
      engines.add(engine);
      const renderer = await engine.compile('native module');
      Assert.equal(await renderer({}), 'native module');
      const modulePath = Path.join(root, 'compiled', `template.${extension}`);
      if (useCommonJs) {
        const required = createRequire(import.meta.url)(modulePath);
        Assert.equal(typeof required, 'function');
        Assert.equal(await required({}), 'native module');
      } else {
        const imported = await import(pathToFileURL(modulePath).href);
        Assert.equal(typeof imported.template, 'function');
        Assert.equal(await imported.template({}), 'native module');
      }
      await engine.close();
      engines.delete(engine);
    }
  });

  test('merges existing and supplied URL search parameters into canonical names', async () => {
    const cachier = new Cachier();
    const params = new URLSearchParams([['z', 'last'], ['a', 'first']]);
    const name = await cachier.readWriteName('remote.html?existing=value', cachier.options, params, {}, true);
    Assert.equal(name, 'remote.html?a=first&existing=value&z=last');
  });

  test('fetch reads preserve existing query parameters without duplicating supplied parameters', { timeout: TEST_TIMEOUT_MS }, async () => {
    let requestURL;
    const fixture = await createHttpServer((request, response) => {
      requestURL = request.url;
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('query content');
    });
    try {
      const cachier = new Cachier({ partialsURL: fixture.url });
      const params = new URLSearchParams([['z', 'last'], ['a', 'first']]);
      const result = await cachier.read('remote.html?existing=value', true, undefined, params);
      Assert.equal(result.content, 'query content');
      Assert.equal(requestURL, '/remote.html?a=first&existing=value&z=last');
    } finally {
      await fixture.close();
    }
  });

  test('unregister resolves raw names and removes parameterized variants', async () => {
    const engine = new Engine();
    const first = new URLSearchParams('variant=one');
    const second = new URLSearchParams('variant=two');
    await engine.registerPartial('removable', 'plain');
    await engine.registerPartial('parameterized', first);
    await engine.registerPartial('parameterized', second);
    await engine.unregister('removable');
    await engine.unregister('parameterized');
    Assert.equal(await engine.getRegistered('removable'), null);
    Assert.equal(await engine.getRegistered('parameterized', first), null);
    Assert.equal(await engine.getRegistered('parameterized', second), null);
  });

  test('getRegistered returns a usable copy of URLSearchParams', async () => {
    const engine = new Engine();
    const params = new URLSearchParams([['first', 'one'], ['second', 'two']]);
    await engine.registerPartial('parameterized-copy', params);
    const registered = await engine.getRegistered('parameterized-copy', params);
    Assert.ok(registered.params instanceof URLSearchParams);
    Assert.equal(registered.params.toString(), 'first=one&second=two');
    registered.params.set('first', 'changed');
    const reread = await engine.getRegistered('parameterized-copy', params);
    Assert.equal(reread.params.get('first'), 'one');
  });

  test('CachierDB register does not require a persistence operation when read and write are false', async () => {
    const cachier = new CachierDB();
    const result = await cachier.register([{ name: 'memory-only', content: 'stored' }]);
    Assert.equal(result.data.length, 1);
    Assert.equal((await cachier.getRegistered('memory-only')).content, 'stored');
  });

  test('CachierDB compile forwards URLSearchParams and extension in the inherited signature', async () => {
    class ProbeCachierDB extends CachierDB {
      constructor() {
        super({ renderTimePolicy: 'none' });
        this.calls = [];
      }

      async readWriteName(name, optional, params, store, forContent, extension) {
        this.calls.push({ name, params, forContent, extension });
        return forContent ? `probe.${extension || 'html'}${params ? `?${params.toString()}` : ''}` : 'probe.mjs';
      }

      async read(name, forContent) {
        return forContent ? { content: 'db compile' } : { func: null };
      }
    }
    const params = new URLSearchParams('version=3');
    const cachier = new ProbeCachierDB();
    const renderer = await cachier.compile('probe', true, params, 'html');
    Assert.equal(await renderer({}), 'db compile');
    const contentCall = cachier.calls.find(call => call.name === 'probe' && call.forContent === true);
    Assert.equal(contentCall.params, params);
    Assert.equal(contentCall.extension, 'html');
  });

  test('render-time primary template writes do not collapse when templatePath is outside partialsPath', { timeout: TEST_TIMEOUT_MS }, async () => {
    const root = await Fs.promises.mkdtemp(Path.join(process.cwd(), '.templeo-v3-runtime-path-'));
    roots.add(root);
    const relativeRoot = Path.relative(process.cwd(), root);
    const templatePath = Path.join(relativeRoot, 'views');
    const partialsPath = Path.join(templatePath, 'partials', 'html');
    await Fs.promises.mkdir(partialsPath, { recursive: true });
    await Fs.promises.writeFile(Path.join(templatePath, 'template.html'), 'before ${ await include`late` } after');
    await Fs.promises.writeFile(Path.join(partialsPath, 'late.html'), 'late value');
    const cachier = new CachierFiles({});
    roots.add(cachier.options.outputPath);
    const engine = Engine.create(cachier);
    engines.add(engine);
    const renderer = await engine.compile(null);
    const result = await renderer({}, {
      relativeTo: '.',
      templatePath,
      partialsPath,
      renderTimePolicy: 'read-write'
    });
    Assert.equal(result, 'before late value after');
    await Assert.rejects(Fs.promises.stat(Path.join(cachier.options.outputPath, '.mjs')), error => error.code === 'ENOENT');
    const generated = await Fs.promises.readdir(cachier.options.outputPath, { recursive: true });
    Assert.ok(generated.some(file => file.endsWith('template.mjs')));
  });

  test('legacy Files fixture never writes a bare .mjs renderer path', { timeout: TEST_TIMEOUT_MS }, async () => {
    const context = JSON.parse(await Fs.promises.readFile('test/context/html/context.json', 'utf8'));
    const fileOptions = {
      relativeTo: '.',
      templatePath: 'test/views',
      contextPath: 'test/context/html',
      partialsPath: 'test/views/partials/html'
    };
    const cases = [
      { compile: fileOptions, register: false, expectMirrored: true },
      { compile: fileOptions, register: true, expectMirrored: false },
      { compile: {}, register: false, render: fileOptions, expectMirrored: true }
    ];
    for (const testCase of cases) {
      const cachier = new CachierFiles(testCase.compile);
      roots.add(cachier.options.outputPath);
      const engine = Engine.create(cachier);
      engines.add(engine);
      if (testCase.register) await engine.register(null, true);
      const renderer = await engine.compile(null);
      const result = await renderer(context, testCase.render);
      Assert.match(result, /Test simple text inclusion/);
      await Assert.rejects(Fs.promises.stat(Path.join(cachier.options.outputPath, '.mjs')), error => error.code === 'ENOENT');
      const generated = await Fs.promises.readdir(cachier.options.outputPath, { recursive: true });
      Assert.ok(generated.some(file => file.endsWith('template.mjs')));
      if (testCase.expectMirrored) {
        for (const partial of ['text.mjs', 'double.mjs', 'swatch.mjs', Path.join('styles', 'selectors', 'swatch.mjs')]) {
          const expectedPath = Path.join(cachier.options.outputPath, 'test', 'views', 'partials', 'html', partial);
          Assert.equal((await Fs.promises.stat(expectedPath)).isFile(), true);
        }
      }
    }
  });

  test('render-time file writers use outputPath and the selected module extension', { timeout: TEST_TIMEOUT_MS }, async () => {
    for (const [useCommonJs, extension] of [[false, 'mjs'], [true, 'cjs']]) {
      const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), `templeo-v3-${extension}-`));
      roots.add(root);
      const partials = Path.join(root, 'partials');
      const output = Path.join(root, 'compiled');
      await Fs.promises.mkdir(partials, { recursive: true });
      await Fs.promises.writeFile(Path.join(partials, 'late.html'), 'late value');
      const cachier = new CachierFiles({
        relativeTo: root,
        partialsPath: 'partials',
        outputPath: 'compiled',
        renderTimePolicy: 'read-write',
        useCommonJs
      });
      const engine = Engine.create(cachier);
      engines.add(engine);
      const renderer = await engine.compile('${ await include`late` }');
      Assert.equal(await renderer({}), 'late value');
      Assert.equal((await Fs.promises.stat(Path.join(output, `template.${extension}`))).isFile(), true);
      Assert.equal((await Fs.promises.stat(Path.join(output, 'partials', `late.${extension}`))).isFile(), true);
      await Assert.rejects(Fs.promises.stat(Path.join(partials, `late.${extension}`)), error => error.code === 'ENOENT');
      await engine.close();
      engines.delete(engine);
    }
  });
});

function createHttpServer(handler) {
  const server = Http.createServer(handler);
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => new Promise((closeResolve, closeReject) => {
          server.close(error => error ? closeReject(error) : closeResolve());
        })
      });
    });
  });
}
