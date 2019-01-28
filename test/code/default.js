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
    opts.compile.defaultExtension = 'json'; // testing json 
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_JSON_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async htmlPartialsFetchHttpsServerCompiletimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      opts.compile.templatePathBase = svr.url; // partials will be served from this URL during compile-time
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server during compilation via the cache read/fetch
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerCompiletimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const context = { dynamicIncludeURL: `${svr.url}text.html` }; // test include from context value
      opts.render.templatePathBase = svr.url; // partials will be served from this URL during render-time
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, opts.render, context); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, opts.render); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlTmplAndContextFetchHttpsServerRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      // read/load both the template.html and context.json from the HTTPS server
      opts.compile.templatePathBase = svr.url;
      opts.compile.contextPathBase = svr.url;

      const engine = new Engine(opts.compile);
      const renderer = await engine.compile();
      const rslt = await renderer();

      const files = await Main.getTemplateFiles();
      Main.expectDOM(rslt, files.htmlContext);
    } finally {
      await svr.close();
    }
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
    compile: {
      rejectUnauthorized: false
    },
    render: {
      rejectUnauthorized: false
    }
  };
}