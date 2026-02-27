# opencode-plugin-sema

Semantic code search plugin for OpenCode.

## Installation

Add to your `opencode.json`:

```json
{
  "plugin": ["@jrc2139/opencode-plugin-sema"]
}
```

The plugin is automatically installed from npm when OpenCode starts.

## Prerequisites

The `sema` binary must be installed (version 0.2.0 or later):

```bash
curl -fsSL https://sema.sh/install.sh | sh
```

That's it! Sema automatically builds the index on first search. No manual indexing required.

## Usage

The plugin provides multiple tools that can be invoked by the LLM:

### Semantic Search

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
sema --exclude "**/tests/*" "main function"
```

### Code Intelligence

These commands require a previously built index (built automatically on first search):

```
Use sema_find to locate the HttpClient class definition
Use sema_refs to show all calls to parseConfig
Use sema_query to find all exported functions with complexity > 10
```

Terminal usage:

```bash
# Find symbol definitions
sema find parseConfig
sema find HttpClient --kind class
sema find parse --prefix  # finds parseConfig, parseArgs, etc.
sema find doWork --exported  # only exported symbols

# Find symbol references
sema refs parseConfig
sema refs HttpClient

# Structural queries
sema query --kind function --min-complexity 10
sema query --kind class --language python
sema query --parent HttpClient  # methods of HttpClient
sema query --role declaration --exported
```

## How It Works

1. **Auto-Index**: First search automatically indexes the codebase (no manual `sema index` needed)
2. **Keyword Search**: Fast, instant FTS-only index with no model loading (~5ms)
3. **Hybrid Search**: Shows keyword results immediately while building semantic index in background
4. **Server**: Runs in background for ~50ms response time, 30-minute idle timeout
5. **Plugin Load**: Starts `sema serve` if needed, reuses existing server

## Tool Parameters

### sema (Semantic Search)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Natural language query |
| `path` | string | No | Directory to search |
| `n` | number | No | Max results (default: 5) |
| `lang` | string | No | Filter by language |
| `glob` | string | No | Filter by file path glob (e.g., "src/**/*.ts") |
| `exclude` | string | No | Exclude files matching glob pattern (e.g., "**/tests/*") |
| `keyword` | boolean | No | Use BM25 text search (no model loading) |

### sema_find (Find Symbol Definitions)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Symbol name to find |
| `kind` | string | No | Filter by kind (function, class, struct, enum, variable) |
| `exported` | boolean | No | Only show exported symbols |
| `prefix` | boolean | No | Treat symbol as prefix |

### sema_refs (Find Symbol References)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | Yes | Symbol name to find references for |

### sema_query (Structural Code Query)

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kind` | string | No | Filter by kind (function, class, struct, etc.) |
| `exported` | boolean | No | Only show exported symbols |
| `min_complexity` | number | No | Minimum cyclomatic complexity |
| `max_complexity` | number | No | Maximum cyclomatic complexity |
| `role` | string | No | Semantic role (declaration, reference, definition, call) |
| `parent` | string | No | Parent symbol name |
| `language` | string | No | Filter by language |

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
    "respect_ignore": false,
    "db": {
        "mode": "hybrid",
        "chunker": "ast"
    }
}
```

## Configuration

Optional settings in `.sema/config.json`:

- **`db.mode`**: `"hybrid"` (default, semantic + keyword) or `"keyword"` (FTS only, fast)
- **`db.chunker`**: `"ast"` (default, AST-based code splitting) or `"raw"` (line-based)
- **`respect_ignore`**: `true` (default, respects .gitignore) or `false` (index everything)

## License

[Apache-2.0](./LICENSE)
