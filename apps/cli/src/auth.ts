import { parseArgs } from "node:util";
import { spawn } from "node:child_process";
import * as p from "@clack/prompts";
import {
  runAuthFlow,
  scopesFor,
  logout as googleLogout,
  isLoggedIn as googleLoggedIn,
  ALL_SERVICES,
  type GoogleService,
} from "@edu-agent-kit/google-shared";
import { CredentialStore, openBrowser } from "@edu-agent-kit/mcp-shared";

const store = new CredentialStore();

/** API-key services: opening these pages helps the teacher grab a key fast. */
const KEY_PAGES: Record<string, { url: string; field: string; label: string }> = {
  padlet: { url: "https://padlet.com/dashboard/settings/developers", field: "apiKey", label: "Padlet API key" },
  kahoot: {
    url: "https://support.kahoot.com/hc/en-us/articles/11735948502931-Guide-to-Kahoot-reports-API",
    field: "apiKey",
    label: "Kahoot Reports API key (EDU/enterprise)",
  },
};

function runPassthrough(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: "inherit" });
    child.on("close", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

/** `auth login [service]` — default service is google. */
export async function runAuthLogin(args: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args,
    options: { services: { type: "string" } },
    allowPositionals: true,
  });
  const service = (positionals[0] ?? "google").toLowerCase();

  if (service === "google") {
    const services = (values.services
      ? values.services.split(",").map((s) => s.trim())
      : ALL_SERVICES) as GoogleService[];
    await runAuthFlow(scopesFor(...services));
    return;
  }

  if (service in KEY_PAGES) {
    const { url, field, label } = KEY_PAGES[service];
    process.stdout.write(`\nOpening ${service} key page… (${url})\n`);
    openBrowser(url);
    const key = await p.text({ message: `貼上你的 ${label}：`, placeholder: "paste here" });
    if (p.isCancel(key) || !String(key).trim()) {
      process.stdout.write("已取消。\n");
      return;
    }
    await store.set(service, { [field]: String(key).trim() });
    process.stdout.write(`✅ ${service} 憑證已保存（${field}）。\n`);
    return;
  }

  if (service === "firebase") {
    process.stdout.write("\n執行 `npx firebase-tools login:ci`，登入後會印出一組 token…\n");
    process.stdout.write("登入完成後，把印出的 token 貼回這裡。\n\n");
    openBrowser("https://console.firebase.google.com/");
    const token = await p.text({ message: "貼上 Firebase CI token：" });
    if (p.isCancel(token) || !String(token).trim()) {
      process.stdout.write("已取消。\n");
      return;
    }
    await store.set("firebase", { token: String(token).trim() });
    process.stdout.write("✅ Firebase token 已保存。也可另設 FIREBASE_PROJECT。\n");
    return;
  }

  if (service === "vercel") {
    process.stdout.write("\n啟動 `npx vercel login`（互動）…\n");
    const code = await runPassthrough("npx", ["--yes", "vercel", "login"]);
    process.stdout.write(code === 0 ? "✅ Vercel 已登入。\n" : "⚠️ Vercel 登入未完成。\n");
    return;
  }

  process.stdout.write(
    `未知服務 '${service}'。可用：google、padlet、kahoot、firebase、vercel。\n`,
  );
}

/** `auth logout [service]` — default service is google. */
export async function runAuthLogout(args: string[]): Promise<void> {
  const service = (args[0] ?? "google").toLowerCase();
  if (service === "google") {
    const removed = await googleLogout();
    process.stdout.write(removed ? "✅ 已登出 Google（已刪除 token）。\n" : "（沒有已存的 Google token）\n");
    return;
  }
  if (service === "vercel") {
    await runPassthrough("npx", ["--yes", "vercel", "logout"]);
    return;
  }
  const removed = await store.delete(service);
  process.stdout.write(removed ? `✅ 已移除 ${service} 憑證。\n` : `（沒有已存的 ${service} 憑證）\n`);
}

export async function runAuthStatus(): Promise<void> {
  const lines: string[] = ["憑證狀態 / Credential status", ""];
  const googleOk = await googleLoggedIn();
  lines.push(`Google 登入：${googleOk ? "✅ 已登入（一勞永逸，除非 auth logout）" : "— 未登入，執行：edu-agent-kit auth login"}`);

  const stored = await store.list();
  const services = ["padlet", "kahoot", "firebase", "vercel"];
  lines.push("", "第三方服務：");
  for (const s of services) {
    const inEnv =
      (s === "padlet" && process.env.PADLET_API_KEY) ||
      (s === "kahoot" && process.env.KAHOOT_API_KEY) ||
      (s === "firebase" && process.env.FIREBASE_TOKEN);
    const inStore = stored.includes(s);
    lines.push(`  ${inEnv || inStore ? "✅" : "—"} ${s}${inEnv ? "（env）" : inStore ? "（已登入）" : ""}`);
  }
  lines.push("", "登入：edu-agent-kit auth login <service>　登出：edu-agent-kit auth logout <service>");
  process.stdout.write(lines.join("\n") + "\n");
}

/** Back-compat alias: `auth google` == `auth login google`. */
export async function runAuthGoogle(args: string[]): Promise<void> {
  await runAuthLogin(["google", ...args]);
}
