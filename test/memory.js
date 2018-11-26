'use strict';

const { expect, Lab, PLAN, TASK_DELAY, TEST_TKO, ENGINE_LOGGER, LOGGER, httpServer, Engine, JsonEngine, JsFrmt, JSDOM, getFile, expectDOM } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TASK_DELAY, TEST_TKO, ENGINE_LOGGER, LOGGER, httpServer, Engine, JsonEngine, JsFrmt, JSDOM, getFile, expectDOM } from './_main.mjs';
const plan = `${PLAN} In-Memory`;

// "node_modules/.bin/lab" test/memory.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML`, { timeout: TEST_TKO }, async (flags) => {
    const html = (await getFile('./test/views/template.html')).toString();
    const data = JSON.parse((await getFile('./test/data/it.json')).toString());
    const eng = new Engine({
      path: 'test/views',
      partialsPath: 'test/views/partials',
      logger: ENGINE_LOGGER
    });
    await eng.init(true);
    const fn = await eng.compile(html);

    expect(fn).to.be.function();

    const rslt = fn(data);
    expectDOM(rslt, data);
  });

  lab.test(`${plan}: HTML/LevelDB`, { timeout: TEST_TKO }, async (flags) => {
    const html = (await getFile('./test/views/template.html')).toString();
    const data = JSON.parse((await getFile('./test/data/it.json')).toString());
    const eng = new Engine({
      path: 'test/views',
      partialsPath: 'test/views/partials',
      logger: ENGINE_LOGGER
    }, null, require('level'));
    await eng.init(true);
    const fn = await eng.compile(html);

    expect(fn).to.be.function();

    const rslt = fn(data);
    expectDOM(rslt, data);
  });
});