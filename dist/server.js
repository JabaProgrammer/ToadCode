#!/usr/bin/env node
import { StdioServerTransport, Server } from '@modelcontextprotocol/sdk/server';
import { guessComplexity, spotAntiPatterns } from './analyzers.js';
import { getTemplate } from './algorithms.js';
import { timeit, fitAsymptotics } from './benchmarks.js';
import { searchRegistries, osvQuery, npmDepsGraph, pypiRequires, suggestSafeVersion, trustScore } from './sourcing.js';
import { refinePrompt } from './uprules.js';
const server = new Server({ name: 'toadcode-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
server.tool({ name: 'prompt_improver', description: 'Analyze prompt, find gaps, produce questions', inputSchema: { type: 'object', properties: { prompt: { type: 'string' } }, required: ['prompt'] } }, async ({ prompt }) => {
    const r = refinePrompt(prompt);
    return { summary: 'Prompt analyzed', details: r, next_steps: r.open_questions?.length ? ['Ask user'] : ['Proceed'] };
});
server.tool({ name: 'propose_algorithm', description: 'Suggest algorithm candidates', inputSchema: { type: 'object', properties: { problem: { type: 'string' } }, required: ['problem'] } }, async ({ problem }) => {
    const p = problem.toLowerCase();
    const cand = [];
    if (/shortest|кратч|путь/.test(p))
        cand.push('dijkstra');
    if (/подстр|substring|pattern|шаблон/.test(p))
        cand.push('kmp');
    if (/компонент|соед|cluster|объедин/.test(p))
        cand.push('dsu');
    const candidates = (cand.length ? cand : ['kmp', 'dijkstra', 'dsu']).map(id => { const t = getTemplate(id); return { name: t.name, idea: t.description, complexity: t.complexity, when_to_use: 'see description', templateId: t.id }; });
    return { problem, candidates, summary: 'Candidates ready', next_steps: ['generate_template', 'research_solutions'] };
});
server.tool({ name: 'generate_template', description: 'Return solution skeleton', inputSchema: { type: 'object', properties: { templateId: { type: 'string' } }, required: ['templateId'] } }, async ({ templateId }) => {
    const t = getTemplate(templateId);
    if (!t)
        throw new Error('Unknown template');
    return { summary: `Template ${t.name}`, code: t.templateTS, details: t.description, next_steps: ['Fill solve()', 'Add tests'] };
});
server.tool({ name: 'analyze_code', description: 'Static analysis', inputSchema: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] } }, async ({ code }) => {
    const complexity = guessComplexity(code);
    const issues = spotAntiPatterns(code);
    return { summary: 'Analysis done', complexityGuess: complexity, issues, hotspots: [], next_steps: ['Choose algorithm', 'Refactor', 'Add tests/bench'] };
});
server.tool({ name: 'verify_complexity', description: 'Empirical complexity check', inputSchema: { type: 'object', properties: { code: { type: 'string' }, entry: { type: 'string' }, ns: { type: 'array', items: { type: 'number' } } }, required: ['code', 'entry', 'ns'] } }, async ({ code, entry, ns }) => {
    const gen = (n) => [Array.from({ length: n }, (_, i) => n - i)];
    const pts = timeit(code, entry, gen, ns);
    const fit = fitAsymptotics(pts);
    return { summary: 'Bench done', details: { points: pts, fit }, next_steps: ['Compare to theory'] };
});
server.tool({ name: 'research_solutions', description: 'Search registries (GitHub/npm/PyPI)', inputSchema: { type: 'object', properties: { query: { type: 'string' }, ecosystems: { type: 'array', items: { type: 'string' } } }, required: ['query'] } }, async ({ query, ecosystems = ['github', 'npm', 'pypi'] }) => {
    const res = await searchRegistries({ query, ecosystems });
    return { summary: `Found ${res.total}`, details: res.items, next_steps: ['audit_library'] };
});
server.tool({ name: 'cve_check', description: 'OSV vulnerability check', inputSchema: { type: 'object', properties: { ecosystem: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' } }, required: ['ecosystem', 'name', 'version'] } }, async ({ ecosystem, name, version }) => {
    const res = await osvQuery({ ecosystem, name, version });
    const fixes = res.vulns?.flatMap((v) => v.affected?.flatMap((a) => a.ranges?.flatMap((r) => (r.events || []).map((e) => e.fixed).filter(Boolean)))) || [];
    return { summary: res.vulns?.length ? 'VULNS FOUND' : 'Clean', details: { vulns: res.vulns, safe_versions: fixes }, next_steps: res.vulns?.length ? ['Update or replace'] : ['OK'] };
});
server.tool({ name: 'deps_graph', description: 'Transitive deps graph', inputSchema: { type: 'object', properties: { ecosystem: { type: 'string' }, name: { type: 'string' }, version: { type: 'string' }, maxDepth: { type: 'number' } }, required: ['ecosystem', 'name', 'version'] } }, async ({ ecosystem, name, version, maxDepth = 3 }) => {
    if (ecosystem === 'npm') {
        const g = await npmDepsGraph(name, version, maxDepth);
        return { summary: `Nodes: ${g.count}`, details: g, next_steps: g.count > 150 ? ['Too heavy deps → reconsider'] : ['OK'] };
    }
    if (ecosystem === 'PyPI') {
        const r = await pypiRequires(name, version);
        return { summary: `requires_dist: ${r.requires.length}`, details: r, next_steps: r.requires.length > 50 ? ['Too heavy deps'] : ['OK'] };
    }
    return { summary: 'Unsupported ecosystem', details: {}, next_steps: [] };
});
server.tool({ name: 'suggest_safe_version', description: 'Recommend OSV-clean version', inputSchema: { type: 'object', properties: { ecosystem: { type: 'string' }, name: { type: 'string' } }, required: ['ecosystem', 'name'] } }, async ({ ecosystem, name }) => {
    const res = await suggestSafeVersion(ecosystem, name);
    return { summary: res.version ? `Use ${res.version}` : 'No safe version found', details: res, next_steps: res.version ? ['Test and update'] : ['Pick alternative or implement'] };
});
server.tool({ name: 'trust_score', description: 'Compute TrustScore', inputSchema: { type: 'object', properties: { source: { type: 'string' }, stars: { type: 'number' }, daysSinceUpdate: { type: 'number' }, issues: { type: 'number' }, license: { type: 'string' }, cveCount: { type: 'number' }, deps: { type: 'number' } }, required: ['source'] } }, async (inp) => {
    const score = trustScore(inp);
    return { summary: `TrustScore=${score}`, details: { score, factors: inp }, next_steps: score < 60 ? ['Avoid'] : ['OK'] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
