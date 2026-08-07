'use strict';

/**
 * Internal cache state helpers shared by compile-time and serialized render-time operations.
 * @private
 * @ignore
 */

function optionValue(optional, name) {
  return typeof optional === 'function' ? optional(name) : optional && optional[name];
}

function canonicalSearchParams(params) {
  if (!(params instanceof URLSearchParams)) return '';
  const canonical = new URLSearchParams(params);
  canonical.sort();
  return canonical.toString();
}

function canonicalResource(resource) {
  const value = String(resource || '').replace(/\\/g, '/');
  if (!value) return '';
  try {
    const url = new URL(value);
    url.searchParams.sort();
    return url.toString();
  } catch (error) {
    const hashIndex = value.indexOf('#');
    const queryIndex = value.indexOf('?');
    const endIndex = queryIndex >= 0 ? queryIndex : hashIndex >= 0 ? hashIndex : value.length;
    const path = value.slice(0, endIndex).replace(/\/{2,}/g, '/');
    const queryEnd = hashIndex >= 0 ? hashIndex : value.length;
    const query = queryIndex >= 0 ? value.slice(queryIndex + 1, queryEnd) : '';
    const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
    if (!query) return `${path}${hash}`;
    const params = new URLSearchParams(query);
    params.sort();
    const canonical = params.toString();
    return `${path}${canonical ? `?${canonical}` : ''}${hash}`;
  }
}

function cacheOperationKey(kind, resource, params, extra) {
  const query = canonicalSearchParams(params);
  const canonical = canonicalResource(resource);
  return `${kind}:${canonical}${query && !canonical.includes('?') ? `?${query}` : ''}${typeof extra === 'undefined' ? '' : `:${String(extra)}`}`;
}

function cacheValueKey(value) {
  if (typeof value === 'function' || typeof value === 'string') return String(value);
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? json : String(value);
  } catch (error) {
    return `${String(value)}:${Date.now()}:${Math.random()}`;
  }
}

function cacheRuntime(store) {
  const key = Symbol.for('templeo.cachier.runtime-state');
  let state = store[key];
  if (!state) {
    state = {
      pending: {
        reads: new Map(),
        writes: new Map(),
        compiles: new Map()
      },
      entries: new Map(),
      clock: 0,
      stats: {
        hits: 0,
        misses: 0,
        reads: 0,
        writes: 0,
        compiles: 0,
        deduplicated: 0,
        evictions: 0,
        watcherEvents: 0,
        entries: 0,
        bytes: 0
      }
    };
    Object.defineProperty(store, key, { value: state, configurable: true });
  }
  return state;
}

function cacheMetric(store, name, amount = 1) {
  const state = cacheRuntime(store);
  if (typeof state.stats[name] !== 'number') state.stats[name] = 0;
  state.stats[name] += amount;
  return state.stats[name];
}

function cacheEntrySize(entry) {
  if (!entry) return 0;
  let value;
  if (typeof entry.content === 'string') value = entry.content;
  else if (typeof entry.func === 'function') value = entry.func.toString();
  else {
    try {
      value = JSON.stringify(entry);
    } catch (error) {
      value = String(entry);
    }
  }
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value || '').byteLength;
  return String(value || '').length * 2;
}

function cacheRemove(store, collection, path, evicted = false) {
  if (store[collection] && Object.prototype.hasOwnProperty.call(store[collection], path)) delete store[collection][path];
  const state = cacheRuntime(store), key = `${collection}:${path}`, metadata = state.entries.get(key);
  if (metadata) {
    state.entries.delete(key);
    state.stats.entries = state.entries.size;
    state.stats.bytes = Math.max(0, state.stats.bytes - metadata.bytes);
  }
  if (evicted) state.stats.evictions++;
}

function cacheTouch(store, collection, path, entry, optional) {
  if (!entry) return entry;
  const state = cacheRuntime(store), key = `${collection}:${path}`, now = Date.now();
  const previous = state.entries.get(key), bytes = cacheEntrySize(entry);
  state.entries.set(key, {
    collection,
    path,
    bytes,
    createdAt: previous ? previous.createdAt : now,
    accessedAt: now,
    order: ++state.clock
  });
  state.stats.entries = state.entries.size;
  state.stats.bytes += bytes - (previous ? previous.bytes : 0);
  cachePrune(store, optional);
  return entry;
}

function cacheLookup(store, collection, path, optional, count = true) {
  const entry = store[collection] && store[collection][path];
  if (!entry) {
    if (count) cacheMetric(store, 'misses');
    return null;
  }
  const state = cacheRuntime(store), key = `${collection}:${path}`, now = Date.now();
  let metadata = state.entries.get(key);
  const ttl = Number(optionValue(optional, 'cacheTTL')) || 0;
  if (metadata && ttl > 0 && now - metadata.accessedAt >= ttl) {
    cacheRemove(store, collection, path, true);
    if (count) cacheMetric(store, 'misses');
    return null;
  }
  if (!metadata) {
    cacheTouch(store, collection, path, entry, optional);
    metadata = state.entries.get(key);
  }
  if (metadata) {
    metadata.accessedAt = now;
    metadata.order = ++state.clock;
  }
  if (count) cacheMetric(store, 'hits');
  return entry;
}

function cachePrune(store, optional) {
  const state = cacheRuntime(store);
  const maxEntries = Number(optionValue(optional, 'maxCacheEntries')) || 0;
  const maxBytes = Number(optionValue(optional, 'maxCacheBytes')) || 0;
  while ((maxEntries > 0 && state.entries.size > maxEntries) || (maxBytes > 0 && state.stats.bytes > maxBytes)) {
    let oldestKey, oldest;
    for (const [key, metadata] of state.entries) {
      if (!oldest || metadata.order < oldest.order) {
        oldestKey = key;
        oldest = metadata;
      }
    }
    if (!oldestKey || !oldest) break;
    cacheRemove(store, oldest.collection, oldest.path, true);
  }
}

function cacheSnapshot(store) {
  const state = cacheRuntime(store);
  return {
    ...state.stats,
    pendingReads: state.pending.reads.size,
    pendingWrites: state.pending.writes.size,
    pendingCompiles: state.pending.compiles.size
  };
}

function cacheResetStats(store) {
  const state = cacheRuntime(store), entries = state.stats.entries, bytes = state.stats.bytes;
  for (const name of Object.keys(state.stats)) state.stats[name] = 0;
  state.stats.entries = entries;
  state.stats.bytes = bytes;
  return cacheSnapshot(store);
}

function cacheClearEntries(store) {
  const state = cacheRuntime(store);
  state.entries.clear();
  state.pending.reads.clear();
  state.pending.writes.clear();
  state.pending.compiles.clear();
  state.clock = 0;
  state.stats.entries = 0;
  state.stats.bytes = 0;
}

function withPending(store, type, key, factory) {
  const state = cacheRuntime(store), pending = state.pending[type] || (state.pending[type] = new Map());
  if (pending.has(key)) {
    cacheMetric(store, 'deduplicated');
    return pending.get(key);
  }
  const promise = Promise.resolve().then(factory);
  pending.set(key, promise);
  promise.finally(() => {
    if (pending.get(key) === promise) pending.delete(key);
  }).catch(() => undefined);
  return promise;
}

export {
  optionValue,
  canonicalSearchParams,
  canonicalResource,
  cacheOperationKey,
  cacheValueKey,
  cacheRuntime,
  cacheMetric,
  cacheEntrySize,
  cacheRemove,
  cacheTouch,
  cacheLookup,
  cachePrune,
  cacheSnapshot,
  cacheResetStats,
  cacheClearEntries,
  withPending
};
