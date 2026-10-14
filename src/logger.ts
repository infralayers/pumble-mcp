import fs from "fs";
import path from "path";
import os from "os";

// We store logs in the user's home directory (in an Antigravity folder)
// so the workspace stays clean and doesn't trigger nodemon/vitest re-runs
const LOG_DIR = path.join(os.homedir(), ".gemini", "antigravity-cli", "pumble-logs");
if (process.env.PUMBLE_DEBUG === "true") {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
const LOG_FILE = path.join(LOG_DIR, "pumble_mcp.log");

export function logStderr(message: string, ...args: any[]) {
  // KILL SWITCH: In production, just log to stderr for standard MCP debugging, but skip the file system overhead.
  const logEntry = `[pumble-mcp] ${new Date().toISOString()} ${message} ${args.length ? JSON.stringify(args) : ""}\n`;
  if (process.env.NODE_ENV !== "test") { process.stderr.write(logEntry); }

  // If we are debugging locally, write everything to a physical log file to track latency metrics
  if (process.env.PUMBLE_DEBUG === "true") {
    try {
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
      // ignore
    }
  }
}
