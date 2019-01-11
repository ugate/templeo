'use strict';

const { LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } = require('./_main.js');
const Hapi = require('hapi');
const Vision = require('vision');
const Http = require('http');
// ESM uncomment the following lines...
// TODO : import { LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } from './_main.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';
// TODO : import * as Http from 'http';

var server;

// TODO : ESM uncomment the following line...
// export
module.exports = class Tester {

  // Use the following when debugging:
  // node --inspect-brk test/code/hapi-vision.js
  // ... and uncomment the following line:
  //(async () => { await Tester.testDefaultEngine(true); await stopServer(); })();

  static async stopServer() {
    if (!server) return;
    await server.stop({ timeout: 3000 });
    if (LOGGER.debug) LOGGER.debug(`Hapi.js server stopped @ ${server.info.uri}`);
  }

  static async testDefaultEngine(shutdown) {
    const opts = baseOptions();
    const engine = new Engine(opts, JsFrmt, null, LOGGER);
    const promise = reqAndValidate(engine, opts);

    if (shutdown) {
      await promise;
      return stopServer();
    }
    return promise;
  }

  static async testDefaultEnginePartialFetchHttpServer(shutdown) {
    const opts = baseOptions();
    const basePath = opts.partialsPath, svr = await httpsServer(basePath);
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts, JsFrmt, sopts, LOGGER);
    const promise = reqAndValidate(engine, opts);

    if (shutdown) {
      await promise;
      return stopServer();
    }
    return promise;
  }

  static async testLevelDbEngine(shutdown) {
    const opts = baseOptions();
    const db = await openIndexedDB();
    const engine = await Engine.indexedDBEngine(opts, JsFrmt, db.indexedDB, LOGGER);
    await reqAndValidate(engine, opts);
    const promise = closeIndexedDB(db, engine);

    if (shutdown) {
      await promise;
      return stopServer();
    }
    return promise;
  }

  static async testFilesEngine(shutdown) {
    const opts = baseOptions();
    const engine = await Engine.filesEngine(opts, JsFrmt, LOGGER);
    await reqAndValidate(engine, opts);
    const promise = engine.clearCache(true);

    if (shutdown) {
      await promise;
      return stopServer();
    }
    return promise;
  }
}

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    sourcePath: 'test/views/partials'
  };
}

async function startServer(engine, opts, context, renderOverrideOpts) {
  if (LOGGER.debug) LOGGER.debug(`Starting Hapi.js server...`);

  const sopts = LOGGER.debug ? { debug: { request: ['error'] } } : {};
  server = Hapi.Server(sopts);
  await server.register(Vision);
  server.views({
    engines: { html: engine },
    compileMode: 'async',
    defaultExtension: opts.defaultExtension,
    path: opts.path,
    partialsPath: opts.partialsPath,
    relativeTo: opts.pathBase,
    layout: true,
    layoutPath: `${opts.path}/layout`
  });
  server.route({
    method: 'GET',
    path: '/',
    handler: function hapiViewTestHandler(req, h) {
      if (LOGGER.info) LOGGER.info(`Hapi.js request received @ ${req.path}`);
      return h.view('index', context, renderOverrideOpts);
    }
  });
  server.events.on('log', (event, tags) => {
    if (tags.error) {
      if (LOGGER.error) LOGGER.error(`Hapi server error: ${event.error ? event.error.message : 'unknown'}`);
    } else if (LOGGER.info) {
      LOGGER.info(`Hapi server ${JSON.stringify(tags)} for event: ${JSON.stringify(event)}`);
    }
  });
  server.app.htmlPartial = engine.genPartialFunc();
  await server.start();
  if (LOGGER.debug) LOGGER.debug(`Hapi.js server running @ ${server.info.uri}`);
  return server;
}

async function reqAndValidate(engine, opts) {
  const tmpl = await getTemplateFiles();
  server = await startServer(engine, opts, tmpl.data);

  const html = await clientRequest(server.info.uri);
  if (LOGGER.debug) LOGGER.debug(html);
  expectDOM(html, tmpl.data);
}

function clientRequest(url) {
  return new Promise(async (resolve, reject) => {
    const req = Http.request(url, { method: 'GET' }, res => {
      var data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        resolve(data);
      });
    });
    req.on('error', err => {
      reject(err);
    });
    req.end();
  });
}