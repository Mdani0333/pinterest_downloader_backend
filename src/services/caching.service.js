import NodeCache from "node-cache";

class CacheService {
  constructor() {
    if (!CacheService.instance) {
      this.cache = new NodeCache({
        stdTTL: 0,
        checkperiod: 0,
        useClones: false,
      });
      CacheService.instance = this;
    }
    return CacheService.instance;
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value) {
    this.cache.set(key, value, 0);
  }

  update(key, value) {
    if (this.cache.has(key)) {
      this.cache.set(key, value, 0);
    }
  }

  del(key) {
    this.cache.del(key);
  }

  has(key) {
    return this.cache.has(key);
  }

  flush() {
    this.cache.flushAll();
  }

  keys() {
    return this.cache.keys();
  }

  mget(keys) {
    return this.cache.mget(keys);
  }

  mset(keyValuePairs) {
    this.cache.mset(keyValuePairs);
  }
}

export const cacheService = new CacheService();
