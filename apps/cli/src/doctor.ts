import { promises as fs } from "node:fs";
import { tokenStorePath } from "@edu-agent-kit/google-shared";

export async function runDoctor(): Promise<void> {
  const lines: string[] = ["edu-agent-kit doctor", ""];

  const major = Number(process.versions.node.split(".")[0]);
  lines.push(`Node.js: ${process.version} ${major >= 18 ? "✓" : "✗ (need >=18)"}`);

  const tokenPath = tokenStorePath();
  const hasToken = await fs.access(tokenPath).then(
    () => true,
    () => false,
  );
  lines.push(`Google token: ${hasToken ? "✓ found" : "— run: edu-agent-kit auth google"}`);

  const checks: [string, string][] = [
    ["GOOGLE_CLIENT_ID", "Google OAuth"],
    ["GOOGLE_CLIENT_SECRET", "Google OAuth"],
    ["PADLET_API_KEY", "Padlet"],
    ["KAHOOT_API_KEY", "Kahoot Reports"],
    ["FIREBASE_TOKEN", "Firebase deploy"],
    ["FIREBASE_PROJECT", "Firebase project"],
  ];
  lines.push("", "Credentials:");
  for (const [key, label] of checks) {
    const set = Boolean(process.env[key] && process.env[key]!.trim());
    lines.push(`  ${set ? "✓" : "—"} ${key} (${label})`);
  }
  lines.push("", "Tip: missing credentials only disable their own tools; everything else works.");
  process.stdout.write(lines.join("\n") + "\n");
}
