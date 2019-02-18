'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';

var opts, engine, testCount = 0;

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/db.js

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async before() {
    opts = baseOptions(await Main.initDB());
  }

  static async afterEach() {
    // close DB connection(s) and clear files on last test
    return Main.clearDB(engine, ++testCount >= 3);
  }

  static async levelDbFromRegisterPartialsComileTimeWrite() {
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    engine = Engine.create(cachier);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    // write partials to DB at compile-time
    return Main.baseTest(opts.compile, engine, partials, false, true, opts.render);
  }

  static async levelDbFromPartialsInDbCompileTimeRead() {
    // partials should still be cached from previous test w/registerPartials
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    engine = Engine.create(cachier);
    // read partials from DB at compile-time
    return Main.baseTest(opts.compile, engine, null, true, false, opts.render);
  }

  static async levelDbFromPartialsInDbRenderTimeRead() {
    // partials should still be cached from previous test w/registerPartials
    const cachier = new CachierDB(opts.compile, JsFrmt, LOGGER);
    engine = Engine.create(cachier);
    // read partials from DB at render-time
    return Main.baseTest(opts.compile, engine, null, false, false, opts.render);
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