'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

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
const { Engine, JsonEngine } = require('../index.js');
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.PLAN = 'Template Engine';
exports.TASK_DELAY = 500;
exports.TEST_TKO = 20000;
exports.LOGGER = null;//{ info: console.info, warn: console.warn, error: console.error };*/console;
exports.httpsServer = httpsServer;
exports.rmrf = rmrf;
exports.baseTest = baseTest;
exports.getFile = getFile;
exports.getFiles = getFiles;
exports.openIndexedDB = openIndexedDB;
exports.closeIndexedDB = closeIndexedDB;
exports.getTemplateFiles = getTemplateFiles;
exports.init = init;
exports.expectDOM = expectDOM;
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

const TEST_FILES = {};
const DB = {};
const Fsp = Fs.promises;
const logger = exports.LOGGER || {};

// TODO : ESM uncomment the following line...
// export function httpsServer(baseFilePath, hostname, port) {
function httpsServer(baseFilePath, hostname, port) {
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
        console.error(err);
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

// TODO : ESM uncomment the following line...
// export async function getTemplateFiles(cache = true) {
async function getTemplateFiles(cache = true) {
  const rtn = {
    tpmlPth: './test/views/template.html',
    dtaPth: './test/data/it.json'
  };

  rtn.html = (await getFile(rtn.tpmlPth, cache)).toString();
  rtn.data = JSON.parse((await getFile(rtn.dtaPth, cache)).toString());
  
  return rtn;
}

// TODO : ESM uncomment the following line...
// export async function rmrf(path) {
async function rmrf(path) {
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
      if (stats.isDirectory()) await rmrf(subx);
      else if (stats.isFile() || stats.isSymbolicLink()) await Fsp.unlink(subx);
    }
    await Fsp.rmdir(path); // dir path should be empty
  } else if (stats && (stats.isFile() || stats.isSymbolicLink())) await Fsp.unlink(path);
}

// TODO : ESM uncomment the following line...
// export async function baseTest(opts, scan, engine) {
async function baseTest(opts, scan, engine) {
  const test = await init(opts, scan, engine);
  test.fn = await test.engine.compile(test.html);
  expect(test.fn).to.be.function();
  const rslt = test.fn(test.data);
  if (logger.debug) logger.debug(rslt);//logger.debug(JsFrmt(rslt, opts.formatOptions));
  expectDOM(rslt, test.data);
  return test;
}

// TODO : ESM uncomment the following line...
// export async function getFile(path, cache = true) {
async function getFile(path, cache = true) {
  if (cache && TEST_FILES[path]) return TEST_FILES[path];
  return cache ? TEST_FILES[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
}
// TODO : ESM uncomment the following line...
// export async function getFiles(dir, readContent = true, rmBasePartial = true, cache = true) {
async function getFiles(dir, readContent = true, rmBasePartial = true, cache = true) {
  const sdirs = await Fs.promises.readdir(dir);
  var spth, stat, sfiles, files = [], filed;
  for (let sdir of sdirs) {
    spth = Path.join(dir, sdir), stat = await Fs.promises.stat(spth);
    if (stat.isDirectory()) {
      sfiles = await getFiles(spth, readContent, rmBasePartial, cache);
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

// TODO : ESM uncomment the following line...
// export async function openIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
async function openIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
  if (DB[locPrefix]) return DB[locPrefix];
  const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
  DB[locPrefix] = { locPrefix, loc, indexedDB: Level(loc) };
  if (logger.info) logger.info(`Using LevelDB @ ${loc}`);
  return DB[locPrefix];
}

// TODO : ESM uncomment the following line...
// export async function openIndexedDB(db, engine) {
async function closeIndexedDB(db, engine) {
  if (engine) {
    if (logger.debug) logger.debug(`Clearing cache for LevelDB @ ${db.loc}`);
    await engine.clearCache(true);
  }
  if (logger.debug) logger.debug(`Cloasing LevelDB @ ${db.loc}`);
  await db.indexedDB.close();
  if (logger.info) logger.info(`Removing LevelDB @ ${db.loc}`);
  if (DB[db.locPrefix]) delete DB[db.locPrefix];
  return rmrf(db.loc);
}

// TODO : ESM uncomment the following line...
// export async function init(opts, scan, engine) {
async function init(opts, scan, engine) {
  const rtn = await getTemplateFiles();
  rtn.engine = engine || new Engine(opts, JsFrmt);
  rtn.scanned = scan ? await rtn.engine.scan(true) : null;
  rtn.opts = opts;
  return rtn;
}

// TODO : ESM uncomment the following line...
// export function expectDOM(html, data) {
function expectDOM(html, data) {
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

  //console.log(fn, rslt);
  return dom;
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