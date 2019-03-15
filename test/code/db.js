'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';

var meta, engines = [];

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/db.js

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async before() {
    meta = await Main.initDB();
  }

  static async after() {
    // close DB connection(s) and clear files on last test
    for (let engine of engines) {
      await Main.clearDB(engine, engine === engines[engines.length - 1]);
    }
  }

  static async levelDbFromRegisterPartialsComileTimeWrite() {
    const opts = baseOptions(meta);
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    // write partials to DB at compile-time
    return Main.baseTest(opts.compile, engine, partials, false, true, opts.render);
  }

  static async levelDbFromPartialsInDbCompileTimeRead() {
    const opts = baseOptions(meta);
    // partials should still be cached from previous test w/registerPartials
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at compile-time
    return Main.baseTest(opts.compile, engine, null, true, false, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeRead() {
    const opts = baseOptions(meta);
    // partials should still be cached from previous test w/registerPartials
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at render-time
    return Main.baseTest(opts.compile, engine, null, false, false, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeReadAndClose() {
    const opts = baseOptions(meta);
    opts.render.renderTimePolicy = 'read-write-and-close';
    // partials should still be cached from previous test w/registerPartials
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    const engine = Engine.create(cachier);
    engines.push(engine);
    // read partials from DB at render-time
    return Main.baseTest(opts.compile, engine, null, false, false, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeReadWithSearchParams() {
    const opts = baseOptions(meta);
    opts.render.readFetchRequestOptions = {
      rejectUnauthorized: false
    };
    const params = {
      searchParam1: 'Search Param 1 VALUE',
      searchParam2: 'Search Param 2 VALUE'
    };
    const test = await Main.paramsTest({
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      }
    }, opts);
    engines.push(test.engine);
  }

  static async levelDbFromPartialsInDbRenderTimeReadWithRegisteredSearchParams() {
    const opts = baseOptions(meta);
    const params = {
      registeredSearchParam1: 'Registered Search Param 1 VALUE',
      registeredSearchParam2: 'Registered Search Param 2 VALUE'
    };
    const text = (await Main.getFile(`${Main.PATH_HTML_PARTIALS_DIR}/text.html`, true)).toString();
    const partials = [{
      name: `text?${new URLSearchParams(params).toString()}`,
      content: text
    }];
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    // write partial to DB, no HTTPS server
    const test = {
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramText: text }
      }
    };
    // write the test partial to the DB
    await Main.paramsTest(test, opts, partials, false, true, cachier, false);
    engines.push(test.engine);
    if (LOGGER.info) LOGGER.info(`>>>>>>> Checking previously written search params...`);
    // now include the search params again, but read from the DB
    await Main.paramsTest(test, opts, null, true, false, cachier, false);
  }
}

// TODO : ESM remove the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions(meta) {
  return {
    compile: {
      dbTypeName: meta.type,
      dbLocName: meta.loc
    },
    render: {
      dbTypeName: meta.type,
      dbLocName: meta.loc
    }
  };
}