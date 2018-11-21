'use strict';

const { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, JsFrmt, getFile, expectDOM } = require('./_main.js');
const lab = exports.lab = Lab.script();
// ESM uncomment the following lines...
// import { expect, Lab, PLAN, TEST_TKO, ENGINE_LOGGER, Engine, JsFrmt, getFile, expectDOM } from './_main.mjs';
const plan = `${PLAN} Files`;

// "node_modules/.bin/lab" test/files.js -vi 1

lab.experiment(plan, () => {

  lab.test(`${plan}: HTML`, { timeout: TEST_TKO }, async (flags) => {
    const html = (await getFile('./test/views/template.html')).toString();
    const data = JSON.parse((await getFile('./test/data/it.json')).toString());
    const eng = await Engine.filesEngine({
      path: 'test/views',
      partialsPath: 'test/views/partials',
      outputSourcePath: 'test/views/partials',
      logger: ENGINE_LOGGER
    }, JsFrmt);
    await eng.init(true);
    const fn = await eng.compile(html);

    expect(fn).to.be.function();

    const rslt = fn(data), dom = expectDOM(rslt, data);

  });
});