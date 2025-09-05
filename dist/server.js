#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { guessComplexity, spotAntiPatterns } from './analyzers.js';
import { getTemplate } from './algorithms.js';
import { timeit, fitAsymptotics } from './benchmarks.js';
import { searchRegistries, osvQuery, npmDepsGraph, pypiRequires, suggestSafeVersion, trustScore } from './sourcing.js';
import { refinePrompt } from './uprules.js';
import { z } from 'zod';
const server = new McpServer({ name: 'toadcode-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });
server.registerTool('prompt_improver', {
    description: 'Analyze prompt, find gaps, produce questions',
    inputSchema: { prompt: z.string() }
}, async ({ prompt }) => {
    const r = refinePrompt(prompt);
    return { content: [], summary: 'Prompt analyzed', details: r, next_steps: r.open_questions?.length ? ['Ask user'] : ['Proceed'] };
});
server.registerTool('propose_algorithm', {
    description: 'Suggest algorithm candidates',
    inputSchema: { problem: z.string() }
}, async ({ problem }) => {
    const p = problem.toLowerCase();
    const cand = [];
    if (/shortest|кратч|путь/.test(p))
        cand.push('dijkstra');
    if (/подстр|substring|pattern|шаблон/.test(p))
        cand.push('kmp');
    if (/компонент|соед|cluster|объедин/.test(p))
        cand.push('dsu');
    const candidates = (cand.length ? cand : ['kmp', 'dijkstra', 'dsu']).map(id => {
        const t = getTemplate(id);
        return { name: t.name, idea: t.description, complexity: t.complexity, when_to_use: 'see description', templateId: t.id };
    });
    return { content: [], problem, candidates, summary: 'Candidates ready', next_steps: ['generate_template', 'research_solutions'] };
});
server.registerTool('generate_template', {
    description: 'Return solution skeleton',
    inputSchema: { templateId: z.string() }
}, async ({ templateId }) => {
    const t = getTemplate(templateId);
    if (!t)
        throw new Error('Unknown template');
    return { content: [], summary: `Template ${t.name}`, code: t.templateTS, details: t.description, next_steps: ['Fill solve()', 'Add tests'] };
});
server.registerTool('analyze_code', {
    description: 'Static analysis',
    inputSchema: { code: z.string() }
}, async ({ code }) => {
    const complexity = guessComplexity(code);
    const issues = spotAntiPatterns(code);
    return { content: [], summary: 'Analysis done', complexityGuess: complexity, issues, hotspots: [], next_steps: ['Choose algorithm', 'Refactor', 'Add tests/bench'] };
});
server.registerTool('verify_complexity', {
    description: 'Empirical complexity check',
    inputSchema: { code: z.string(), entry: z.string(), ns: z.array(z.number()) }
}, async ({ code, entry, ns }) => {
    const gen = (n) => [Array.from({ length: n }, (_, i) => n - i)];
    const pts = timeit(code, entry, gen, ns);
    const fit = fitAsymptotics(pts);
    return { content: [], summary: 'Bench done', details: { points: pts, fit }, next_steps: ['Compare to theory'] };
});
server.registerTool('research_solutions', {
    description: 'Search registries (GitHub/npm/PyPI)',
    inputSchema: { query: z.string(), ecosystems: z.array(z.string()).optional() }
}, async ({ query, ecosystems = ['github', 'npm', 'pypi'] }) => {
    const res = await searchRegistries({ query, ecosystems });
    return { content: [], summary: `Found ${res.total}`, details: res.items, next_steps: ['audit_library'] };
});
server.registerTool('cve_check', {
    description: 'OSV vulnerability check',
    inputSchema: { ecosystem: z.string(), name: z.string(), version: z.string() }
}, async ({ ecosystem, name, version }) => {
    const res = await osvQuery({ ecosystem, name, version });
    const fixes = res.vulns?.flatMap((v) => v.affected?.flatMap((a) => a.ranges?.flatMap((r) => (r.events || []).map((e) => e.fixed).filter(Boolean)))) || [];
    return { content: [], summary: res.vulns?.length ? 'VULNS FOUND' : 'Clean', details: { vulns: res.vulns, safe_versions: fixes }, next_steps: res.vulns?.length ? ['Update or replace'] : ['OK'] };
});
server.registerTool('deps_graph', {
    description: 'Transitive deps graph',
    inputSchema: { ecosystem: z.string(), name: z.string(), version: z.string(), maxDepth: z.number().optional() }
}, async ({ ecosystem, name, version, maxDepth = 3 }) => {
    if (ecosystem === 'npm') {
        const g = await npmDepsGraph(name, version, maxDepth);
        return { content: [], summary: `Nodes: ${g.count}`, details: g, next_steps: g.count > 150 ? ['Too heavy deps → reconsider'] : ['OK'] };
    }
    if (ecosystem === 'PyPI') {
        const r = await pypiRequires(name, version);
        return { content: [], summary: `requires_dist: ${r.requires.length}`, details: r, next_steps: r.requires.length > 50 ? ['Too heavy deps'] : ['OK'] };
    }
    return { content: [], summary: 'Unsupported ecosystem', details: {}, next_steps: [] };
});
server.registerTool('suggest_safe_version', {
    description: 'Recommend OSV-clean version',
    inputSchema: { ecosystem: z.string(), name: z.string() }
}, async ({ ecosystem, name }) => {
    const res = await suggestSafeVersion(ecosystem, name);
    return { content: [], summary: res.version ? `Use ${res.version}` : 'No safe version found', details: res, next_steps: res.version ? ['Test and update'] : ['Pick alternative or implement'] };
});
server.registerTool('trust_score', {
    description: 'Compute TrustScore',
    inputSchema: {
        source: z.enum(['github', 'npm', 'pypi']),
        stars: z.number().optional(),
        daysSinceUpdate: z.number().optional(),
        issues: z.number().optional(),
        license: z.string().optional(),
        cveCount: z.number().optional(),
        deps: z.number().optional()
    }
}, async (inp) => {
    const score = trustScore(inp);
    return { content: [], summary: `TrustScore=${score}`, details: { score, factors: inp }, next_steps: score < 60 ? ['Avoid'] : ['OK'] };
});
const transport = new StdioServerTransport();
await server.connect(transport);
