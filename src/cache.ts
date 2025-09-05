export type Entry = { value:any; expires:number; hits:number };
export class TTLCache {
  private store = new Map<string, Entry>();
  constructor(private max=500, private ttlMs=5*60*1000){}
  get<T=any>(key:string):T|undefined{ const e=this.store.get(key); if(!e) return; if(Date.now()>e.expires){ this.store.delete(key); return; } e.hits++; return e.value as T; }
  set(key:string, value:any, ttl=this.ttlMs){ if(this.store.size>=this.max){ let worstKey: string|undefined; let worst=Infinity; for(const [k,e] of this.store){ if(e.hits<worst){ worst=e.hits; worstKey=k; } } if(worstKey) this.store.delete(worstKey); } this.store.set(key, { value, expires: Date.now()+ttl, hits: 0 }); }
}
export const cache = new TTLCache();
export async function withCache<T>(key:string, fn:()=>Promise<T>, ttl?:number){ const v=cache.get<T>(key); if(v!==undefined) return v; const r=await fn(); cache.set(key,r,ttl); return r; }
