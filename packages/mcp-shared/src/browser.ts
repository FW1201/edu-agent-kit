import { spawn } from "node:child_process";

/**
 * Best-effort cross-platform "open this URL in the default browser".
 * Never throws — if it fails, the caller should still print the URL so the
 * user can open it manually.
 */
export function openBrowser(url: string): void {
  try {
    const platform = process.platform;
    const cmd =
      platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
    const args = platform === "win32" ? ["/c", "start", "", url] : [url];
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* ignore — caller prints the URL as fallback */
    });
    child.unref();
  } catch {
    /* ignore */
  }
}
