/**
 * OpenCode Plugin for sema (semantic code search)
 * Compatible with sema version 0.1.5 and later
 */
import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { spawn, which } from "bun"
import { realpathSync } from "fs"

/**
 * Compute deterministic port for directory (matches Zig FNV-1a hash).
 */
function getPortForDir(cwd: string): number {
  let h = 0xcbf29ce484222325n
  const bytes = Buffer.from(cwd)
  for (const byte of bytes) {
    h ^= BigInt(byte)
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return 8765 + Number(h % 1000n)
}

/**
 * Check if server is responding on port.
 */
async function checkServerHealth(port: number, timeout = 500): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)
    const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: controller.signal })
    clearTimeout(timeoutId)
    return res.ok
  } catch {
    return false
  }
}

/**
 * Sleep for ms milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export const SemaPlugin: Plugin = async ({ directory }) => {
  // Resolve real path
  let realDir: string
  try {
    realDir = realpathSync(directory)
  } catch {
    realDir = directory
  }

  const port = getPortForDir(realDir)

  // Check if server already running
  if (!(await checkServerHealth(port))) {
    // Verify sema is in PATH
    const semaPath = which("sema")
    if (semaPath) {
      // Start server as detached background process
      const child = spawn(["sema", "serve"], {
        cwd: realDir,
        stdio: ["ignore", "ignore", "ignore"],
      })
      child.unref()

      // Wait for server to be ready (up to 3s)
      for (let i = 0; i < 30; i++) {
        await sleep(100)
        if (await checkServerHealth(port)) {
          break
        }
      }
    }
  }

  return {
    tool: {
      sema: tool({
        description:
          "Semantic code search. Finds code by meaning, not text matching. Use for 'where is X', 'how does Y work' queries. Use keyword=true for exact identifiers.",
        args: {
          query: tool.schema.string().describe("Natural language query describing what code to find"),
          path: tool.schema.string().optional().describe("Directory to search (default: current directory)"),
          n: tool.schema.number().optional().describe("Maximum results (default: 5)"),
          lang: tool.schema.string().optional().describe("Filter by language (python, javascript, zig, etc.)"),
          glob: tool.schema.string().optional().describe("Filter by file path glob (e.g., 'src/**/*.ts')"),
          exclude: tool.schema.string().optional().describe("Exclude files matching glob pattern (e.g., '**/tests/*')"),
          keyword: tool.schema.boolean().optional().describe("Use BM25 text search instead of semantic (faster, no model)"),
        },
        async execute(args) {
          const cmd = ["sema"]
          if (args.keyword) cmd.push("-k")
          cmd.push(args.query)
          if (args.path) cmd.push(args.path)
          if (args.n) cmd.push("-n", String(args.n))
          if (args.lang) cmd.push("-l", args.lang)
          if (args.glob) cmd.push("-g", args.glob)
          if (args.exclude) cmd.push("--exclude", args.exclude)

          const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe" })
          const output = await new Response(proc.stdout).text()
          const exitCode = await proc.exited

          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            return `Error: ${stderr || "sema command failed"}`
          }
          return output
        },
      }),
      sema_find: tool({
        description:
          "Find symbol definitions in the codebase. Searches for function, class, struct, enum, or variable definitions. Requires a previously built index.",
        args: {
          symbol: tool.schema.string().describe("Symbol name to find (e.g., 'parseConfig', 'HttpClient')"),
          kind: tool.schema.string().optional().describe("Filter by symbol kind (function, class, struct, enum, variable, etc.)"),
          exported: tool.schema.boolean().optional().describe("Only show exported symbols"),
          prefix: tool.schema.boolean().optional().describe("Treat symbol as prefix (e.g., 'parse' finds 'parseConfig', 'parseArgs')"),
        },
        async execute(args) {
          const cmd = ["sema", "find", args.symbol]
          if (args.kind) cmd.push("--kind", args.kind)
          if (args.exported) cmd.push("--exported")
          if (args.prefix) cmd.push("--prefix")

          const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe", cwd: realDir })
          const output = await new Response(proc.stdout).text()
          const exitCode = await proc.exited

          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            return `Error: ${stderr || "sema find command failed"}`
          }
          return output
        },
      }),
      sema_refs: tool({
        description:
          "Find all references to a symbol in the codebase. Shows where a function, class, or variable is used. Requires a previously built index.",
        args: {
          symbol: tool.schema.string().describe("Symbol name to find references for (e.g., 'parseConfig', 'HttpClient')"),
        },
        async execute(args) {
          const cmd = ["sema", "refs", args.symbol]

          const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe", cwd: realDir })
          const output = await new Response(proc.stdout).text()
          const exitCode = await proc.exited

          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            return `Error: ${stderr || "sema refs command failed"}`
          }
          return output
        },
      }),
      sema_query: tool({
        description:
          "Structural code query with filters. Find code by kind, complexity, role, parent, or language. Requires a previously built index.",
        args: {
          kind: tool.schema.string().optional().describe("Filter by symbol kind (function, class, struct, enum, variable, etc.)"),
          exported: tool.schema.boolean().optional().describe("Only show exported symbols"),
          min_complexity: tool.schema.number().optional().describe("Minimum cyclomatic complexity"),
          max_complexity: tool.schema.number().optional().describe("Maximum cyclomatic complexity"),
          role: tool.schema.string().optional().describe("Filter by semantic role (declaration, reference, definition, call)"),
          parent: tool.schema.string().optional().describe("Filter by parent symbol name"),
          language: tool.schema.string().optional().describe("Filter by language (python, javascript, zig, etc.)"),
        },
        async execute(args) {
          const cmd = ["sema", "query"]
          if (args.kind) cmd.push("--kind", args.kind)
          if (args.exported) cmd.push("--exported")
          if (args.min_complexity !== undefined) cmd.push("--min-complexity", String(args.min_complexity))
          if (args.max_complexity !== undefined) cmd.push("--max-complexity", String(args.max_complexity))
          if (args.role) cmd.push("--role", args.role)
          if (args.parent) cmd.push("--parent", args.parent)
          if (args.language) cmd.push("--language", args.language)

          const proc = spawn(cmd, { stdout: "pipe", stderr: "pipe", cwd: realDir })
          const output = await new Response(proc.stdout).text()
          const exitCode = await proc.exited

          if (exitCode !== 0) {
            const stderr = await new Response(proc.stderr).text()
            return `Error: ${stderr || "sema query command failed"}`
          }
          return output
        },
      }),
    },
  }
}
