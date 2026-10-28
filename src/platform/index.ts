// ─────────────────────────────────────────────────────────────
// Platform seam: browser beta today, Tauri 2 desktop shell tomorrow.
// Only this file should know which one we're in.
// ─────────────────────────────────────────────────────────────

import { TauriOpenAiTransport, UnavailableOpenAiTransport, type OpenAiTransport } from '../runtime/providers/openai/transport';
import { TauriOllamaTransport, UnavailableOllamaTransport, type OllamaTransport } from '../runtime/providers/ollama/transport';
import { TauriCodexModels, UnavailableCodexModels, type CodexModelSource } from '../runtime/providers/codex/models';
import { TauriCodexLogin, UnavailableCodexLogin, type CodexLoginTransport } from '../runtime/providers/codex/login';
import { TauriTelegramTransport, UnavailableTelegramTransport, type TelegramTransport } from '../runtime/telegram/transport';
import { TauriNotifyTransport, UnavailableNotifyTransport, type NotifyTransport } from '../runtime/notify/service';
import { BridgeProcessRunner, bridgeToken } from '../runtime/process/bridge';
import { TauriProcessRunner } from '../runtime/process/tauri';
import { TauriSecretStore, UnavailableSecretStore, type SecretStore } from '../runtime/connections/secrets';
import { TauriOpenRouterTransport, UnavailableOpenRouterTransport, type OpenRouterTransport } from '../runtime/providers/openrouter/transport';
import { UnavailableProcessRunner, type ProcessRunner } from '../runtime/process/types';
import { TauriToolHost, UnavailableToolHost, type NativeToolHost } from '../runtime/tools/native';
import { TauriMcpHost, UnavailableMcpHost, type McpTransportHost } from '../runtime/mcp/transport';
import { TauriBridgeTransport, UnavailableBridgeTransport, type BridgeTransport } from '../runtime/mcp/bridge';
import { MemorySkillStore, TauriSkillStore, type SkillStore } from '../runtime/skills/store';
import { TauriWebTransport, UnavailableWebTransport, type WebTransport } from '../runtime/web/service';
import { TauriClaudeLogin, UnavailableClaudeLogin, type ClaudeLoginTransport } from '../runtime/providers/claude-code/login';
import { TauriAnthropicTransport, UnavailableAnthropicTransport, type AnthropicTransport } from '../runtime/providers/anthropic/transport';
import { MemoryFileStore, TauriFileStore, type FileStore } from '../runtime/files/store';

declare global {
  interface Window {
    __TAURI_INTERNALS__?: unknown;
  }
}

export const isDesktop = () => typeof window !== 'undefined' && !!window.__TAURI_INTERNALS__;

/**
 * Quit the app. In Tauri the main window is closed like with its X, which ends
 * RealmNest (src-tauri/src/lib.rs); `window.close()` there only tore the page
 * down and left an empty white window. In the browser we can only try to close
 * the tab and otherwise tell the caller it didn't work.
 */
export async function exitApp(): Promise<boolean> {
  if (isDesktop()) {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    await getCurrentWindow().close();
    return true;
  }
  window.close();
  return false;
}

/**
 * How this build starts local programs (CLI providers such as Claude Code).
 * Decided once, here. Desktop: the native Rust host, also under `tauri dev`
 * where the page is served by Vite. Browser on the dev server: the Vite
 * process bridge. Plain browser build: none.
 */
export function processRunner(): ProcessRunner {
  if (isDesktop()) return new TauriProcessRunner();
  const token = bridgeToken();
  if (token) return new BridgeProcessRunner(token);
  return new UnavailableProcessRunner('This browser build cannot start local programs: run RealmNest with `npm run dev` or the desktop app.');
}

/** which process host this build uses (shown in the debug panel) */
export function processHostName(): string {
  return isDesktop() ? 'desktop (native)' : bridgeToken() ? 'dev bridge (Node)' : 'none';
}

/**
 * Where connection secrets go. Desktop: the OS credential store (write-only
 * from the webview). Browser builds: none, and nothing insecure instead.
 */
export function secretStore(): SecretStore {
  return isDesktop() ? new TauriSecretStore() : new UnavailableSecretStore();
}

/** The Telegram bridge runs in the native host (the bot token never enters the page); none in browser builds. */
export function telegramTransport(): TelegramTransport {
  return isDesktop() ? new TauriTelegramTransport() : new UnavailableTelegramTransport();
}

/** Windows notifications are shown by the native host; none in browser builds. */
export function notifyTransport(): NotifyTransport {
  return isDesktop() ? new TauriNotifyTransport() : new UnavailableNotifyTransport();
}

/** The OpenAI API and the local Ollama run in the native host (the OpenAI key never enters the page). */
export function openAiTransport(): OpenAiTransport {
  return isDesktop() ? new TauriOpenAiTransport() : new UnavailableOpenAiTransport();
}
export function ollamaTransport(): OllamaTransport {
  return isDesktop() ? new TauriOllamaTransport() : new UnavailableOllamaTransport();
}
/** ChatGPT via the Codex CLI: the account's model list (a narrow native read) and the sign-in. */
export function codexModels(): CodexModelSource {
  return isDesktop() ? new TauriCodexModels() : new UnavailableCodexModels();
}
export function codexLogin(): CodexLoginTransport {
  return isDesktop() ? new TauriCodexLogin() : new UnavailableCodexLogin();
}

/** OpenRouter runs in the native host (the API key never enters the page); none in browser builds. */
export function openRouterTransport(): OpenRouterTransport {
  return isDesktop() ? new TauriOpenRouterTransport() : new UnavailableOpenRouterTransport();
}

/** the native side of the file tools (desktop app only) */
export function toolHost(): NativeToolHost {
  return isDesktop() ? new TauriToolHost() : new UnavailableToolHost();
}

/** Where MCP server processes run: the native host (desktop only; the browser cannot start programs). */
export function mcpHost(): McpTransportHost {
  return isDesktop() ? new TauriMcpHost() : new UnavailableMcpHost();
}

/** Where Skill packages are kept: RealmNest's own folder (desktop); none in the browser (instructions still work). */
export function skillStore(): SkillStore {
  return isDesktop() ? new TauriSkillStore() : new MemorySkillStore(false);
}

/** Where attachment and artifact bytes live (docs/FILES.md). Desktop: RealmNest's data folder; browser: memory. */
export function fileStore(): FileStore {
  return isDesktop() ? new TauriFileStore() : new MemoryFileStore();
}

/** The RealmNest MCP bridge for Claude Code (desktop only: Rust relays Claude's MCP connection to the page). */
export function mcpBridgeTransport(): BridgeTransport {
  return isDesktop() ? new TauriBridgeTransport() : new UnavailableBridgeTransport();
}

/** The web layer's network (docs/WEB.md): Rust in the desktop app (SSRF-safe GET, hidden page reader); none in the browser beta. */
export function webTransport(): WebTransport {
  return isDesktop() ? new TauriWebTransport() : new UnavailableWebTransport();
}

/** Claude account sign-in through Claude Code (desktop); a terminal hint in the browser beta. */
export function claudeLogin(): ClaudeLoginTransport {
  return isDesktop() ? new TauriClaudeLogin() : new UnavailableClaudeLogin();
}

/** The Anthropic API runs in the native host (the key never enters the page); none in browser builds. */
export function anthropicTransport(): AnthropicTransport {
  return isDesktop() ? new TauriAnthropicTransport() : new UnavailableAnthropicTransport();
}
