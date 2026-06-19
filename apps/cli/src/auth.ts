import { parseArgs } from "node:util";
import { promises as fs } from "node:fs";
import {
  runAuthFlow,
  scopesFor,
  tokenStorePath,
  ALL_SERVICES,
  type GoogleService,
} from "@edu-agent-kit/google-shared";

export async function runAuthGoogle(args: string[]): Promise<void> {
  const { values } = parseArgs({
    args,
    options: { services: { type: "string" } },
    allowPositionals: true,
  });
  const services = (values.services
    ? values.services.split(",").map((s) => s.trim())
    : ALL_SERVICES) as GoogleService[];
  await runAuthFlow(scopesFor(...services));
}

export async function runAuthStatus(): Promise<void> {
  const path = tokenStorePath();
  const hasToken = await fs.access(path).then(
    () => true,
    () => false,
  );
  const lines: string[] = [];
  lines.push(`Google token: ${hasToken ? `found (${path})` : "not found — run: edu-agent-kit auth google"}`);
  const keys = [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "PADLET_API_KEY",
    "KAHOOT_API_KEY",
    "TAVILY_API_KEY",
    "FIREBASE_TOKEN",
    "FIREBASE_PROJECT",
  ];
  for (const k of keys) {
    const v = process.env[k];
    lines.push(`${k}: ${v && v.trim() ? "set" : "—"}`);
  }
  process.stdout.write(lines.join("\n") + "\n");
}
