'use strict';

const { expect, LOGGER, Engine, HtmlFrmt, JsFrmt, Main, JSDOM } = require('./_main.js');
// ESM uncomment the following lines...
// TODO : import { expect, LOGGER, Engine, HtmlFrmt, JsFrmt, Main, JSDOM } from './_main.mjs';

// DEBUGGING:
// Use the following:
// node --inspect-brk test/code/default.js
// ...or with optional test function name appended to the end:
// node --inspect-brk test/code/default.js htmlRegisterPartials

const params = {
  hello: 'world',
  performing: 'tests for parameter values!'
};
const params2 = {
  someParam: 'someParamValue'
};

// TODO : ESM uncomment the following line...
// export
class Tester {

  static async jsonRegisterPartials() {
    const opts = baseOptions();
    opts.compile.defaultExtension = 'json'; // testing json 
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_JSON_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, false, opts.render);
  }

  static async htmlRegisterPartials() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
    const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR);
    return Main.baseTest(opts.compile, engine, partials, true, false, opts.render);
  }

  static async htmlregisterHelper() {
    const opts = baseOptions();
    const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);

    const template = '<html><body>${ hasPerson(it) }</body></html>';
    engine.registerHelper(function hasPerson(it) {
      if (it.person && it.person.name) {
        return `<h1> Hello ${ it.person.name }! </h3>`;
      } else {
        return `<input id="personName" placeholder="Please enter your name">`;
      }
    });

    const renderer = await engine.compile(template);

    const contexts = [{ person: { name: 'World' } }, {}];
    let rslt, dom, els, label;
    for (let ctx of contexts) {
      rslt = await renderer(ctx);
      if (LOGGER.info) LOGGER.info(template, '\nRESULTS:', rslt);
      dom = new JSDOM(rslt);
      label = `Person ${ ctx.person ? 'H1' : 'input' } element`;
      if (ctx.person) {
        els = dom.window.document.getElementsByTagName('h1');
        expect(els, label).to.not.be.null();
        expect(els.length, label).to.be.equal(1);
        expect(els[0].innerHTML.trim(), label).to.be.equal('Hello World!');
      } else {
        els = dom.window.document.getElementById('personName');
        expect(els, label).to.not.be.null();
        expect(els.placeholder, label).to.be.equal('Please enter your name');
      }
    }
  }

  static async htmlPartialsFetchHttpsServerCompiletimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      opts.compile.contextURL = svr.url;
      opts.compile.templateURL = svr.url;
      opts.compile.partialsURL = svr.url;
      const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server during compilation via the cache read/fetch
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, false, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerCompiletimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
      const partials = await Main.getFiles(Main.PATH_HTML_PARTIALS_DIR, false); // false will only return the partial names w/o content
      await Main.baseTest(opts.compile, engine, partials, true, false, opts.render); // true to registerPartials at compile-time
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const context = { dynamicIncludeURL: `${svr.url}text.html` }; // test include from context value
      opts.render.contextURL = svr.url;
      opts.render.templateURL = svr.url;
      opts.render.partialsURL = svr.url;
      const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, false, opts.render, context); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlPartialsFetchHttpsServerRendertimeReadNoPathError() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      const engine = new Engine(opts.compile, HtmlFrmt, JsFrmt, LOGGER);
      // partials should be fetched via the HTTPS server when includes are encountered during rendering
      await Main.baseTest(opts.compile, engine, null, false, false, opts.render); // false to prevent compile-time registerPartials
    } finally {
      await svr.close();
    }
  }

  static async htmlTmplAndContextFetchHttpsServerRead() {
    const opts = baseOptions();
    const svr = await Main.httpsServer(opts.compile);
    try {
      // read/load both the template.html and context.json from the HTTPS server
      opts.compile.contextURL = svr.url;
      opts.compile.templateURL = svr.url;
      opts.compile.partialsURL = svr.url;

      const engine = new Engine(opts.compile);
      const renderer = await engine.compile();
      const files = await Main.getTemplateFiles();
      const rslt1 = await renderer();
      Main.expectDOM(rslt1, files.htmlContext);
      const rslt2 = await renderer();
      Main.expectDOM(rslt2, files.htmlContext);

      // ensure the double include is only called 2x
      // (1x for each render, since the 2nd occurance should be in the renderer's cache)
      expect(svr.callCount('double'), `Render 2x for double, partial server call count`).to.equal(2);
    } finally {
      await svr.close();
    }
  }

  static htmlIncludeSearchParamsHttpsServerRead() {
    return Main.paramsTest({
      label: 'Params = Single Search Param',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: {
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      }
    }, baseOptions());
  }

  static htmlIncludeMultiSameSearchParamsHttpsServerRead() {
    return Main.paramsTest({
      label: 'Params = Multiple Same Search Params',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } text \${ new URLSearchParams(${ JSON.stringify(params) }) }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 2, callCount: 1 }
      },
      {
        params,
        // call count should remain the same for 2nd include since it should be cached
        search: { name: 'text', paramCount: 2, callCount: 1 }
      }]
    }, baseOptions());
  }

  static htmlIncludeMultiDiffSearchParamsHttpsServerRead() {
    return Main.paramsTest({
      label: 'Params = Multiple Different Search',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } text \${ new URLSearchParams(${ JSON.stringify(params2) }) }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      },
      {
        params: params2,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      }]
    }, baseOptions());
  }

  static htmlIncludeOneSearchOneJsonParamsHttpsServerRead() {
    return Main.paramsTest({
      label: 'Params = Search + JSON',
      template: `<html><body>\${ await include\`text \${ new URLSearchParams(${ JSON.stringify(params) }) } params \${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{
        params,
        search: { name: 'text', paramCount: 1, callCount: 1 }
      },
      {
        params: params2,
        pass: { paramCount: 1 }
      }]
    }, baseOptions());
  }

  static htmlIncludeMultiDiffJsonParamsHttpsServerRead() {
    return Main.paramsTest({
      label: 'Params = Multiple Different JSON',
      template: `<html><body>\${ await include\`params\${ ${ JSON.stringify(params) } }params\${ ${ JSON.stringify(params2) } }\` }</body></html>`,
      cases: [{
        params,
        pass: { paramCount: 1 }
      },
      {
        params: params2,
        pass: { paramCount: 1 }
      }]
    }, baseOptions());
  }
}

// TODO : ESM comment the following line...
module.exports = Tester;

// when not ran in a test runner execute static Tester functions (excluding what's passed into Main.run) 
if (!Main.usingTestRunner()) {
  (async () => await Main.run(Tester))();
}

function baseOptions() {
  return {
    compile: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
    },
    render: {
      readFetchRequestOptions: {
        rejectUnauthorized: false
      }
    }
  };
}