'use strict';

// run tests:
// npm test
// generate jsdoc:
// npm run gen-docs

const http = require('http');
exports.http = http;
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
const { Engine, JsonEngine, Cache } = require('../index.js');
exports.Engine = Engine;
exports.JsonEngine = JsonEngine;
exports.Cache = Cache;
exports.PLAN = 'Template Engine';
exports.TASK_DELAY = 500;
exports.TEST_TKO = 20000;
exports.ENGINE_LOGGER = null;//console.log;
exports.LOGGER = null;//console.log;
exports.httpServer = httpServer;
exports.getTemplate = getTemplate;
// TODO : ESM uncomment the following lines...
// import * as http from 'http';
// export * as http from http;
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
// import { Engine, JsonEngine, Cache } from '../index.mjs';
// export * as Engine from Engine;
// export * as JsonEngine from JsonEngine;
// export * as Cache from Cache;
// export const PLAN = 'Template Engine';
// export const TASK_DELAY = 500;
// export const TEST_TKO = 20000;
// export const ENGINE_LOGGER = console.log;
// export const LOGGER = console.log;

const TMPLS = {};

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
// export async function getTemplate(filename, cache = true) {
async function getTemplate(path, cache = true) {
  if (cache && TMPLS[path]) return TMPLS[path];
  return cache ? TMPLS[path] = await Fs.promises.readFile(path) : Fs.promises.readFile(path);
}