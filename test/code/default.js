'use strict';

const { expect, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt, getTemplateFiles } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, getFiles, baseTest, JsonEngine, httpsServer, JsFrmt, getTemplateFiles } from './_main.mjs';

// TODO : ESM uncomment the following line...
// export
module.exports = class Tester {

  // Use the following when debugging:
  // node --inspect-brk test/code/default.js
  // ... and uncomment the following line:
  //(async () => await Tester.testHtmlRegisterPartials())();

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, null, LOGGER);
    const partials = await getFiles('test/views/partials');
    return baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlPartialsFetchHttpServer() {
    const basePath = 'test/views/partials', svr = await httpsServer(basePath);
    const opts = baseOptions();
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts.compile, JsFrmt, sopts, LOGGER);
    //const partials = await getFiles(basePath, false); // false since content should be loaded from the server
    //engine.registerPartials(partials);
    await baseTest(opts.compile, engine, null, false, opts.render);
    await svr.close();
  }
}

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}