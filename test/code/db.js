'use strict';

const { expect, LOGGER, Engine, JsFrmt, Main } = require('./_main.js');
const CachierDB = require('../../lib/cachier-db.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, JsFrmt, Main } from './_main.mjs';
// TODO : import * as CachierDB from '../../lib/cachier-db.mjs';

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
    const cachier = new CachierDB(opts.compile, db.indexedDB, JsFrmt, LOGGER);
    engine = Engine.create(cachier);
    const partials = await Main.getFiles('test/views/partials');
    return Main.baseTest(opts.compile, engine, partials, true, opts.render);
  }

  static async levelDbFromPartialsInDb() {
    // partials should still be cached from previous test w/registerPartials
    const opts = baseOptions();
    const cachier = new CachierDB(opts.compile, db.indexedDB, JsFrmt, LOGGER);
    engine = Engine.create(cachier);
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