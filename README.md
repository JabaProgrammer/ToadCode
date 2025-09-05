# ToadCode MCP Server

ToadCode is a strict algorithmic MCP server meant for use with Cursor IDE. It helps clarify prompts, research libraries, audit dependencies via OSV, and verify algorithmic complexity.

## Features
- Prompt gap detection and clarification questions
- Algorithm proposals and code templates (Dijkstra, KMP, DSU, ...)
- Static analysis of user code
- Benchmarks and empirical complexity fitting
- Registry search (GitHub, npm, PyPI)
- CVE checks through OSV.dev
- Transitive dependency graphs for npm/PyPI
- Safe version suggestions and TrustScore computation
- Sandboxed user code execution via isolated-vm

## Requirements
- Node.js 18+
- `npm install` for dependencies
- Optional: `GITHUB_TOKEN` environment variable for higher GitHub API limits
- Native build tools required for `isolated-vm` (make, g++)

## Build
```bash
npm install
npm run build
```

## Development
```bash
npm run dev
```

## Lint
```bash
npm run lint
```

## Using with Cursor
The repository already includes `.cursorrules` and `cursor.json`. After building, Cursor can launch the server via:
```json
{
  "mcpServers": {
    "toadcode": {
      "command": "node",
      "args": ["dist/server.js"],
      "env": { "GITHUB_TOKEN": "${env:GITHUB_TOKEN}" }
    }
  }
}
```

Run `node dist/server.js` to start the MCP server manually.
