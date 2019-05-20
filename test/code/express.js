'use strict';

const { LOGGER, Engine, HtmlFrmt, JsFrmt, Main, Fs } = require('./_main.js');
const Cachier = require('../../lib/cachier.js');
const CachierDB = require('../../lib/cachier-db.js');
const CachierFiles = require('../../lib/cachier-files.js');
const Express = require('express');
// ESM uncomment the following lines...
// TODO : import { LOGGER, Engine, HtmlFrmt, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';
// TODO : import * as CachierFiles from '../../lib/cachier-files.mjs';
// TODO : import * as Express from 'express';

var server;
const PORT = 0, HOST = '127.0.0.1', connections = [];

// Use the following when debugging:
// node --inspect-brk test/code/express.js -NODE_ENV=test
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/express.js -NODE_ENV=test filesEngine

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
    // write to DB
    await writePartials(opts.compile);
    return reqAndValidate(engine, opts.compile);
  }

  static async defaultEnginePartialFetchHttpServer() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    opts.render.contextURL = svr.url;
    opts.render.templateURL = svr.url;
    opts.render.partialsURL = svr.url;
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    return reqAndValidate(engine, opts.compile, `${svr.url}text.html`);
  }

  static async levelDbEngine() {
    const opts = baseOptions();
    const meta = await Main.initDB();
    opts.compile.dbTypeName = opts.render.dbTypeName = meta.type;
    opts.compile.dbLocName = opts.render.dbLocName = meta.loc;
    { // write to DB
      const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
      await writePartials(cachier);
    }
    // read from DB
    const cachier = new CachierDB(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    await reqAndValidate(engine, opts.compile);
    return Main.clearDB(engine);
  }

  static async filesEngine() {
    const opts = baseOptions();
    const cachier = new CachierFiles(opts.compile, null, null, LOGGER);
    const engine = new Engine(cachier);
    await reqAndValidate(engine, opts.compile);
    await Main.expectFiles(engine);
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
      partialsPath: Main.PATH_HTML_PARTIALS_DIR,
      templatePath: Main.PATH_VIEWS_DIR,
      contextPath: Main.PATH_VIEWS_DIR
    },
    render: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
    }
  };
}

async function writePartials(cachierOrOpts) {
  const engine = cachierOrOpts instanceof Cachier ? Engine.create(cachierOrOpts) : new Engine(cachierOrOpts, HtmlFrmt, JsFrmt, LOGGER);;
  const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
  // add the default primary template to the partials that will be written
  partials.splice(0, 0, { name: engine.options.defaultTemplateName, content: (await Main.getFile(Main.PATH_HTML_TEMPLATE)).toString() });
  // write partials at compile-time
  return engine.register(partials, false, true);
}

async function stopServer() {
  if (!server) return;
  let addy;
  try {
    addy = server.address();
  } catch (err) {
    if (LOGGER.error) LOGGER.error(`Express server cannot determine "server.address()" @ ${uri}`, err);
  }
  if (!addy) return;
  const uri = `${addy.address}${addy.port ? `:${addy.port}` : ''}`;
  if (LOGGER.info) LOGGER.info(`Express server stopping @ ${uri}`);
  return new Promise(async (resolve, reject) => {
    server.close(err => {
      if (LOGGER.info) LOGGER.info(`Express server stopped @ ${uri}`);
      if (err) reject(err);
      else resolve(server);
    });
    connections.forEach(curr => {
      curr.end();
      curr.destroy();
    });
  });
}

async function startServer(engine, opts, context, renderOpts) {
  return new Promise(async (resolve, reject) => {
    if (LOGGER.debug) LOGGER.debug(`Starting express server...`);
    try {
      const app = Express(), store = { engine, renderers: {} };
      app.engine('html', async (filePath, options, callback) => {
        try {
          if (!store.renderers[filePath]) {
            if (LOGGER.info) LOGGER.info(`Express compiling @ ${filePath}`);
            store.renderers[filePath] = await store.engine.compile(null, options);
          }
          callback(null, await store.renderers[filePath](context));
        } catch (err) {
          return callback(err);
        }
      });
      app.set('views', Main.PATH_VIEWS_DIR);
      app.set('view engine', 'html'); // register the template engine
      app.get('/', function expressRootRoute(req, res) {
        if (LOGGER.info) LOGGER.info(`Express request received @ ${req.path}`);
        res.render('template', context, renderOpts);
      });
      server = app.listen(PORT, HOST, () => {
        if (LOGGER.info) {
          const addy = server.address();
          LOGGER.info(`Express app listening on ${addy.address}:${addy.port}`);
        }
        resolve(server);
      });
      server.on('error', async err => {
        if (LOGGER.error) LOGGER.error(err);
        await stopServer();
        throw err;
      });
      process.on('SIGTERM', stopServer);
      process.on('SIGINT', stopServer);
    } catch (err) {
      if (LOGGER.error) LOGGER.error(err);
      reject(err);
    }
  });
}

async function reqAndValidate(engine, compileOpts, dynamicIncludeURL, renderOpts) {
  const tmpl = await Main.getTemplateFiles();
  tmpl.htmlContext.dynamicIncludeURL = dynamicIncludeURL;
  server = await startServer(engine, compileOpts, tmpl.htmlContext, renderOpts);

  const addy = server.address();
  const url = `http://${addy.address}${addy.port ? `:${addy.port}` : ''}/`;

  const html = await Main.clientRequest(url);
  if (LOGGER.debug) LOGGER.debug('Express server HTML:\n', html);
  Main.expectDOM(html, tmpl.htmlContext);
}