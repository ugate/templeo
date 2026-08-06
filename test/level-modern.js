'use strict';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { after, describe, test } from 'node:test';
import CachierDB from '../lib/cachier-db.js';
const tempDirs = [];
after(async () => {
  await Promise.all(tempDirs.map(dir => fs.rm(dir, { recursive: true, force: true })));
});
describe('Modern Level API compatibility', () => {
  test('loads a named Level class and captures all records with iterator()', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'templeo-level-modern-'));
    tempDirs.push(dir);
    const modulePath = path.join(dir, 'fake-level.mjs');
    await fs.writeFile(modulePath, `
const databases = globalThis.__templeoModernLevelStores ||= new Map();
class Level {
  constructor(location) {
    this.location = location;
    this.status = 'closed';
    if (!databases.has(location)) databases.set(location, new Map());
    this.records = databases.get(location);
  }
  async open() { this.status = 'open'; }
  async close() { this.status = 'closed'; }
  async get(key) {
    if (!this.records.has(key)) {
      const error = new Error('Key not found');
      error.code = 'LEVEL_NOT_FOUND';
      throw error;
    }
    return this.records.get(key);
  }
  async put(key, value) { this.records.set(key, value); }
  async del(key) { this.records.delete(key); }
  async *iterator() {
    for (const entry of this.records.entries()) yield entry;
  }
}
export { Level };
export default { Level };
`, 'utf8');
    const options = {
      dbTypeName: pathToFileURL(modulePath).href,
      dbLocName: path.join(dir, 'database'),
      renderTimePolicy: 'read-all-on-init-when-empty'
    };
    const writer = new CachierDB(options);
    await writer.write('alpha', {
      name: 'alpha.html',
      shortName: 'alpha',
      content: 'Alpha',
      extension: 'html'
    }, true, 'html');
    await writer.write('beta', {
      name: 'beta.html',
      shortName: 'beta',
      content: 'Beta',
      extension: 'html'
    }, true, 'html');
    const reader = new CachierDB(options);
    await reader.register(null, true, false);
    assert.equal((await reader.getRegistered('alpha')).content, 'Alpha');
    assert.equal((await reader.getRegistered('beta')).content, 'Beta');
    await reader.clear(true);
  });
});
