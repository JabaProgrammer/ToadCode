export class TTLCache {
    max;
    ttlMs;
    store = new Map();
    constructor(max = 500, ttlMs = 5 * 60 * 1000) {
        this.max = max;
        this.ttlMs = ttlMs;
    }
    get(key) { const e = this.store.get(key); if (!e)
        return; if (Date.now() > e.expires) {
        this.store.delete(key);
        return;
    } e.hits++; return e.value; }
    set(key, value, ttl = this.ttlMs) { if (this.store.size >= this.max) {
        let worstKey;
        let worst = Infinity;
        for (const [k, e] of this.store) {
            if (e.hits < worst) {
                worst = e.hits;
                worstKey = k;
            }
        }
        if (worstKey)
            this.store.delete(worstKey);
    } this.store.set(key, { value, expires: Date.now() + ttl, hits: 0 }); }
}
export const cache = new TTLCache();
export async function withCache(key, fn, ttl) { const v = cache.get(key); if (v !== undefined)
    return v; const r = await fn(); cache.set(key, r, ttl); return r; }
