'use strict';

const { Lab, PLAN, TEST_TKO } = require('./code/_main.js');
const Tester = require('./code/db');
const lab = Lab.script();
exports.lab = lab;
// ESM uncomment the following lines...
// TODO : import { Lab, PLAN, TEST_TKO } from './code/_main.mjs';
// TODO : import * as Tester from './code/db.mjs';
// TODO : export * as lab from lab;

const plan = `${PLAN} IndexedDB`;

// "node_modules/.bin/lab" test/db.js -vi 1

lab.experiment(plan, async () => {

  lab.before(Tester.open);
  lab.after(Tester.close);

  lab.test(`${plan}: HTML/LevelDB from registerPartials`, { timeout: TEST_TKO }, async flags => {
    return Tester.levelDbFromRegisterPartials();
  });

  lab.test(`${plan}: HTML/LevelDB from partials in DB`, { timeout: TEST_TKO }, async flags => {
    // partials should still be cached from previous test w/registerPartials
    return Tester.levelDbFromRegisterPartials();
  });
});