'use strict';

import * as Assert from 'node:assert/strict';
import * as Http from 'node:http';
import * as Vm from 'node:vm';
import { describe, test } from 'node:test';
import Engine from '../index.js';
import Cachier from '../lib/cachier.js';

const TEST_TIMEOUT_MS = 10000;

describe('Cachier regression coverage', { concurrency: false }, () => {
  test('registerPartial accepts URLSearchParams', { timeout: TEST_TIMEOUT_MS }, async () => {
    const engine = new Engine({ defaultExtension: 'html' });
    const params = new URLSearchParams([
      ['first', 'one'],
      ['second', 'two']
    ]);
    await engine.registerPartial('parameterized', params);
    const registered = await engine.getRegistered('parameterized', params);
    Assert.ok(registered);
    Assert.equal(registered.extension, 'html');
  });

  test('waiter preserves rejected promise details and subsequent results', { timeout: TEST_TIMEOUT_MS }, async () => {
    const rejection = new TypeError('expected failure');
    rejection.code = 'EXPECTED_FAILURE';
    await Assert.rejects(
      Cachier.waiter([
        Promise.resolve('before'),
        Promise.reject(rejection),
        Promise.resolve('after')
      ]),
      error => {
        Assert.equal(error.code, 'EXPECTED_FAILURE');
        Assert.equal(error.results.length, 3);
        Assert.equal(error.results[0], 'before');
        Assert.ok(error.results[1] instanceof Error);
        Assert.equal(error.results[1].code, 'EXPECTED_FAILURE');
        Assert.equal(error.results[2], 'after');
        Assert.match(error.stack, /PROMISE #2 of 3/);
        return true;
      }
    );
  });

  test('renderer copies compiled partials into a supplied shared store', { timeout: TEST_TIMEOUT_MS }, async () => {
    const engine = new Engine({ renderTimePolicy: 'none' });
    await engine.registerPartial('compiled-partial', 'compiled value');
    const renderer = await engine.compile('<body>${ await include`compiled-partial` }</body>');
    const sharedStore = {
      existing: {
        content: 'preserved'
      }
    };
    Assert.equal(await renderer({}, {}, null, null, sharedStore), '<body>compiled value</body>');
    Assert.equal(sharedStore.existing.content, 'preserved');
    Assert.equal(sharedStore['compiled-partial.html'].content, 'compiled value');
  });

  test('memory content writes retain string content', { timeout: TEST_TIMEOUT_MS }, async () => {
    const cachier = new Cachier();
    await cachier.write('memory-content', 'stored content', true, 'html');
    const registered = await cachier.read('memory-content', true, 'html');
    Assert.equal(registered.content, 'stored content');
  });

  test('memory source writes apply the configured write formatter', { timeout: TEST_TIMEOUT_MS }, async () => {
    const writeFormatOptions = { marker: 'write-options' };
    let formatterCalls = 0;
    const engine = new Engine(
      {
        renderTimePolicy: 'read-write',
        writeFormatOptions
      },
      null,
      (source, options) => {
        formatterCalls++;
        Assert.equal(options, writeFormatOptions);
        return source;
      }
    );
    const renderer = await engine.compile('formatted renderer');
    Assert.equal(await renderer({}), 'formatted renderer');
    Assert.equal(formatterCalls, 1);
  });

  test('fetch reads consume the response once and apply the read formatter', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fixture = await createHttpServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/plain' });
      response.end('remote content');
    });
    const messages = [];
    try {
      const cachier = new Cachier(
        {
          partialsURL: fixture.url,
          readFormatOptions: { suffix: '!' }
        },
        (content, options) => `${content.toUpperCase()}${options.suffix}`,
        null,
        {
          debug: message => messages.push(String(message)),
          error: () => undefined
        }
      );
      const registered = await cachier.read('remote', true, 'html');
      Assert.equal(registered.content, 'REMOTE CONTENT!');
      Assert.ok(messages.some(message => message.includes('remote content')));
    } finally {
      await fixture.close();
    }
  });

  test('fetch writes do not require Buffer or set a restricted Content-Length header', { timeout: TEST_TIMEOUT_MS }, async () => {
    const fetcher = new Cachier().operations.scopes.find(scope => scope.name === 'fetcher');
    const context = Vm.createContext({
      URL,
      URLSearchParams,
      captured: null,
      fetch: async (_request, options) => {
        context.captured = options;
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => 'written'
        };
      },
      Request: class Request {
        constructor(url) {
          this.url = url;
        }
      }
    });
    const script = new Vm.Script(`
      const fetcher = ${fetcher.toString()};
      fetcher(
        {},
        'https://templeo.test/remote.js',
        { encoding: 'utf-8', writeFetchRequestOptions: null },
        null,
        {},
        'browser compatible',
        null,
        false,
        {}
      );
    `);
    await script.runInContext(context);
    Assert.equal(context.captured.body, 'browser compatible');
    Assert.equal(context.captured.headers['Content-Length'], undefined);
  });
});

/**
 * Starts a local HTTP server for cache fetch regression tests.
 * @param {Function} handler Native Node.js HTTP request handler.
 * @returns {Promise<{url: String, close: Function}>} Server URL and asynchronous close function.
 */
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
