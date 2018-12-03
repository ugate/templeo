'use strict';

const { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, baseTest, JsonEngine } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, baseTest, JsonEngine } from './_main.mjs';
const plan = `${PLAN} Default`;

// "node_modules/.bin/lab" test/default.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML`, { timeout: TEST_TKO }, async flags => {
    const opts = baseOptions();
    return baseTest(opts);
  });
});

function baseOptions() {
  return {
    logger: ENGINE_LOGGER
  };
}