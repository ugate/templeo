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

  static async jsonRegisterPartials() {
    const opts = baseOptions();
    opts.compile.defaultExtension = 'json';
    const tmpl = '{ "test": ${ await include`name1` } }';

    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    engine.registerPartials([
      {
        name: 'name1',
        content: '{ "one": ${ await include`${ it.one }` } }'
      },
      {
        name: 'name2',
        content: '{ "two": ${ await include`${ it.two }` } }'
      },
      {
        name: 'name3',
        content: '{ "three": ${ it.three } }'
      }
    ]);
    const renderer = await engine.compile(tmpl);
    const rslt = await renderer({
      one: 'name2',
      two: 'name3',
      three: 3
    });

    if (LOGGER.info) LOGGER.info(rslt);

    const json = JSON.parse(rslt);
    expect(json.test).to.be.object();
    expect(json.test.one).to.be.object();
    expect(json.test.one.two).to.be.object();
    expect(json.test.one.two.three).to.equal(3);
  }

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles('test/views/partials');
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlPartialsFetchHttpsServerCompiletimeRead() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions();
    opts.compile.pathBase = svr.url; // partials will be served from this URL during compile-time
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    // partials should be fetched via the HTTPS server during compilation via the cache read/fetch
    const partials = await Main.getFiles(basePath, false); // false will only return the partial names w/o content
    await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    await svr.close();
  }

  static async htmlPartialsFetchHttpsServerCompiletimeReadNoPathError() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles(basePath, false); // false will only return the partial names w/o content
    await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    await svr.close();
  }

  static async htmlPartialsFetchHttpsServerRendertimeRead() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions(`${svr.url}text.html`);
    opts.render.pathBase = svr.url; // partials will be served from this URL during render-time
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    // partials should be fetched via the HTTPS server when includes are encountered during rendering
    await Main.baseTest(opts.compile, engine, null, false, opts.render, opts.context); // false to prevent compile-time registerPartials
    await svr.close();
  }

  static async htmlPartialsFetchHttpsServerRendertimeReadNoPathError() {
    const basePath = 'test/views/partials', svr = await Main.httpsServer(basePath);
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    // partials should be fetched via the HTTPS server when includes are encountered during rendering
    await Main.baseTest(opts.compile, engine, null, false, opts.render); // false to prevent compile-time registerPartials
    await svr.close();
  }
}

// TODO : ESM comment the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions(dynamicIncludeURL) {
  return {
    compile: {
      rejectUnauthorized: false
    },
    render: {
      rejectUnauthorized: false
    },
    context: {
      dynamicIncludeURL
    }
  };
}