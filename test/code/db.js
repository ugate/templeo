'use strict';

const { expect, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt } = require('./_main.js');
exports.open = open;
exports.close = close;
exports.testAll = testAll;
exports.testLevelDbFromRegisterPartials = testLevelDbFromRegisterPartials;
exports.testLevelDbFromPartialsInDb = testLevelDbFromPartialsInDb;
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt } from './_main.mjs';

var db, engine;

// Use the following when debugging:
// node --inspect-brk test/code/db.js
// ... and uncomment the following line:
//(async () => await testAll())();

// TODO : ESM uncomment the following line...
// export
async function open() {
  return db = await openIndexedDB();
}

// TODO : ESM uncomment the following line...
// export
async function close() {
  if (!db) return;
  const rtn = await closeIndexedDB(db, engine);
  db = null;
  engine = null;
  return rtn;
}

// TODO : ESM uncomment the following line...
// export
async function testAll() {
  await open();
  await testLevelDbFromRegisterPartials();
  await testLevelDbFromPartialsInDb();
  return close();
}

// TODO : ESM uncomment the following line...
// export
async function testLevelDbFromRegisterPartials() {
  const opts = baseOptions();
  engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
  const partials = await getFiles('test/views/partials');
  engine.registerPartials(partials);
  return baseTest(opts.compile, true, engine, opts.render);
}

// TODO : ESM uncomment the following line...
// export
async function testLevelDbFromPartialsInDb() {
  // partials should still be cached from previous test w/opts.partials
  const opts = baseOptions();
  engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
  return baseTest(opts.compile, true, engine, opts.render);
}

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}