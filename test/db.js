'use strict';

const { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt, Fs, Path, Os, rmrf } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// TODO : import { expect, Lab, PLAN, TEST_TKO, LOGGER, Engine, getFiles, openIndexedDB, closeIndexedDB, baseTest, JsFrmt, Fs, Path, Os, rmrf } from './_main.mjs';
const plan = `${PLAN} IndexedDB`;

// "node_modules/.bin/lab" test/db.js -vi 1

lab.experiment(plan, async () => {

  var db, engine;

  lab.before(async () => {
    db = await openIndexedDB();
  });

  lab.after(async () => {
    if (!db) return;
    return closeIndexedDB(db, engine);
  });

  lab.test(`${plan}: HTML/LevelDB from registerPartials`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    const partials = await getFiles('test/views/partials');
    engine.registerPartials(partials);
    return baseTest(opts.compile, true, engine, opts.render);
  });

  lab.test(`${plan}: HTML/LevelDB from partials in DB`, { timeout: TEST_TKO }, async flags => {
    // partials should still be cached from previous test w/opts.partials
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts.compile, JsFrmt, db.indexedDB, LOGGER);
    return baseTest(opts.compile, true, engine, opts.render);
  });
});

function baseOptions() {
  return {
    compile: {},
    render: {}
  };
}