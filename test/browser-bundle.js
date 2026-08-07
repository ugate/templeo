'use strict';

import * as Fs from 'node:fs';
import * as Path from 'node:path';

const CACHE_UTILITY_NAMES = Object.freeze([
  'optionValue',
  'canonicalSearchParams',
  'canonicalResource',
  'cacheOperationKey',
  'cacheValueKey',
  'cacheRuntime',
  'cacheMetric',
  'cacheEntrySize',
  'cacheRemove',
  'cacheTouch',
  'cacheLookup',
  'cachePrune',
  'cacheSnapshot',
  'cacheResetStats',
  'cacheClearEntries',
  'withPending'
]);

/**
 * Creates a browser-executable bundle from Templeo's native ESM source without changing production files.
 * Each source module is isolated in an IIFE so its private module variables remain independent.
 * @returns {Promise<String>} The script that exposes `TempleoEngine` on the browser global object.
 */
async function browserBundle() {
  const modules = [
    ['Director', 'lib/director.js'],
    ['TemplateOpts', 'lib/template-options.js'],
    ['Sandbox', 'lib/sandbox.js'],
    ['Cachier', 'lib/cachier.js'],
    ['Engine', 'index.js']
  ];
  let source = await Fs.promises.readFile(Path.resolve('lib/cache-utils.js'), 'utf8');
  source = stripModuleSyntax(source);
  let bundle = `const {${CACHE_UTILITY_NAMES.join(',')}}=(()=>{${source}\nreturn {${CACHE_UTILITY_NAMES.join(',')}};\n})();\n`;
  for (const [name, relativePath] of modules) {
    source = await Fs.promises.readFile(Path.resolve(relativePath), 'utf8');
    source = stripModuleSyntax(source);
    bundle += `const ${name}=(()=>{${source}\nreturn ${name};\n})();\n`;
  }
  return `${bundle}globalThis.TempleoEngine=Engine;`;
}

/**
 * Removes static ESM import/export declarations from a source module that will be wrapped in a browser IIFE.
 * Multiline imports are consumed through their terminating semicolon so the generated bundle contains no static
 * module syntax while leaving dynamic `import()` expressions intact.
 * @param {String} source The native ESM source text.
 * @returns {String} Browser-evaluable source with module declarations removed.
 */
function stripModuleSyntax(source) {
  const lines = source.split('\n'), output = [];
  let skippingImport = false, skippingExport = false;
  for (const line of lines) {
    if (skippingImport) {
      if (/;\s*$/.test(line)) skippingImport = false;
      continue;
    }
    if (skippingExport) {
      if (/};?\s*$/.test(line)) skippingExport = false;
      continue;
    }
    if (/^\s*import\b/.test(line)) {
      if (!/;\s*$/.test(line)) skippingImport = true;
      continue;
    }
    if (/^\s*export\s+default\b/.test(line)) continue;
    if (/^\s*export\s*\{/.test(line)) {
      if (!/};?\s*$/.test(line)) skippingExport = true;
      continue;
    }
    output.push(line);
  }
  return output.join('\n');
}

export { browserBundle, stripModuleSyntax };
