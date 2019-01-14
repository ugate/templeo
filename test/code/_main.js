'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

const TEST_FILES = {};
const DB = {};
const logger = {};
//const logger = { info: console.info, warn: console.warn, error: console.error };
//const logger = console;

const Forge = require('node-forge');
const https = require('https');
exports.https = https;
const Os = require('os');
exports.Os = Os;
const Fs = require('fs');
exports.Fs = Fs;
const Path = require('path');
exports.Path = Path;
const { expect } = require('code');
exports.expect = expect;
const Lab = require('lab');
exports.Lab = Lab;
const JsFrmt = require('js-beautify').js;
exports.JsFrmt = JsFrmt;
const { JSDOM } = require('jsdom');
exports.JSDOM = JSDOM;
const Level = require('level');
exports.Level = Level;
const { Engine, JsonEngine } = require('../../index.js');
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.PLAN = 'Template Engine';
exports.TASK_DELAY = 500;
exports.TEST_TKO = 20000;
exports.LOGGER = logger;
// TODO : ESM uncomment the following lines...
// TODO : import * as Forge from 'node-forge';
// TODO : import * as http from 'https';
// export * as https from https;
// TODO : import * as Os from 'os';
// export * as Os from Os;
// TODO : import * as Fs from 'fs';
// export * as Fs from Fs;
// TODO : import * as Path from 'path';
// export * as Path from Path;
// TODO : import * as code from 'code';
// export * as code from code;
// TODO : import * as expect from 'expect';
// export * as expect from expect;
// TODO : import * as Lab from 'lab';
// export * as Lab from Lab;
// TODO : import { js } as JsFrmt from 'js-beautify';
// export * as JsFrmt from JsFrmt;
// TODO : import { JSDOM } as JSDOM from 'jsdom';
// export * as JSDOM from JSDOM;
// TODO : import * as Level from 'level';
// export * as Level from Level;
// TODO : import { Engine, JsonEngine } from '../index.mjs';
// export * as Engine from Engine;
// export * as JsonEngine from JsonEngine;
// export const PLAN = 'Template Engine';
// export const TASK_DELAY = 500;
// export const TEST_TKO = 20000;
// export const LOGGER = logger;

const Fsp = Fs.promises;

// TODO : ESM uncomment the following line...
// export
class Main {

  static httpsServer(baseFilePath, hostname, port) {
    return new Promise((resolve, reject) => {
      const sec = selfSignedCert();
      var url;
      const server = https.createServer({ key: sec.key, cert: sec.cert }, async (req, res) => {
        const mthd = req.method.toUpperCase();
        try {
          if (logger.info) logger.info(`HTTPS server received: ${url}${req.url}`);
          const prms = new URL(`${url}${req.url}`).searchParams, type = prms.get('type');
          const file = Path.join(baseFilePath, req.url);
          const contents = await Fsp.readFile(file);
          res.statusCode = 200;
          res.setHeader('Content-Type', type || 'text/html');
          res.end(contents);
        } catch (err) {
          if (logger.error) logger.error(err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/html');
          res.end(`Failed to ${mthd} for: ${req.url}`);
        }
      });
      server.listen(port, hostname, () => {
        const addy = server.address();
        url = `https://${addy.address === '::' || server.address === '0.0.0.0' ? '127.0.0.1' : addy.includes}:${addy.port}/`;
        if (logger.info) logger.info(`Server running at ${url}`);
        resolve({ url, close: () => {
          return new Promise((resolve, reject) => {
            server.close(err => err ? reject(err) : resolve());
          });
        }});
      });
    });
  }

  static async getTemplateFiles(cache = true) {
    const rtn = {
      tpmlPth: './test/views/template.html',
      dtaPth: './test/data/it.json'
    };
  
    rtn.html = (await getFile(rtn.tpmlPth, cache)).toString();
    rtn.data = JSON.parse((await getFile(rtn.dtaPth, cache)).toString());
    
    return rtn;
  }

  static async rmrf(path) {
    var stats, subx;
    try {
      stats = await Fsp.stat(path);
    } catch (e) {
      stats = null;
    }
    if (stats && stats.isDirectory()) {
      for (let sub of await Fsp.readdir(path)) {
        subx = Path.resolve(path, sub);
        stats = await Fsp.stat(subx);
        if (stats.isDirectory()) await Main.rmrf(subx);
        else if (stats.isFile() || stats.isSymbolicLink()) await Fsp.unlink(subx);
      }
      await Fsp.rmdir(path); // dir path should be empty
    } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await Fsp.unlink(path);
  }

  static async baseTest(compileOpts, engine, partials, readPartials, renderOpts) {
    const test = await Main.init(compileOpts, engine);
    test.registerPartialsResult = partials || readPartials ? await test.engine.registerPartials(partials, readPartials) : null;
    test.fn = await test.engine.compile(test.html);
    expect(test.fn).to.be.function();
    test.result = await test.fn(test.data, renderOpts);
    if (logger.debug) logger.debug(test.result);//logger.debug(JsFrmt(test.result, compileOpts.formatOptions));
    Main.expectDOM(test.result, test.data);
    return test;
  }

  static async getFiles(dir, readContent = true, rmBasePartial = true, cache = true) {
    const sdirs = await Fs.promises.readdir(dir);
    var spth, stat, sfiles, files = [], filed;
    for (let sdir of sdirs) {
      spth = Path.join(dir, sdir), stat = await Fs.promises.stat(spth);
      if (stat.isDirectory()) {
        sfiles = await Main.getFiles(spth, readContent, rmBasePartial, cache);
        files = sfiles && sfiles.length ? files.length ? files.concat(sfiles) : sfiles : files;
      } else if (stat.isFile()) {
        filed = {
          name: (rmBasePartial ? spth.replace(/[\/\\]?test[\/\\]views[\/\\]partials[\/\\]?/, '') : spth).replace(/\..+$/, '').replace(/\\+/g, '/'),
          path: spth
        };
        if (readContent) filed.content = (await Fs.promises.readFile(spth)).toString();
        files.push(filed);
      }
    }
    return files;
  }

  static async openIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
    if (DB[locPrefix]) return DB[locPrefix];
    const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
    DB[locPrefix] = { locPrefix, loc, indexedDB: Level(loc) };
    if (logger.info) logger.info(`Using LevelDB @ ${loc}`);
    return DB[locPrefix];
  }

  static async closeIndexedDB(db, engine) {
    if (engine) {
      if (logger.debug) logger.debug(`Clearing cache for LevelDB @ ${db.loc}`);
      await engine.clearCache(true);
    }
    if (logger.debug) logger.debug(`Cloasing LevelDB @ ${db.loc}`);
    await db.indexedDB.close();
    if (logger.info) logger.info(`Removing LevelDB @ ${db.loc}`);
    if (DB[db.locPrefix]) delete DB[db.locPrefix];
    return Main.rmrf(db.loc);
  }

  static async init(opts, engine) {
    const rtn = await Main.getTemplateFiles();
    rtn.engine = engine || new Engine(opts, JsFrmt, null, logger);
    rtn.opts = opts;
    return rtn;
  }

  static wait(delay, val, rejectIt) {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (rejectIt) reject(val instanceof Error ? val : new Error(val));
        else resolve(val);
      }, delay);
    });
  }

  static expectDOM(html, data) {
    const dom = new JSDOM(html);
    var el;
  
    // comment block should be removed
    expect(html.includes('This is a comment')).to.be.false();
  
    // array iteration test
    for (let i = 0, arr = data.metadata; i < arr.length; i++) {
      el = dom.window.document.querySelector(`[name="${arr[i].name}"][content="${arr[i].content}"]`) || {};
      expect(el.name).to.equal(arr[i].name);
      expect(el.getAttribute('content')).to.equal(arr[i].content);
    }
  
    // object property iteration test
    var el, hasSel;
    for (let state in data.globals.states) {
      el = dom.window.document.querySelector(`option[id="stateSelect${state}"]`) || {};
      expect(el.value).to.equal(state);
      expect(el.innerHTML).to.equal(data.globals.states[state]);
      if (state === 'FL') {
        hasSel = true;
        expect(el.selected).to.be.true(); // conditional check
      }
    }
  
    expect(hasSel).to.be.true();
  
    // check for partials
    expectColorDOM(dom, data, 'swatchSelectColor'); // select options
    expectColorDOM(dom, data, 'swatchDatalistColor'); // datalist options
  
    // check nested partial
    const swatchDatalist = dom.window.document.getElementById('swatchDatalist');
    expect(swatchDatalist).to.be.object();
  
    //if (logger.debug) logger.debug(fn, rslt);
    return dom;
  }

  static usingTestRunner() {
    return process.mainModule.filename.endsWith('lab');
  }

  /**
   * Runs a function from a class using `return Clazz[process.argv[2]](...args)`
   * __or__ runs through all of the `async` functions from `Object.getOwnPropertyNames(Clazz)` via
   * `await Clazz[propertyName](...args)` other than function names that are found in `excludes` or
   * `before`, `beforeEach`, `after`, `afterEach`.
   * @ignore
   * @param {Object} Clazz The class the test running will be running for
   * @param {String[]} [excludes] Function names to exclude from execution (only used when executing all)
   * @param {*[]} [args] Any additional arguments to pass to function(s) that are executed
   * @returns {Object} The return value(s) from the designated function call with each property
   * name set to the name of the function executed and the value as the return value from the call
   */
  static async run(Clazz, excludes, ...args) {
    const prps = process.argv[2] ? [process.argv[2]] : Object.getOwnPropertyNames(Clazz);
    const excls = ['before', 'beforeEach', 'after', 'afterEach'], execr = {}, rtn = {};

    for (let enm of excls) {
      execr[enm] = typeof Clazz[enm] === 'function' ? Clazz[enm] : null;
    }

    if (execr['before']) {
      if (logger.info) logger.info(`Executing: ${Clazz.name}.before(${args.join(',')})`);
      rtn['before'] = await execr['before'](...args);
    }
    for (let prop of prps) {
      if (execr['beforeEach']) {
        if (logger.info) logger.info(`Executing: ${Clazz.name}.beforeEach(${args.join(',')})`);
        rtn['beforeEach'] = await execr['beforeEach'](...args);
      }
      if (typeof Clazz[prop] === 'function' && (!excludes || !excludes.includes(prop)) && !excls.includes(prop)) {
        if (logger.info) logger.info(`Executing: await ${Clazz.name}.${prop}(${args.join(',')})`);
        rtn[prop] = await Clazz[prop](...args);
      }
      if (execr['afterEach']) {
        if (logger.info) logger.info(`Executing: ${Clazz.name}.afterEach(${args.join(',')})`);
        rtn['afterEach'] = await execr['afterEach'](...args);
      }
    }
    if (execr['after']) {
      if (logger.info) logger.info(`Executing: ${Clazz.name}.after(${args.join(',')})`);
      rtn['after'] = await execr['after'](...args);
    }

    return rtn;
  }
}

// TODO : ESM remove the following line...
exports.Main = Main;

async function getFile(path, cache = true) {
  if (cache && TEST_FILES[path]) return TEST_FILES[path];
  return cache ? TEST_FILES[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
}

function expectColorDOM(dom, data, prefix) {
  var el, hasSel, idx = -1;
  for (let color of data.swatch) {
    el = dom.window.document.getElementById(`${prefix}${++idx}`) || {};
    expect(el.value).to.equal(color);
    expect(el.innerHTML).to.equal(color);
    if (color === '#ff5722') {
      hasSel = true;
      expect(el.selected).to.be.true(); // conditional check
    }
  }

  expect(hasSel).to.be.true();
}

function selfSignedCert(publicKey) {
  Forge.options.usePureJavaScript = true;
  const pki = Forge.pki, keys = pki.rsa.generateKeyPair(2048), cert = pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date();
  cert.validity.notAfter = new Date();
  cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);
  const attrs = [
    {name:'commonName',value:'example.org'}
   ,{name:'countryName',value:'US'}
   ,{shortName:'ST',value:'Arizona'}
   ,{name:'localityName',value:'Tucson'}
   ,{name:'organizationName',value:'Test'}
   ,{shortName:'OU',value:'Test'}
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey);
  return {
    key: publicKey ? pki.publicKeyToPem(keys.publicKey) : pki.privateKeyToPem(keys.privateKey),
    cert: pki.certificateToPem(cert)
  };
}