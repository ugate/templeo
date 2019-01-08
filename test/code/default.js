'use strict';

const { expect, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt, getTemplateFiles } = require('./_main.js');
exports.testHtmlRegisterPartials = testHtmlRegisterPartials;
exports.testHtmlPartialsFetchHttpServer = testHtmlPartialsFetchHttpServer;
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt, getTemplateFiles } from './_main.mjs';

// Use the following when debugging:
// node --inspect-brk test/code/default.js
// ... and uncomment the following line:
//(async () => await testHtmlRegisterPartials())();

// TODO : ESM uncomment the following line...
// export
async function testHtmlRegisterPartials() {
  const opts = baseOptions();
  const engine = new Engine(opts.compile, JsFrmt, null, LOGGER);
  const partials = await getFiles('test/views/partials');
  engine.registerPartials(partials);
  return baseTest(opts.compile, true, engine, opts.render);
}

// TODO : ESM uncomment the following line...
// export
async function testHtmlPartialsFetchHttpServer() {
  const basePath = 'test/views/partials', svr = await httpsServer(basePath);
  const opts = baseOptions();
  const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
  const engine = new Engine(opts.compile, JsFrmt, sopts, LOGGER);
  //const partials = await getFiles(basePath, false); // false since content should be loaded from the server
  //engine.registerPartials(partials);
  await baseTest(opts.compile, true, engine, opts.render);
  await svr.close();
}

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}