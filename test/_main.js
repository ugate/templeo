'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

const http = require('http');
exports.http = http;
const Os = require('os');
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
const { Engine, JsonEngine } = require('../index.js');
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.PLAN = 'Template Engine';
exports.TASK_DELAY = 500;
exports.TEST_TKO = 20000;
exports.ENGINE_LOGGER = console;//console;
exports.LOGGER = null;//console.log;
exports.httpServer = httpServer;
exports.getFile = getFile;
exports.expectDOM = expectDOM;
exports.genIndexedDB = genIndexedDB;
// TODO : ESM uncomment the following lines...
// import * as http from 'http';
// export * as http from http;
// import * as Os from 'os';
// import * as Fs from 'fs';
// export * as Fs from Fs;
// import * as Path from 'path';
// export * as Path from Path;
// import * as code from 'code';
// export * as code from code;
// import * as expect from 'expect';
// export * as expect from expect;
// import * as Lab from 'lab';
// export * as Lab from Lab;
// import { js } as JsFrmt from 'js-beautify';
// export * as JsFrmt from JsFrmt;
// import { JSDOM } as JSDOM from 'jsdom';
// export * as JSDOM from JSDOM;
// import * as Level from 'level';
// import { Engine, JsonEngine } from '../index.mjs';
// export * as Engine from Engine;
// export * as JsonEngine from JsonEngine;
// export const PLAN = 'Template Engine';
// export const TASK_DELAY = 500;
// export const TEST_TKO = 20000;
// export const ENGINE_LOGGER = console.log;
// export const LOGGER = console.log;

const DB = {};
const FILES = {};

// TODO : ESM uncomment the following line...
// export async function genIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
async function genIndexedDB(locPrefix = 'templeo-test-indexedDB-') {
  if (DB[locPrefix]) return DB[locPrefix];
  const loc = await Fs.promises.mkdtemp(Path.join(Os.tmpdir(), locPrefix));
  DB[locPrefix] = { loc, indexedDB: Level(loc) };
  return DB[locPrefix];
}

// TODO : ESM uncomment the following line...
// export async function httpServer(testFileName, hostname = '127.0.0.1', port = 3000) {
async function httpServer(testFileName, hostname = '127.0.0.1', port = 3000) {
  const server = http.createServer((req, res) => {
    const html = Fs.readFileSync(Path.join('./data/', testFileName));
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');
    res.end(html);
  });
  server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
  });
  return server;
}

// TODO : ESM uncomment the following line...
// export async function getFile(filename, cache = true) {
async function getFile(path, cache = true) {
  if (cache && FILES[path]) return FILES[path];
  return cache ? FILES[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
}

// TODO : ESM uncomment the following line...
// export function expectDOM(html, data) {
function expectDOM(html, data) {
  const dom = new JSDOM(html);
  var el;

  // array iteration test
  for (let i = 0, arr = data.metadata; i < arr.length; i++) {
    el = dom.window.document.querySelector(`[name="${arr[i].name}"][content="${arr[i].content}"]`) || {};
    expect(el.name).to.equal(arr[i].name);
    expect(el.getAttribute('content')).to.equal(arr[i].content);
  }

  // object property iteration test
  var el, hasSel, idx = -1;
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