// ─────────────────────────────────────────────────────────────
// AI connections: how RealmNest reaches a provider with one account or endpoint.
//
//   Provider (e.g. Claude Code, OpenAI)       what kind of backend; an adapter
//      └─ AIConnection ("Alex Claude")        one account / key / endpoint, many per provider
//            ├─ models (preferred, catalogue when the provider can list them)
//            └─ capabilities snapshot          what RealmNest can use through it right now
//
// Chat and agents reference a connection, never a provider directly.
// Secrets (API keys, tokens) are not part of this record: they live in the OS
// credential store and are referenced by name (docs/CONNECTIONS.md).
// ─────────────────────────────────────────────────────────────

import type { CapabilitySet } from './capability';

export type ConnectionMethodId = 'subscription' | 'oauth' | 'cli-session' | 'api-key' | 'local-endpoint' | 'remote-endpoint';

export type ConnectionStatus =
  /** not validated since RealmNest started (persisted states are never trusted) */
  | 'unknown'
  | 'checking'
  | 'connected'
  /** removed (or turned off) by the user */
  | 'disconnected'
  | 'auth_required'
  | 'invalid_credentials'
  /** the backend cannot be reached (not installed, offline, no host) */
  | 'unavailable'
  | 'error';

export interface AIConnection {
  id: string;
  /** a ProviderDefinition id from the catalogue, e.g. 'claude-code' */
  providerId: string;
  /** chosen by the user, e.g. "Alex Claude" */
  name: string;
  method: ConnectionMethodId;
  /** non-secret settings declared by the provider's method (e.g. a config folder, an endpoint URL) */
  config: Record<string, string>;
  /** names of secrets kept in the OS credential store for this connection (never the values) */
  secretNames: string[];
  preferredModel?: string;
  /** when the provider can list models: how many, and when (the list itself is cached separately) */
  modelCatalog?: { count: number; fetchedAt: number };
  /** connection-level capabilities with provenance (docs/CAPABILITIES.md); set by a successful check */
  capabilities?: CapabilitySet;
  status: ConnectionStatus;
  statusMessage?: string;
  statusHint?: string;
  /** e.g. "Claude account · max" (no e-mail addresses) */
  account?: string;
  version?: string;
  checkedAt?: number;
  createdAt: number;
  updatedAt: number;
  /** soft-deleted: kept so history can still name it, never used again */
  removedAt?: number;
}

/** What may leave the app (logs, exports, events): never secrets, never config paths. */
export interface ConnectionSummary {
  id: string;
  providerId: string;
  name: string;
  status: ConnectionStatus;
  capabilities?: CapabilitySet;
}

export const summarize = (c: AIConnection): ConnectionSummary => ({ id: c.id, providerId: c.providerId, name: c.name, status: c.status, ...(c.capabilities && { capabilities: c.capabilities }) });
