'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main } from './_main.mjs';

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/default.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/default.js htmlRegisterPartials

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, null, LOGGER);
    const partials = await Main.getFiles('test/views/partials');
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlWithPartialNamesFetchHttpServer() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions();
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts.compile, JsFrmt, sopts, LOGGER);
    // partials should be fetched via the HTTPS server during compilation via the cache read/fetch
    const partials = await Main.getFiles(basePath, false); // false will only return the partial names w/o content
    await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to init read/fetch
    await svr.close();
  }

  static async htmlPartialsFetchHttpServer() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions();
    const sopts = { read: { url: svr.url }, write: { url: svr.url }, rejectUnauthorized: false };
    const engine = new Engine(opts.compile, JsFrmt, sopts, LOGGER);
    // partials should be fetched via the HTTPS server as includes are encountered during rendering
    await Main.baseTest(opts.compile, engine, null, false, opts.render);
    await svr.close();
  }
}

// TODO : ESM comment the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}