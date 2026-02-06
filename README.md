# opencode-plugin-sema

Semantic code search plugin for OpenCode.

## Installation

```bash
# From npm
npm install -g @jrc2139/opencode-plugin-sema

# Or via OpenCode
opencode plugins install @jrc2139/opencode-plugin-sema
```

## Prerequisites

The `sema` binary must be installed (version 0.1.5 or later):

```bash
curl -fsSL https://sema.sh/install.sh | sh
```

## Usage

The plugin provides a `sema` tool that can be invoked by the LLM:

```
Use sema to find where authentication is handled
```

Or run sema directly in the terminal:

```bash
# Hybrid search (default) - best for natural language questions
sema "where is authentication handled?"
sema "error handling patterns" -l python

# Keyword search (-k) - fast, no model loading, good for identifiers
sema -k "parseArgs"
sema -k "ConfigLoader"

# Search within a directory
sema "API endpoints" src/
sema "database queries" ./backend/

# With filters
sema "error handling" -l zig -n 10
sema -g "src/**/*.ts" "authentication"
```

## How It Works

1. **Plugin Load**: Starts `sema serve` in the background
2. **Search**: Queries are sent to the server for instant results (~50ms)
3. **Shutdown**: Server is stopped when the session ends

## Tool Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query |
| `path` | string | No | Directory to search |
| `n` | number | No | Max results (default: 5) |
| `lang` | string | No | Filter by language |
| `glob` | string | No | Filter by file path glob (e.g., "src/**/*.ts") |
| `keyword` | boolean | No | Use BM25 text search (no model loading) |

## Search Modes

| Mode | Flag | Best For | Speed |
|------|------|----------|-------|
| Hybrid | (default) | Natural language questions | ~50ms |
| Keyword | `-k` | Exact identifiers, function names | ~5ms |

## Ignore Patterns

By default, sema respects `.gitignore` files. You can also use `.semaignore` files for sema-specific exclusions (same syntax as `.gitignore`):

```bash
# .semaignore - exclude from search without affecting git
generated/
*.min.js
vendor/
build/
```

To ignore gitignore files and index everything:

```bash
sema index --no-gitignore .
```

Or in `.sema/config.json`:

```json
{
    "respect_ignore": false
}
```

## License

[Apache-2.0](./LICENSE)
