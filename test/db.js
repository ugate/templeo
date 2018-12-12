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

  lab.test(`${plan}: HTML/LevelDB from options.partials`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.partials = await getFiles('test/views/partials');
    engine = await Engine.indexedDBEngine(opts, JsFrmt, db.indexedDB);
    return baseTest(opts, true, engine);
  });

  lab.test(`${plan}: HTML/LevelDB from partials in DB`, { timeout: TEST_TKO }, async flags => {
    // partials should still be cached from previous test w/opts.partials
    const opts = baseOptions();
    engine = await Engine.indexedDBEngine(opts, JsFrmt, db.indexedDB);
    return baseTest(opts, true, engine);
  });
});

function baseOptions() {
  return {
    logger: LOGGER
  };
}