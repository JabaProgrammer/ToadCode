import { performance } from 'node:perf_hooks';
import { runUserCode } from './sandbox.js';
export function timeit(code, func, gen, ns) {
    const res = [];
    for (const n of ns) {
        const input = gen(n);
        const t0 = performance.now();
        try {
            runUserCode(code, func, input);
        }
        finally {
            res.push({ n, ms: performance.now() - t0 });
        }
    }
    return res;
}
export function fitAsymptotics(points) {
    const nlogn = (n) => n * Math.log2(Math.max(2, n));
    const score = (f) => points.reduce((s, p) => s + p.ms / (f(p.n) || 1), 0);
    const s1 = score(n => n), s2 = score(nlogn), s3 = score(n => n * n);
    const best = Math.min(s1, s2, s3);
    return best === s1 ? '≈ O(n)' : best === s2 ? '≈ O(n log n)' : '≈ O(n^2)';
}
