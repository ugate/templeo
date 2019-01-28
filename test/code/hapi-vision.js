'use strict';

const { LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
const CachierFiles = require('../../lib/cachier-files.js');
const Hapi = require('hapi');
const Vision = require('vision');
const Http = require('http');
// ESM uncomment the following lines...
// TODO : import { LOGGER, Engine, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';
// TODO : import * as CachierFiles from '../../lib/cachier-files.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';
// TODO : import * as Http from 'http';

var server;

// Use the following when debugging:
// node --inspect-brk test/code/hapi-vision.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/files.js defaultEngine

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async beforeEach() {
    return stopServer();
  }

  static async afterEach() {
    return stopServer();
  }

  static async defaultEngine() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    return reqAndValidate(engine, opts.compile);
  }

  static async defaultEnginePartialFetchHttpServer() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    opts.render.templatePathBase = svr.url; // partials will be served from this URL
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    // Hapi will not be happy with rendering options that are not part of the vision options
    // when calling: h.view('index', context, renderOpts);
    // Need to set the legacy render options instead
    engine.legacyRenderOptions = opts.render;
    return reqAndValidate(engine, opts.compile, `${svr.url}text.html`);
  }

  static async levelDbEngine() {
    const opts = baseOptions();
    const db = await Main.openIndexedDB();
    const cachier = new CachierDB(opts.compile, db.indexedDB, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    await reqAndValidate(engine, opts.compile);
    return Main.closeIndexedDB(db, engine);
  }

  static async filesEngine() {
    const opts = baseOptions();
    const cachier = new CachierFiles(opts.compile, JsFrmt, LOGGER);
    const engine = new Engine(cachier);
    await reqAndValidate(engine, opts.compile);
    return engine.clearCache(true);
  }
}

// TODO : ESM remove the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions(dynamicIncludeURL) {
  return {
    compile: {
      templatePathBase: Main.PATH_BASE,
      viewsPath: Main.PATH_VIEWS_DIR,
      partialsPath: Main.PATH_HTML_PARTIALS_DIR,
      sourcePath: Main.PATH_HTML_PARTIALS_DIR
    },
    render: {
      rejectUnauthorized: false
    }
  };
}

async function stopServer() {
  if (!server) return;
  await server.stop({ timeout: 3000 });
  if (LOGGER.debug) LOGGER.debug(`Hapi.js server stopped @ ${server.info.uri}`);
}

// renderOpts must be vision options, not templeo options
async function startServer(engine, opts, context, renderOpts) {
  if (LOGGER.debug) LOGGER.debug(`Starting Hapi.js server...`);

  const sopts = LOGGER.debug ? { debug: { request: ['error'] } } : {};
  server = Hapi.Server(sopts);
  await server.register(Vision);
  server.views({
    engines: { html: engine },
    compileMode: 'async',
    defaultExtension: opts.defaultExtension,
    path: opts.viewsPath,
    partialsPath: opts.partialsPath,
    relativeTo: opts.templatePathBase,
    layout: true,
    layoutPath: `${opts.viewsPath}/layout`
  });
  server.route({
    method: 'GET',
    path: '/',
    handler: function hapiViewTestHandler(req, h) {
      if (LOGGER.info) LOGGER.info(`Hapi.js request received @ ${req.path}`);
      return h.view('index', context, renderOpts);
    }
  });
  server.events.on('log', (event, tags) => {
    if (tags.error) {
      if (LOGGER.error) LOGGER.error(`Hapi server error: ${event.error ? event.error.message : 'unknown'}`);
    } else if (LOGGER.info) {
      LOGGER.info(`Hapi server ${JSON.stringify(tags)} for event: ${JSON.stringify(event)}`);
    }
  });
  server.app.htmlPartial = engine.renderPartialGenerate();
  await server.start();
  if (LOGGER.debug) LOGGER.debug(`Hapi.js server running @ ${server.info.uri}`);
  return server;
}

async function reqAndValidate(engine, compileOpts, dynamicIncludeURL, renderOpts) {
  const tmpl = await Main.getTemplateFiles();
  tmpl.htmlContext.dynamicIncludeURL = dynamicIncludeURL;
  server = await startServer(engine, compileOpts, tmpl.htmlContext, renderOpts);

  const html = await clientRequest(server.info.uri);
  if (LOGGER.debug) LOGGER.debug(html);
  Main.expectDOM(html, tmpl.htmlContext);
}

function clientRequest(url) {
  return new Promise(async (resolve, reject) => {
    const req = Http.request(url, { method: 'GET' }, res => {
      var data = '';
      res.on('data', chunk => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          JSON.parse(data);
          reject(new Error(`Recieved JSON response for ${url}: ${data}`));
        } catch (err) {
          // error means proper non-JSON response, consume error
        }
        resolve(data);
      });
    });
    req.on('error', err => {
      reject(err);
    });
    req.end();
  });
}