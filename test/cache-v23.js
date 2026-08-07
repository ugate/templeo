'use strict';

import { afterEach, describe, test } from 'node:test';
import * as Assert from 'node:assert/strict';
import * as Fs from 'node:fs';
import * as Http from 'node:http';
import * as Os from 'node:os';
import * as Path from 'node:path';
import { pathToFileURL } from 'node:url';
import Engine from '../index.js';
import Cachier from '../lib/cachier.js';
import CachierFiles from '../lib/cachier-files.js';
import CachierDB from '../lib/cachier-db.js';
import { browserBundle } from './browser-bundle.js';

const TEST_TIMEOUT_MS = 15000;
const roots = new Set();
const engines = new Set();

describe('Cachier v2.3 mechanics', { concurrency: false }, () => {
  afterEach(async () => {
    for (const engine of engines) await engine.close();
    engines.clear();
    for (const root of roots) await Fs.promises.rm(root, { recursive: true, force: true });
    roots.clear();
  });

  test('canonicalizes URLSearchParams order for cache names', async () => {
    const cachier = new Cachier();
    const first = new URLSearchParams([['z', 'last'], ['a', 'first']]);
    const second = new URLSearchParams([['a', 'first'], ['z', 'last']]);
    const one = await cachier.readWriteName('canonical', cachier.options, first, {}, true, 'html');
    const two = await cachier.readWriteName('canonical', cachier.options, second, {}, true, 'html');
    Assert.equal(one, two);
    Assert.match(one, /\?a=first&z=last$/);
  });

  test('serializes every transitive database cache helper into render-time operations', () => {
    const scopes = new CachierDB().operations[0].scopes.map(scope => scope.name);
    Assert.ok(scopes.includes('optionValue'));
    Assert.ok(scopes.indexOf('optionValue') < scopes.indexOf('cachePrune'));
  });

  test('builds a browser bundle without static ESM declarations', async () => {
    const bundle = await browserBundle();
    Assert.doesNotMatch(bundle, /^\s*import\b/m);
    Assert.doesNotMatch(bundle, /^\s*export\b/m);
    Assert.doesNotThrow(() => new Function(bundle));
  });

  test('deduplicates concurrent reads for the same resource', { timeout: TEST_TIMEOUT_MS }, async () => {
    let requests = 0;
    const fixture = await createHttpServer(async (_request, response) => {
      requests++;
      await delay(75);
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('deduplicated');
    });
    try {
      const cachier = new Cachier({ partialsURL: fixture.url, maxCacheBytes: 2 });
      const results = await Promise.all([
        cachier.read('shared', true, 'html'),
        cachier.read('shared', true, 'html'),
        cachier.read('shared', true, 'html')
      ]);
      Assert.equal(requests, 1);
      Assert.deepEqual(results.map(result => result.content), ['deduplicated', 'deduplicated', 'deduplicated']);
      Assert.equal(cachier.stats.reads, 1);
      Assert.equal(cachier.stats.deduplicated, 2);
      Assert.equal(cachier.stats.entries, 0);
    } finally {
      await fixture.close();
    }
  });

  test('deduplicates concurrent compiles', async () => {
    const cachier = new Cachier();
    const [first, second, third] = await Promise.all([
      cachier.compile('shared-template', 'same'),
      cachier.compile('shared-template', 'same'),
      cachier.compile('shared-template', 'same')
    ]);
    Assert.equal(first, second);
    Assert.equal(second, third);
    Assert.equal(cachier.stats.compiles, 1);
    Assert.equal(cachier.stats.deduplicated, 2);
  });

  test('deduplicates concurrent writes for the same renderer', async () => {
    let formatterCalls = 0;
    const cachier = new Cachier({}, null, source => {
      formatterCalls++;
      return source;
    });
    const renderer = async function renderer() { return 'same'; };
    const [first, second, third] = await Promise.all([
      cachier.write('shared-renderer', renderer, false, 'js'),
      cachier.write('shared-renderer', renderer, false, 'js'),
      cachier.write('shared-renderer', renderer, false, 'js')
    ]);
    Assert.equal(first, second);
    Assert.equal(second, third);
    Assert.equal(formatterCalls, 1);
    Assert.equal(cachier.stats.writes, 1);
    Assert.equal(cachier.stats.deduplicated, 2);

    let distinctFormatterCalls = 0;
    const distinct = new Cachier({}, null, source => {
      distinctFormatterCalls++;
      return source;
    });
    const [firstDistinct, secondDistinct] = await Promise.all([
      distinct.write('shared-renderer', async function first() { return 'first'; }, false, 'js'),
      distinct.write('shared-renderer', async function second() { return 'second'; }, false, 'js')
    ]);
    Assert.equal(await firstDistinct(), 'first');
    Assert.equal(await secondDistinct(), 'second');
    Assert.equal(distinctFormatterCalls, 2);
    Assert.equal(distinct.stats.writes, 2);
    Assert.equal(distinct.stats.deduplicated, 0);
  });

  test('evicts least-recently-used entries and reports statistics', async () => {
    const cachier = new Cachier({ maxCacheEntries: 2 });
    await cachier.registerPartial('first', 'one');
    await cachier.registerPartial('second', 'two');
    Assert.equal((await cachier.getRegistered('first')).content, 'one');
    await cachier.registerPartial('third', 'three');
    Assert.equal(await cachier.getRegistered('second'), null);
    Assert.equal((await cachier.getRegistered('first')).content, 'one');
    Assert.equal((await cachier.getRegistered('third')).content, 'three');
    Assert.equal(cachier.stats.entries, 2);
    Assert.equal(cachier.stats.evictions, 1);
    Assert.ok(cachier.stats.bytes > 0);
    const reset = cachier.resetStats();
    Assert.equal(reset.evictions, 0);
    Assert.equal(reset.entries, 2);

    const byteLimited = new Cachier({ maxCacheBytes: 6 });
    await byteLimited.registerPartial('first', '12345');
    await byteLimited.registerPartial('second', '67890');
    Assert.equal(await byteLimited.getRegistered('first'), null);
    Assert.equal((await byteLimited.getRegistered('second')).content, '67890');
    Assert.equal(byteLimited.stats.entries, 1);
    Assert.equal(byteLimited.stats.bytes, 5);
    Assert.equal(byteLimited.stats.evictions, 1);

    const oversized = new Cachier({ maxCacheBytes: 2 });
    Assert.equal(await oversized.registerPartial('oversized', '12345'), '12345');
    Assert.equal(await oversized.getRegistered('oversized'), null);
    Assert.equal(oversized.stats.entries, 0);
  });

  test('expires idle entries using cacheTTL', async () => {
    const cachier = new Cachier({ cacheTTL: 25 });
    await cachier.registerPartial('expiring', 'value');
    await delay(40);
    Assert.equal(await cachier.getRegistered('expiring'), null);
    Assert.equal(cachier.stats.evictions, 1);
  });

  test('deduplicates database operations and closes without deleting persisted records', { timeout: TEST_TIMEOUT_MS }, async () => {
    const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), 'templeo-v23-db-'));
    roots.add(root);
    const modulePath = Path.join(root, 'fake-level.mjs');
    await Fs.promises.writeFile(modulePath, `
export const state = { closes: 0, databases: new Map() };
export class Level {
  constructor(location) {
    this.status = 'closed';
    if (!state.databases.has(location)) state.databases.set(location, new Map());
    this.values = state.databases.get(location);
  }
  isOpen() { return this.status === 'open'; }
  async open() { this.status = 'open'; }
  async close() { this.status = 'closed'; state.closes++; }
  async put(key, value) { this.values.set(key, value); }
  async get(key) {
    if (!this.values.has(key)) { const error = new Error('Not found'); error.code = 'LEVEL_NOT_FOUND'; throw error; }
    return this.values.get(key);
  }
  async del(key) { this.values.delete(key); }
  async *iterator() { for (const entry of this.values) yield entry; }
}
`);
    const cachier = new CachierDB({
      dbTypeName: pathToFileURL(modulePath).href,
      dbLocName: Path.join(root, 'db')
    });
    const writes = await Promise.all([
      cachier.write('shared', 'persisted', true, 'html'),
      cachier.write('shared', 'persisted', true, 'html'),
      cachier.write('shared', 'persisted', true, 'html')
    ]);
    Assert.equal(writes[0], writes[1]);
    Assert.equal(writes[1], writes[2]);
    Assert.equal(cachier.stats.writes, 1);
    Assert.equal(cachier.stats.deduplicated, 2);
    await cachier.clearMemory();
    cachier.resetStats();
    const reads = await Promise.all([
      cachier.read('shared', true, 'html'),
      cachier.read('shared', true, 'html'),
      cachier.read('shared', true, 'html')
    ]);
    const path = await cachier.readWriteName('shared', cachier.options, null, {}, true, 'html');
    Assert.equal(reads[0].data[path].content, 'persisted');
    Assert.equal(reads[0], reads[1]);
    Assert.equal(reads[1], reads[2]);
    Assert.equal(cachier.stats.reads, 1);
    Assert.equal(cachier.stats.deduplicated, 2);
    Assert.ok(cachier.stats.entries >= 1);
    await cachier.close();
    const fakeLevel = await import(pathToFileURL(modulePath).href);
    Assert.ok(fakeLevel.state.closes >= 1);
    Assert.equal(cachier.stats.entries, 0);
    const reopened = await cachier.read('shared', true, 'html');
    Assert.equal(reopened.data[path].content, 'persisted');
    const dbEngine = Engine.create(cachier);
    engines.add(dbEngine);
    await dbEngine.clearCache();
    Assert.equal([...fakeLevel.state.databases.values()].reduce((count, values) => count + values.size, 0), 0);
  });

  test('separates memory, generated-file and watcher lifecycle operations', { timeout: TEST_TIMEOUT_MS }, async () => {
    const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), 'templeo-v23-lifecycle-'));
    roots.add(root);
    const partials = Path.join(root, 'partials');
    const output = Path.join(root, 'compiled');
    await Fs.promises.mkdir(partials, { recursive: true });
    await Fs.promises.writeFile(Path.join(partials, 'watched.html'), 'initial');
    const cachier = new CachierFiles({
      relativeTo: root,
      partialsPath: 'partials',
      outputPath: 'compiled',
      useCommonJs: false,
      watchPaths: false
    });
    const engine = Engine.create(cachier);
    engines.add(engine);
    Assert.equal(await engine.startWatching(), 1);
    Assert.equal(await engine.reconcileWatching(), 1);
    Assert.equal((await engine.getRegistered('watched')).content, 'initial');
    await Fs.promises.writeFile(Path.join(partials, 'watched.html'), 'first');
    await Fs.promises.writeFile(Path.join(partials, 'watched.html'), 'final');
    await waitFor(async () => (await engine.getRegistered('watched'))?.content === 'final');
    Assert.ok(engine.cacheStats.watcherEvents >= 1);
    const renderer = await engine.compile('generated renderer');
    Assert.equal(await renderer({}), 'generated renderer');
    const generated = Path.join(output, 'template.mjs');
    Assert.equal((await Fs.promises.stat(generated)).isFile(), true);
    Assert.equal((await Fs.promises.readdir(output)).some(name => name.endsWith('.tmp')), false);
    Assert.ok(engine.cacheStats.writes >= 1);
    Assert.ok(engine.cacheStats.entries >= 1);
    await engine.clearMemory();
    Assert.equal((await Fs.promises.stat(generated)).isFile(), true);
    Assert.equal(engine.cacheStats.entries, 0);
    Assert.equal(await engine.stopWatching(), 1);
    await cachier.clearGeneratedFiles();
    await Assert.rejects(Fs.promises.stat(output), error => error.code === 'ENOENT');
  });

  test('reloads rewritten generated renderers without ESM cache-busting imports', { timeout: TEST_TIMEOUT_MS }, async () => {
    const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), 'templeo-v23-modules-'));
    roots.add(root);
    await Fs.promises.mkdir(Path.join(root, 'partials'), { recursive: true });
    const cachier = new CachierFiles({
      relativeTo: root,
      partialsPath: 'partials',
      outputPath: 'compiled',
      useCommonJs: false
    });
    const first = await cachier.compile('reloadable', 'first');
    Assert.equal(await first({}), 'first');
    const second = await cachier.compile('reloadable', 'second');
    Assert.equal(await second({}), 'second');
    Assert.notEqual(first, second);
    const sourcePath = Path.join(root, 'compiled', 'reloadable.mjs');
    const source = await Fs.promises.readFile(sourcePath, 'utf8');
    Assert.match(source, /^export async function/);
    Assert.equal(source.includes('?templeo='), false);
  });
});

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function waitFor(check, timeout = 5000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (await check()) return;
    await delay(25);
  }
  Assert.fail(`Condition was not met within ${timeout}ms`);
}

function createHttpServer(handler) {
  const server = Http.createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch(error => {
      response.statusCode = 500;
      response.end(error.stack || error.message);
    });
  });
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
