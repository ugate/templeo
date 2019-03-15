'use strict';

const { LOGGER, Engine, HtmlFrmt, JsFrmt, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
const CachierFiles = require('../../lib/cachier-files.js');
const Hapi = require('hapi');
const Vision = require('vision');
// ESM uncomment the following lines...
// TODO : import { LOGGER, Engine, HtmlFrmt, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';
// TODO : import * as CachierFiles from '../../lib/cachier-files.mjs';
// TODO : import * as Hapi from 'hapi';
// TODO : import * as Vision from 'vision';

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
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    return reqAndValidate(engine, opts.compile);
  }

  static async defaultEnginePartialFetchHttpServer() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    opts.render.contextURL = svr.url;
    opts.render.templateURL = svr.url;
    opts.render.partialsURL = svr.url;
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    // Hapi will not be happy with rendering options that are not part of the vision options
    // when calling: h.view('index', context, renderOpts);
    // Need to set the legacy render options instead
    engine.legacyRenderOptions = opts.render;
    return reqAndValidate(engine, opts.compile, `${svr.url}text.html`);
  }

  static async levelDbEngine() {
    const opts = baseOptions();
    const meta = await Main.initDB();
    opts.compile.dbTypeName = opts.render.dbTypeName = meta.type;
    opts.compile.dbLocName = opts.render.dbLocName = meta.loc;
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    await reqAndValidate(engine, opts.compile);
    return Main.clearDB(engine);
  }

  static async filesEngine() {
    const opts = baseOptions();
    const cachier = new CachierFiles(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
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
      relativeTo: Main.PATH_RELATIVE_TO,
      partialsPath: Main.PATH_HTML_PARTIALS_DIR
    },
    render: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
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
  server = Hapi.server(sopts);
  await server.register(Vision);
  server.views({
    engines: { html: engine },
    compileMode: 'async',
    defaultExtension: opts.defaultExtension,
    path: Main.PATH_VIEWS_DIR,
    partialsPath: opts.partialsPath,
    relativeTo: opts.relativeTo,
    layout: true,
    layoutPath: `${Main.PATH_VIEWS_DIR}/layout`
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

  const html = await Main.clientRequest(server.info.uri);
  if (LOGGER.debug) LOGGER.debug(html);
  Main.expectDOM(html, tmpl.htmlContext);
}