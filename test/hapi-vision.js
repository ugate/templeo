'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } = require('./_main.js');
const lab = Lab.script();
exports.lab = lab;
const Hapi = require('hapi');
const Vision = require('vision');
const Http = require('http');
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, httpsServer, getTemplateFiles, openIndexedDB, closeIndexedDB, JsFrmt, expectDOM } from './_main.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';
// TODO : import * as Http from 'http';
// TODO : export * as lab from lab;

const plan = `${PLAN} Hapi.js + vision`;
const logger = LOGGER || {};
var server;

// "node_modules/.bin/lab" test/hapi-vision.js -vi 1

lab.experiment(plan, () => {

  lab.beforeEach(stopServer);
  lab.afterEach(stopServer);

  lab.test(`${plan}: Default Engine`, { timeout: TEST_TKO }, async () => {
    const opts = baseOptions();
    const engine = new Engine(opts, JsFrmt);
    return reqAndValidate(engine, opts);
  });

  lab.test(`${plan}: Default Engine - Partials Fetch From HTTPS Server`, { timeout: TEST_TKO }, async () => {
    const opts = baseOptions();
    const basePath = opts.partialsPath, svr = await httpsServer(basePath);
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts, JsFrmt, sopts);
    return reqAndValidate(engine, opts);
  });

  lab.test(`${plan}: LevelDB Engine`, { timeout: TEST_TKO }, async () => {
    const opts = baseOptions();
    const db = await openIndexedDB();
    const engine = await Engine.indexedDBEngine(opts, JsFrmt, db.indexedDB);
    await reqAndValidate(engine, opts);
    return closeIndexedDB(db, engine);
  });

  lab.test(`${plan}: Files Engine`, { timeout: TEST_TKO }, async () => {
    const opts = baseOptions();
    const engine = await Engine.filesEngine(opts, JsFrmt);
    await reqAndValidate(engine, opts);
    return engine.clearCache(true);
  });
});

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    scanSourcePath: 'test/views/partials',
    logger: LOGGER
  };
}

async function startServer(engine, opts, context) {
  if (logger.debug) logger.debug(`Starting Hapi.js server...`);

  const sopts = logger.debug ? { debug: { request: ['error'] } } : {};
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
      if (logger.debug) logger.debug(`Hapi.js request received @ ${req.path}`);
      return h.view('index', context);
    }
  });
  server.app.htmlPartial = engine.genPartialFunc();
  await server.start();
  if (logger.debug) logger.debug(`Hapi.js server running @ ${server.info.uri}`);
  return server;
}

async function stopServer() {
  if (!server) return;
  await server.stop({ timeout: 3000 });
  if (logger.debug) logger.debug(`Hapi.js server stopped @ ${server.info.uri}`);
}

async function reqAndValidate(engine, opts) {
  const tmpl = await getTemplateFiles();
  server = await startServer(engine, opts, tmpl.data);

  const html = await clientRequest(server.info.uri);
  if (logger.debug) logger.debug(html);
  expectDOM(html, tmpl.data);
}

function clientRequest(url, logger) {
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