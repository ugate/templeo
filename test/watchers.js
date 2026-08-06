'use strict';

import { afterEach, describe, test } from 'node:test';
import * as Assert from 'node:assert/strict';
import * as Fs from 'node:fs';
import * as Os from 'node:os';
import * as Path from 'node:path';
import Engine from '../index.js';
import CachierFiles from '../lib/cachier-files.js';

const TEST_TIMEOUT_MS = 15000;
const WATCH_TIMEOUT_MS = 5000;
const roots = new Set();
const engines = new Set();

describe('CachierFiles native watchers', { concurrency: false }, () => {
  afterEach(async () => {
    for (const engine of engines) await engine.clearCache();
    engines.clear();
    for (const root of roots) await Fs.promises.rm(root, { recursive: true, force: true });
    roots.clear();
  });

  test('registers file additions and updates and unregisters deletions', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fixture = await createFixture();
    const initialPath = Path.join(fixture.partialsPath, 'initial.html');
    await Fs.promises.writeFile(initialPath, 'initial');
    await fixture.engine.register(null, true);
    Assert.equal((await fixture.engine.getRegistered('initial')).content, 'initial');
    await Fs.promises.writeFile(initialPath, 'updated');
    await waitFor(async () => (await fixture.engine.getRegistered('initial'))?.content === 'updated');
    const addedPath = Path.join(fixture.partialsPath, 'added.html');
    await Fs.promises.writeFile(addedPath, 'added');
    await waitFor(async () => (await fixture.engine.getRegistered('added'))?.content === 'added');
    await Fs.promises.unlink(addedPath);
    await waitFor(async () => (await fixture.engine.getRegistered('added')) === null);
    Assert.deepEqual(fixture.cachier.metadata.watchedDirs, [fixture.partialsPath]);
  });

  test('watches newly created subdirectories and unregisters removed directory contents', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fixture = await createFixture();
    await fixture.engine.register(null, true);
    const nestedPath = Path.join(fixture.partialsPath, 'nested', 'deep');
    await Fs.promises.mkdir(nestedPath, { recursive: true });
    await Fs.promises.writeFile(Path.join(nestedPath, 'partial.html'), 'nested');
    await waitFor(async () => (await fixture.engine.getRegistered('nested/deep/partial'))?.content === 'nested');
    await waitFor(() => fixture.cachier.metadata.watchedDirs.length === 3);
    const renamedPath = Path.join(fixture.partialsPath, 'renamed');
    await Fs.promises.rename(Path.join(fixture.partialsPath, 'nested'), renamedPath);
    await waitFor(async () => (await fixture.engine.getRegistered('nested/deep/partial')) === null);
    await waitFor(async () => (await fixture.engine.getRegistered('renamed/deep/partial'))?.content === 'nested');
    await Fs.promises.rm(renamedPath, { recursive: true, force: true });
    await waitFor(async () => (await fixture.engine.getRegistered('renamed/deep/partial')) === null);
    await waitFor(() => fixture.cachier.metadata.watchedDirs.length === 1);
  });


  test('ignores generated JavaScript modules discovered beside template partials', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fixture = await createFixture();
    await Fs.promises.writeFile(Path.join(fixture.partialsPath, 'source.html'), 'template-source');
    await Fs.promises.writeFile(Path.join(fixture.partialsPath, 'source.js'), 'export default async function source() {}');
    await Fs.promises.writeFile(Path.join(fixture.partialsPath, 'compiled.cjs'), 'module.exports = async function compiled() {}');
    await Fs.promises.writeFile(Path.join(fixture.partialsPath, 'compiled.mjs'), 'export default async function compiled() {}');
    await fixture.engine.register(null, true);
    Assert.equal((await fixture.engine.getRegistered('source')).content, 'template-source');
    Assert.equal(await fixture.engine.getRegistered('source', null, 'js'), null);
    Assert.equal(await fixture.engine.getRegistered('compiled', null, 'cjs'), null);
    Assert.equal(await fixture.engine.getRegistered('compiled', null, 'mjs'), null);
    await Fs.promises.writeFile(Path.join(fixture.partialsPath, 'source.js'), 'export default async function sourceUpdated() {}');
    await delay(150);
    Assert.equal(await fixture.engine.getRegistered('source', null, 'js'), null);
  });

  test('shares render-time watcher updates and closes them with unwatchPaths', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fixture = await createFixture(false);
    const watchedPath = Path.join(fixture.partialsPath, 'watched.html');
    await Fs.promises.writeFile(watchedPath, 'initial');
    await fixture.engine.registerPartial('watched', 'initial');
    const renderer = await fixture.engine.compile('<body>${ await include`watched` }</body>');
    const sharedStore = {};
    const renderOptions = {
      relativeTo: fixture.root,
      partialsPath: 'partials',
      outputPath: fixture.outputPath,
      defaultExtension: 'html',
      watchPaths: true,
      renderTimePolicy: 'read-all-on-init-when-empty'
    };
    Assert.equal(await renderer({}, renderOptions, null, null, sharedStore), '<body>initial</body>');
    await Fs.promises.writeFile(watchedPath, 'updated');
    await waitFor(() => Object.values(sharedStore).some(value => value?.content === 'updated'));
    Assert.equal(await renderer({}, {}, null, null, sharedStore), '<body>updated</body>');
    Assert.equal(await renderer({}, { ...renderOptions, watchPaths: false, unwatchPaths: true }, null, null, sharedStore), '');
    await Fs.promises.writeFile(watchedPath, 'ignored');
    await delay(250);
    Assert.equal(await renderer({}, {}, null, null, sharedStore), '<body>updated</body>');
  });
});

async function createFixture(watchPaths = true) {
  const root = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), 'templeo-watchers-'));
  const partialsPath = Path.join(root, 'partials');
  const outputPath = Path.join(root, 'cache');
  roots.add(root);
  await Fs.promises.mkdir(partialsPath, { recursive: true });
  const cachier = new CachierFiles({
    relativeTo: root,
    partialsPath: 'partials',
    outputPath,
    defaultExtension: 'html',
    watchPaths
  });
  const engine = Engine.create(cachier);
  engines.add(engine);
  return { root, partialsPath, outputPath, cachier, engine };
}

async function waitFor(predicate, timeout = WATCH_TIMEOUT_MS) {
  const expires = Date.now() + timeout;
  while (Date.now() < expires) {
    if (await predicate()) return;
    await delay(25);
  }
  Assert.fail(`Timed out after ${timeout}ms waiting for a file-system watcher event`);
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}
