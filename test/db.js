'use strict';

const { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getFiles, Level, baseTest, JsFrmt, Fs, Path, Os } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, getFiles, Level, baseTest, JsFrmt, Fs, Path, Os } from './_main.mjs';
const plan = `${PLAN} IndexedDB`;
const DB = {};

// "node_modules/.bin/lab" test/db.js -vi 1

lab.experiment(plan, async () => {

  var db;

  lab.before(async () => {
    db = await getIndexedDB();
    if (ENGINE_LOGGER && ENGINE_LOGGER.info) ENGINE_LOGGER.info(`Using LevelDB @ ${db.loc}`);
  });

  lab.test(`${plan}: HTML/LevelDB partials`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    opts.partials = await getFiles('test/views/partials', true);
    return baseTest(opts, true, await Engine.engineIndexedDB(opts, JsFrmt, db.indexedDB));
  });

  lab.test(`${plan}: HTML/LevelDB scanned`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    return baseTest(opts, true, await Engine.engineIndexedDB(opts, JsFrmt, db.indexedDB));
  });
});

function baseOptions() {
  return {
    logger: ENGINE_LOGGER
  };
}

async function getIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
  if (DB[locPrefix]) return DB[locPrefix];
  const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
  DB[locPrefix] = { loc, indexedDB: Level(loc) };
  return DB[locPrefix];
}