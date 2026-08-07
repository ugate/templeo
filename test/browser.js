'use strict';

import * as Assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as Http from 'node:http';
import * as Path from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';

const TEST_TIMEOUT_MS = 30000;
const PROJECT_ROOT = Path.resolve(process.cwd());

/**
 * Resolves a browser-requested Templeo source path while preventing traversal outside the project root.
 * @param {String} pathname The URL pathname requested by Chromium.
 * @returns {String | null} The absolute source path, or `null` when the request is not an allowed JavaScript source.
 */
function resolveSourcePath(pathname) {
  if (pathname !== '/index.js' && !pathname.startsWith('/lib/')) return null;
  if (!pathname.endsWith('.js')) return null;
  const resolved = Path.resolve(PROJECT_ROOT, `.${pathname}`);
  return resolved.startsWith(`${PROJECT_ROOT}${Path.sep}`) ? resolved : null;
}

/**
 * Reads an HTTP request body as UTF-8 text.
 * @param {import('node:http').IncomingMessage} request The incoming browser request.
 * @returns {Promise<String>} The complete request body.
 */
function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    request.on('data', chunk => chunks.push(Buffer.from(chunk)));
    request.once('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    request.once('error', reject);
  });
}

/**
 * Starts a same-origin HTTP fixture that exposes Templeo through the same public specifiers used by applications.
 * @returns {Promise<{url: String, requests: Object[], close: Function}>} The server URL, captured requests and close function.
 */
function createBrowserServer() {
  const requests = [];
  const httpServer = Http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const body = request.method === 'GET' || request.method === 'HEAD' ? '' : await readRequestBody(request);
    requests.push({ method: request.method, pathname: url.pathname, search: url.search, body });
    try {
      if (url.pathname === '/modules/runtime.mjs') {
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        response.end("export const runtime = 'browser-esm';");
        return;
      }
      if (request.method === 'GET' && url.pathname === '/partials/compile.html') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('Compile ${it.name}');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/partials/render.html') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('Render ${it.name}');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/partials/query.html') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('Query ${it.name}');
        return;
      }
      if (request.method === 'POST' && url.pathname === '/partials/written.html') {
        response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('OK');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/templates/template.html') {
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end('Fetched ${it.name}');
        return;
      }
      if (request.method === 'GET' && url.pathname === '/context/context.json') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end('{"name":"Context"}');
        return;
      }
      const sourcePath = resolveSourcePath(url.pathname);
      if (sourcePath) {
        const source = await readFile(sourcePath, 'utf8');
        response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
        response.end(source);
        return;
      }
      if (url.pathname === '/' || url.pathname === '/index.html') {
        const importMap = JSON.stringify({ imports: { templeo: '/index.js', 'templeo/': '/' } });
        response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        response.end(`<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${importMap}</script></head><body></body></html>`);
        return;
      }
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    } catch (error) {
      response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(String(error?.stack || error));
    }
  });
  return new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      const address = httpServer.address();
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        requests,
        close: () => new Promise((closeResolve, closeReject) => {
          httpServer.close(error => error ? closeReject(error) : closeResolve());
        })
      });
    });
  });
}

/**
 * Resolves optional Chromium launch overrides used by the browser release gate.
 * @returns {{executablePath?: String}} Playwright launch options.
 */
function getChromiumLaunchOptions() {
  const configured = process.env.TEMPLEO_CHROMIUM_EXECUTABLE;
  if (!configured) return {};
  Assert.ok(existsSync(configured), `TEMPLEO_CHROMIUM_EXECUTABLE does not exist: ${configured}`);
  return { executablePath: configured };
}

/**
 * Launches Chromium and converts missing browser/system prerequisites into a concise recovery instruction.
 * @returns {Promise<import('playwright').Browser>} The launched Chromium browser.
 */
async function launchChromium() {
  try {
    return await chromium.launch(getChromiumLaunchOptions());
  } catch (error) {
    const message = String(error?.message || error);
    if (!process.env.TEMPLEO_CHROMIUM_EXECUTABLE && /Executable doesn't exist/i.test(message)) {
      Assert.fail('Playwright Chromium headless shell is not installed. Run "npm run test:browser:install", then rerun the tests.');
    }
    if (/error while loading shared libraries|host system is missing dependencies|missing libraries/i.test(message)) {
      Assert.fail('Playwright Chromium system dependencies are missing. Run "npm run test:browser:install" with sufficient privileges, then rerun the tests.');
    }
    throw error;
  }
}

/**
 * Runs a browser assertion against a fresh same-origin Templeo fixture and fails on uncaught browser errors.
 * @param {Function} assertion The async assertion that receives the Playwright page and fixture server.
 * @returns {Promise<void>} Resolves after the assertion and browser cleanup complete.
 */
async function withBrowserPage(assertion) {
  const server = await createBrowserServer();
  let browser;
  let context;
  const browserErrors = [];
  try {
    browser = await launchChromium();
    context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', error => browserErrors.push(error));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(new Error(message.text()));
    });
    await page.goto(server.url);
    await assertion(page, server);
    Assert.deepEqual(browserErrors, []);
  } finally {
    if (context) await context.close();
    if (browser) await browser.close();
    await server.close();
  }
}

/**
 * Finds the first captured browser request matching the supplied method and pathname.
 * @param {Object[]} requests Captured HTTP requests.
 * @param {String} method Expected HTTP method.
 * @param {String} pathname Expected request pathname.
 * @returns {Object | undefined} The first matching request.
 */
function findRequest(requests, method, pathname) {
  return requests.find(request => request.method === method && request.pathname === pathname);
}

test('browser uses the same public package imports as Node.js', { timeout: TEST_TIMEOUT_MS }, async () => {
  await withBrowserPage(async page => {
    const result = await page.evaluate(async () => {
      const engineModule = await import('templeo');
      const cacheUtilsModule = await import('templeo/lib/cache-utils.js');
      const cachierModule = await import('templeo/lib/cachier.js');
      const dbModule = await import('templeo/lib/cachier-db.js');
      const directorModule = await import('templeo/lib/director.js');
      const sandboxModule = await import('templeo/lib/sandbox.js');
      const dbOptionsModule = await import('templeo/lib/template-db-options.js');
      const optionsModule = await import('templeo/lib/template-options.js');
      return {
        engineName: engineModule.default.name,
        cacheUtilsExports: Object.keys(cacheUtilsModule).length,
        cachierName: cachierModule.default.name,
        dbName: dbModule.default.name,
        directorName: directorModule.default.name,
        sandboxName: sandboxModule.default.name,
        dbOptionsName: dbOptionsModule.default.name,
        optionsName: optionsModule.default.name
      };
    });
    Assert.equal(result.engineName, 'Engine');
    Assert.ok(result.cacheUtilsExports > 0, 'Expected browser-safe cache utility exports');
    Assert.equal(result.cachierName, 'Cachier');
    Assert.equal(result.dbName, 'CachierDB');
    Assert.equal(result.directorName, 'Director');
    Assert.equal(result.sandboxName, 'Sandbox');
    Assert.equal(result.dbOptionsName, 'TemplateDBOpts');
    Assert.equal(result.optionsName, 'TemplateOpts');
  });
});

test('browser rendering, Fetch and dynamic ESM workflows use native browser APIs', { timeout: TEST_TIMEOUT_MS }, async () => {
  await withBrowserPage(async (page, server) => {
    const result = await page.evaluate(async currentOrigin => {
      const { default: Engine } = await import('templeo');
      const { default: Cachier } = await import('templeo/lib/cachier.js');
      const directRenderer = await new Engine().compile('Hello ${it.name}');
      const direct = await directRenderer({ name: 'Browser' });
      const localEngine = new Engine();
      await localEngine.registerPartial('local', 'Local ${it.name}');
      const localRenderer = await localEngine.compile('${ await include`local` }');
      const local = await localRenderer({ name: 'Browser' });
      const compileFetchEngine = new Engine({ partialsURL: `${currentOrigin}partials/` });
      const compileFetchRenderer = await compileFetchEngine.compile('${ await include`compile` }');
      const compileFetch = await compileFetchRenderer({ name: 'Browser' });
      const renderFetchEngine = new Engine();
      const renderFetchRenderer = await renderFetchEngine.compile('${ await include`${ it.dynamicIncludeURL || "" }` }');
      const renderFetch = await renderFetchRenderer({ name: 'Browser', dynamicIncludeURL: `${currentOrigin}partials/render.html` });
      const queryCache = new Cachier({ partialsURL: `${currentOrigin}partials/` });
      const queryRead = await queryCache.read(
        'query.html?existing=value',
        true,
        undefined,
        new URLSearchParams([['z', 'last'], ['a', 'first']])
      );
      const writeEngine = new Engine({ partialsURL: `${currentOrigin}partials/` });
      await writeEngine.register([{ name: 'written', content: 'Written Browser' }], false, true);
      const fetchedEngine = new Engine({
        templateURL: `${currentOrigin}templates/`,
        contextURL: `${currentOrigin}context/`
      });
      const fetchedRenderer = await fetchedEngine.compile();
      const fetched = await fetchedRenderer();
      localEngine.registerHelper(function loadBrowserModule(specifier) {
        return importModule(specifier).then(imported => imported.runtime);
      });
      const moduleRenderer = await localEngine.compile('${ await loadBrowserModule(it.moduleURL) }');
      const imported = await moduleRenderer({ moduleURL: `${currentOrigin}modules/runtime.mjs` });
      return {
        direct,
        local,
        compileFetch,
        renderFetch,
        queryContent: queryRead.content,
        fetched,
        imported,
        requireType: typeof globalThis.require,
        processType: typeof globalThis.process,
        bufferType: typeof globalThis.Buffer,
        indexedDBType: typeof globalThis.indexedDB
      };
    }, server.url);
    Assert.deepEqual(result, {
      direct: 'Hello Browser',
      local: 'Local Browser',
      compileFetch: 'Compile Browser',
      renderFetch: 'Render Browser',
      queryContent: 'Query ${it.name}',
      fetched: 'Fetched Context',
      imported: 'browser-esm',
      requireType: 'undefined',
      processType: 'undefined',
      bufferType: 'undefined',
      indexedDBType: 'object'
    });
    const compileRequest = findRequest(server.requests, 'GET', '/partials/compile.html');
    Assert.ok(compileRequest, 'Expected compile-time partial Fetch request');
    const renderRequest = findRequest(server.requests, 'GET', '/partials/render.html');
    Assert.ok(renderRequest, 'Expected render-time partial Fetch request');
    const queryRequest = findRequest(server.requests, 'GET', '/partials/query.html');
    Assert.ok(queryRequest, 'Expected parameterized partial Fetch request');
    Assert.equal(queryRequest.search, '?a=first&existing=value&z=last');
    const writeRequest = findRequest(server.requests, 'POST', '/partials/written.html');
    Assert.ok(writeRequest, 'Expected browser Fetch write request');
    Assert.equal(writeRequest.body, 'Written Browser');
    Assert.ok(findRequest(server.requests, 'GET', '/templates/template.html'), 'Expected primary template Fetch request');
    Assert.ok(findRequest(server.requests, 'GET', '/context/context.json'), 'Expected context Fetch request');
  });
});

test('browser IndexedDB persists across cache instances and supports render-time reads', { timeout: TEST_TIMEOUT_MS }, async () => {
  await withBrowserPage(async page => {
    const result = await page.evaluate(async () => {
      const { default: Engine } = await import('templeo');
      const { default: CachierDB } = await import('templeo/lib/cachier-db.js');
      const dbName = `templeo-browser-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const writer = Engine.create(new CachierDB({ dbLocName: dbName }));
      await writer.register([
        { name: 'template', content: '${ await include`stored` }' },
        { name: 'stored', content: 'Indexed ${it.name}' }
      ], false, true);
      const writeRenderer = await writer.compile();
      const writeResult = await writeRenderer({ name: 'DB' });
      await writer.close();
      const renderTimeReader = Engine.create(new CachierDB({ dbLocName: dbName }));
      const renderTimeRenderer = await renderTimeReader.compile('${ await include`${ it.partialName || "" }` }');
      const renderTimeResult = await renderTimeRenderer({ name: 'Runtime', partialName: 'stored' });
      await renderTimeReader.close();
      const singleReader = new CachierDB({ dbLocName: dbName });
      const singlePath = await singleReader.readWriteName('stored', singleReader.options, null, {}, true, 'html');
      const single = await singleReader.read('stored', true, 'html');
      const singleContent = single && single.data && single.data[singlePath] && single.data[singlePath].content;
      await singleReader.close();
      const reader = Engine.create(new CachierDB({ dbLocName: dbName }));
      await reader.register(null, true);
      const persistedRenderer = await reader.compile();
      const readResult = await persistedRenderer({ name: 'Persisted' });
      await reader.clearCache(true);
      const remaining = await new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(dbName);
        openRequest.onerror = event => reject(event.target.error);
        openRequest.onsuccess = event => {
          const database = event.target.result;
          const transaction = database.transaction(['data', 'sources'], 'readonly');
          const dataRequest = transaction.objectStore('data').count();
          const sourcesRequest = transaction.objectStore('sources').count();
          transaction.onerror = txEvent => reject(txEvent.target.error);
          transaction.oncomplete = () => {
            const counts = { data: dataRequest.result, sources: sourcesRequest.result };
            database.close();
            resolve(counts);
          };
        };
      });
      return { writeResult, renderTimeResult, singleContent, readResult, remaining };
    });
    Assert.deepEqual(result, {
      writeResult: 'Indexed DB',
      renderTimeResult: 'Indexed Runtime',
      singleContent: 'Indexed ${it.name}',
      readResult: 'Indexed Persisted',
      remaining: { data: 0, sources: 0 }
    });
  });
});

test('Node-only filesystem modules throw explicit browser incompatibility errors', { timeout: TEST_TIMEOUT_MS }, async () => {
  await withBrowserPage(async page => {
    const result = await page.evaluate(async () => {
      async function captureImportError(specifier) {
        try {
          await import(specifier);
          return null;
        } catch (error) {
          return String(error?.message || error);
        }
      }
      return {
        cachierFiles: await captureImportError('templeo/lib/cachier-files.js'),
        templateFileOptions: await captureImportError('templeo/lib/template-file-options.js')
      };
    });
    Assert.match(result.cachierFiles, /^CachierFiles is only compatible with Node\.js because it requires the Node\.js file-system APIs\./);
    Assert.match(result.templateFileOptions, /^TemplateFileOpts is only compatible with Node\.js because it requires the Node\.js file-system APIs\./);
  });
});
