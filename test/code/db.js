'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main } from './_main.mjs';

var db, engine;

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/db.js

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async before() {
    return db = await Main.openIndexedDB();
  }

  static async after() {
    if (!db) return;
    const rtn = await Main.closeIndexedDB(db, engine);
    db = null;
    engine = null;
    return rtn;
  }

  static async levelDbFromRegisterPartials() {
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    const partials = await Main.getFiles('test/views/partials');
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async levelDbFromPartialsInDb() {
    // partials should still be cached from previous test w/registerPartials
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    return Main.baseTest(opts.compile, engine, null, true, opts.render);
  }
}

// TODO : ESM remove the following line...
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