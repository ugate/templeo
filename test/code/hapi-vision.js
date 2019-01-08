'use strict';

const { LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } = require('./_main.js');
const Hapi = require('hapi');
const Vision = require('vision');
const Http = require('http');
exports.stopServer = stopServer;
exports.testDefaultEngine = testDefaultEngine;
exports.testLevelDbEngine = testLevelDbEngine;
exports.testDefaultEnginePartialFetchHttpServer = testDefaultEnginePartialFetchHttpServer;
exports.testFilesEngine = testFilesEngine;
// ESM uncomment the following lines...
// TODO : import { LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } from './_main.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';
// TODO : import * as Http from 'http';

var server;

// Use the following when debugging:
// node --inspect-brk test/code/hapi-vision.js
// ... and uncomment the following line:
(async () => { await testDefaultEngine(true); await stopServer(); })();

// TODO : ESM uncomment the following line...
// export
async function stopServer() {
  if (!server) return;
  await server.stop({ timeout: 3000 });
  if (LOGGER.debug) LOGGER.debug(`Hapi.js server stopped @ ${server.info.uri}`);
}

// TODO : ESM uncomment the following line...
// export
async function testDefaultEngine(shutdown) {
  const opts = baseOptions();
  const engine = new Engine(opts, JsFrmt, null, LOGGER);
  const promise = reqAndValidate(engine, opts);

  if (shutdown) {
    await promise;
    return stopServer();
  }
  return promise;
}

// TODO : ESM uncomment the following line...
// export
async function testDefaultEnginePartialFetchHttpServer(shutdown) {
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

// TODO : ESM uncomment the following line...
// export
async function testLevelDbEngine(shutdown) {
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

// TODO : ESM uncomment the following line...
// export
async function testFilesEngine(shutdown) {
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

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    scanSourcePath: 'test/views/partials'
  };
}

async function startServer(engine, opts, context) {
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
    handler: function(req, h) {
      if (LOGGER.debug) LOGGER.debug(`Hapi.js request received @ ${req.path}`);
      return h.view('index', context);
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
  //LOGGER.info(html)
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