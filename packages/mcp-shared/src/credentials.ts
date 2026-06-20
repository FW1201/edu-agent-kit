import { promises as fs } from "node:fs";
import path from "node:path";

/** Where the unified credential store lives (gitignored). */
export function credentialStorePath(): string {
  const base = process.env.EAK_TOKENS_DIR ?? `${process.cwd()}/.tokens`;
  return path.join(base, "credentials.json");
}

/** A single service's stored credential (shape varies per service). */
export type ServiceCredential = Record<string, string>;

type Store = Record<string, ServiceCredential>;

/**
 * Unified, file-backed credential store for third-party services (Padlet,
 * Kahoot, Firebase, Vercel, …). Lets `auth login <service>` persist keys/tokens
 * so adapters resolve them without the user hand-editing .env.
 * Resolution order in adapters: process.env first, then this store.
 */
export class CredentialStore {
  constructor(private readonly path: string = credentialStorePath()) {}

  private async readAll(): Promise<Store> {
    try {
      return JSON.parse(await fs.readFile(this.path, "utf8")) as Store;
    } catch {
      return {};
    }
  }

  async get(service: string): Promise<ServiceCredential | undefined> {
    return (await this.readAll())[service];
  }

  /** Get a single field for a service (store only). */
  async getField(service: string, field: string): Promise<string | undefined> {
    return (await this.get(service))?.[field];
  }

  async set(service: string, cred: ServiceCredential): Promise<void> {
    const all = await this.readAll();
    all[service] = { ...all[service], ...cred };
    await fs.mkdir(path.dirname(this.path), { recursive: true });
    await fs.writeFile(this.path, JSON.stringify(all, null, 2), "utf8");
  }

  async delete(service: string): Promise<boolean> {
    const all = await this.readAll();
    if (!(service in all)) return false;
    delete all[service];
    await fs.writeFile(this.path, JSON.stringify(all, null, 2), "utf8");
    return true;
  }

  async list(): Promise<string[]> {
    return Object.keys(await this.readAll());
  }
}

/**
 * Resolve a credential value: environment variable wins, then the credential
 * store. Returns undefined if neither has it.
 */
export async function resolveCredential(
  envVar: string,
  service: string,
  field: string,
  store: CredentialStore = new CredentialStore(),
): Promise<string | undefined> {
  const fromEnv = process.env[envVar];
  if (fromEnv && fromEnv.trim()) return fromEnv;
  return store.getField(service, field);
}
