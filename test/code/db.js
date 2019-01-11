'use strict';

const { expect, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt } from './_main.mjs';

var db, engine;

// TODO : ESM uncomment the following line...
// export
module.exports = class Tester {

  // Use the following when debugging:
  // node --inspect-brk test/code/db.js
  // ... and uncomment the following line:
  //(async () => await Tester.all())();

  static async open() {
    return db = await openIndexedDB();
  }

  static async close() {
    if (!db) return;
    const rtn = await closeIndexedDB(db, engine);
    db = null;
    engine = null;
    return rtn;
  }

  static async all() {
    await open();
    await testLevelDbFromRegisterPartials();
    await testLevelDbFromPartialsInDb();
    return close();
  }

  static async levelDbFromRegisterPartials() {
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    const partials = await getFiles('test/views/partials');
    return baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async levelDbFromPartialsInDb() {
    // partials should still be cached from previous test w/registerPartials
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    return baseTest(opts.compile, engine, null, true, opts.render);
  }
}

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}