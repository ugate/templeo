'use strict';

const { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getTemplateFiles, JsFrmt, expectDOM } = require('./_main.js');
const lab = Lab.script();
exports.lab = lab;
const Hapi = require('hapi');
const Vision = require('vision');
const Http = require('http');
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getTemplateFiles, JsFrmt, expectDOM } from './_main.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';
// TODO : import * as Http from 'http';
// TODO : export * as lab from lab;

const plan = `${PLAN} Hapi.js + vision`;
const port = 3000, logger = ENGINE_LOGGER || {};
var server;

// "node_modules/.bin/lab" test/hapi-vision.js -vi 1

lab.experiment(plan, () => {

  lab.beforeEach(stopServer);
  lab.afterEach(stopServer);

  // lab.test(`${plan}: Default Engine`, { timeout: TEST_TKO }, async () => {
  //   const engine = new Engine(baseOptions(), JsFrmt);
  //   return reqAndValidate(engine);
  // });

  lab.test(`${plan}: Files Engine`, { timeout: TEST_TKO }, async () => {
    const engine = await Engine.filesEngine(baseOptions(), JsFrmt);
    return reqAndValidate(engine);
  });
});

function baseOptions() {
  return {
    pathBase: '.',
    path: 'test/views',
    partialsPath: 'test/views/partials',
    scanSourcePath: 'test/views/partials',
    logger: ENGINE_LOGGER
  };
}

async function startServer(engine, context) {
  if (logger.debug) logger.debug(`Starting Hapi.js server...`);

  const server = Hapi.Server({ port, debug: { request: ['error'] } });
  await server.register(Vision);
  server.views({
    engines: { html: engine },
    compileMode: 'async',
    defaultExtension: engine.options.defaultExtension,
    path: engine.options.path,
    partialsPath: engine.options.partialsPath,
    relativeTo: engine.options.pathBase,
    layout: true,
    layoutPath: `${engine.options.path}/layout`
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

async function reqAndValidate(engine) {
  const tmpl = await getTemplateFiles();
  server = await startServer(engine, tmpl.data);

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