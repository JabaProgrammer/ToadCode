export const ALGORITHMS = [
    { id: 'dijkstra', name: 'Dijkstra (heap)', description: 'SSSP in non-negative graphs', complexity: { time: 'O((V+E) log V)', space: 'O(V)' }, templateTS: `
export type Edge = { to: number; w: number };
export function dijkstra(n: number, g: Edge[][], s: number): number[] {
  const INF = Number.POSITIVE_INFINITY;
  const dist = Array(n).fill(INF); dist[s] = 0; const used = Array(n).fill(false);
  const pq: [number, number][] = [[0,s]]; // naive heap → replace with binary heap if needed
  const pop = () => { let b=0; for (let i=1;i<pq.length;i++) if (pq[i][0] < pq[b][0]) b=i; return pq.splice(b,1)[0]; };
  while (pq.length) { const [d,v] = pop(); if (used[v]) continue; used[v]=true; if (d!==dist[v]) continue;
    for (const {to,w} of g[v]) { const nd=d+w; if (nd<dist[to]) { dist[to]=nd; pq.push([nd,to]); } } }
  return dist; }
` },
    { id: 'kmp', name: 'KMP', description: 'Substring search', complexity: { time: 'O(n+m)', space: 'O(m)' }, templateTS: `
export function prefixFunction(s: string): number[] {
  const n = s.length, pi = Array(n).fill(0);
  for (let i=1;i<n;i++){ let j=pi[i-1]; while(j>0 && s[i]!==s[j]) j=pi[j-1]; if (s[i]===s[j]) j++; pi[i]=j; }
  return pi; }
export function find(text: string, pat: string): number[] {
  const s = pat + '#' + text; const pi = prefixFunction(s); const m = pat.length; const res: number[] = [];
  for (let i=m+1;i<s.length;i++) if (pi[i]===m) res.push(i-2*m);
  return res; }
` },
    { id: 'dsu', name: 'DSU (union-find)', description: 'Disjoint sets with path compression', complexity: { time: 'O(α(n)) amort.', space: 'O(n)' }, templateTS: `
export class DSU { p: number[]; r: number[]; constructor(n:number){ this.p=[...Array(n).keys()]; this.r=Array(n).fill(0); }
  find(x:number):number{ return this.p[x]===x? x : (this.p[x]=this.find(this.p[x])); }
  union(a:number,b:number):boolean{ a=this.find(a); b=this.find(b); if(a===b) return false; if(this.r[a]<this.r[b]) [a,b]=[b,a]; this.p[b]=a; if(this.r[a]===this.r[b]) this.r[a]++; return true; } }
` }
];
export function getTemplate(id) { return ALGORITHMS.find(a => a.id === id) ?? null; }
