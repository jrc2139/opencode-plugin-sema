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
    },
  }
}
