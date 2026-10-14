import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Store logs directly in repository root as pumble.log (matching .gitignore)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const LOG_FILE = process.env.PUMBLE_LOG_FILE || path.join(REPO_ROOT, "pumble.log");

export function logStderr(message: string, ...args: any[]) {
  const logEntry = `[pumble-mcp] ${new Date().toISOString()} ${message} ${args.length ? JSON.stringify(args) : ""}\n`;
  if (process.env.NODE_ENV !== "test") {
    process.stderr.write(logEntry);
  }

  // Write to repository log file unless running in test mode or explicitly disabled
  if (process.env.NODE_ENV !== "test" && process.env.PUMBLE_DEBUG !== "false") {
    try {
      fs.appendFileSync(LOG_FILE, logEntry);
    } catch (e) {
      // ignore
    }
  }
}
