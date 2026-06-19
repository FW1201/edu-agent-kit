import { promises as fs } from "node:fs";
import { MissingCredentialError } from "./errors.js";

/** Read a required env var or throw an actionable MissingCredentialError. */
export function requireEnv(name: string, hint?: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new MissingCredentialError(name, hint);
  return v;
}

/** Read an optional env var. */
export function optionalEnv(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : undefined;
}

/** Whether all named env vars are present (used to enable/disable adapters). */
export function hasEnv(...names: string[]): boolean {
  return names.every((n) => {
    const v = process.env[n];
    return !!v && v.trim() !== "";
  });
}

/**
 * Minimal JSON token store for OAuth flows (Google Classroom). Path defaults
 * to GOOGLE_TOKEN_PATH or ./.tokens/google-token.json. Never commit token files.
 */
export class JsonTokenStore<T extends object> {
  constructor(private readonly path: string) {}

  async read(): Promise<T | undefined> {
    try {
      const raw = await fs.readFile(this.path, "utf8");
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async write(token: T): Promise<void> {
    const dir = this.path.replace(/\/[^/]+$/, "");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(this.path, JSON.stringify(token, null, 2), "utf8");
  }
}
