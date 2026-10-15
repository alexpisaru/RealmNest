// ─────────────────────────────────────────────────────────────
// ConnectionManager: the user's AI connections.
//
//   ProviderCatalog (what exists)  ──▶  AIConnection (what the user set up)  ──▶  adapter (AIProvider)
//
// - one adapter per connection, so two accounts of one provider never share state
// - status only from real validation (adapter.getStatus); persisted states are
//   never trusted: every connection starts 'unknown' and is checked at startup
// - secrets go to the SecretStore (OS credential store), never into this record
// - deleting keeps the record (removedAt) so history can still name it
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import { summarize, type AIConnection, type ConnectionMethodId, type ConnectionStatus } from '../../domain/connection';
import type { StorageAdapter } from '../../persistence/storage';
import type { ProcessRunner } from '../process/types';
import type { AIProvider, ModelInfo, ProviderState, ProviderStatus, ProviderTurnRequest } from '../providers/types';
import { baseCapabilities, type ProviderCatalog } from './catalog';
import { secretName, type SecretStore } from './secrets';

const KEY = 'connections';
const CATALOG_KEY = 'model-catalogs';
export const CONNECTIONS_SCHEMA = 1;
/** a model catalogue older than this is refreshed after the next successful check */
export const MODEL_CATALOG_TTL_MS = 24 * 60 * 60_000;

/** bump when the normalized model shape changes: older caches are refetched (3: reasoning effort levels) */
export const CATALOG_SCHEMA = 3;

interface CachedCatalog {
  fetchedAt: number;
  models: ModelInfo[];
  schema?: number;
}

interface ConnectionsSnapshot {
  version: number;
  /** the default Claude connection was created once (not again after the user deletes it) */
  seeded: boolean;
  connections: AIConnection[];
}

export class ConnectionError extends Error {}

const STATE_TO_STATUS: Record<ProviderState, ConnectionStatus> = {
  available: 'connected',
  not_authenticated: 'auth_required',
  invalid_credentials: 'invalid_credentials',
  not_installed: 'unavailable',
  unavailable: 'unavailable',
  error: 'error',
};

export interface NewConnection {
  providerId: string;
  method: ConnectionMethodId;
  name: string;
  /** values for the method's fields; secret fields go to the SecretStore */
  values?: Record<string, string>;
}

export interface ConnectionManagerOptions {
  now?: () => number;
  newId?: () => string;
  /** the provider whose existing setup becomes the first connection (migration) */
  seedProviderId?: string;
  /** a profile saved before connections existed: only then is the seed connection created (0.11.1: a new installation starts with none) */
  legacyProfile?: () => Promise<boolean>;
}

let counter = 0;
const defaultId = () => `conn-${Date.now().toString(36)}-${(++counter).toString(36)}`;

export class ConnectionManager {
  private connections = new Map<string, AIConnection>();
  private adapters = new Map<string, AIProvider>();
  /** model catalogues per connection, kept apart from the connection records (they can be large) */
  private catalogs = new Map<string, CachedCatalog>();
  private seeded = false;
  /** the saved connections could not be read: automatic saves wait for the user's first change (D-3) */
  private holdSaves = false;
  private listeners = new Set<() => void>();
  private version = 0;
  private now: () => number;
  private newId: () => string;

  constructor(
    private bus: EventBus,
    readonly catalog: ProviderCatalog,
    private storage: StorageAdapter,
    private deps: { runner: ProcessRunner; secrets: SecretStore },
    private opts: ConnectionManagerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.newId = opts.newId ?? defaultId;
  }

  /** Load connections (statuses reset to unknown); a profile from before connections existed gets the default one. */
  async init() {
    const raw = await this.storage.get<Partial<ConnectionsSnapshot>>(KEY);
    this.holdSaves = !!this.storage.isUnreadable?.(KEY);
    const cached = await this.storage.get<Record<string, CachedCatalog>>(CATALOG_KEY);
    if (cached && typeof cached === 'object') for (const [id, cat] of Object.entries(cached)) if (Array.isArray(cat?.models)) this.catalogs.set(id, cat);
    this.seeded = !!raw?.seeded;
    for (const c of Array.isArray(raw?.connections) ? raw.connections : []) {
      // a broken record is skipped, not the whole list (D-2)
      if (!c || typeof c !== 'object' || typeof c.id !== 'string' || typeof c.providerId !== 'string') continue;
      if (!Array.isArray(c.secretNames)) c.secretNames = [];
      if (!c.config || typeof c.config !== 'object') c.config = {};
      // a saved "connected" proves nothing about now; capabilities come back with the next check
      const fresh: AIConnection = { ...c, status: c.removedAt ? 'disconnected' : 'unknown' };
      // the seeded Claude connection kept the old product name: it is just "Claude" now
      if (fresh.providerId === 'claude-code' && fresh.name === 'Claude Code') fresh.name = 'Claude';
      // snapshots saved before capability descriptors existed (plain booleans) are dropped
      if (fresh.capabilities && Object.values(fresh.capabilities).some((v) => typeof v !== 'object')) delete fresh.capabilities;
      this.connections.set(c.id, fresh);
      if (!c.removedAt) this.buildAdapter(fresh);
    }
    const seed = this.opts.seedProviderId;
    if (!this.seeded && seed && this.catalog.get(seed)?.create) {
      const def = this.catalog.get(seed)!;
      // only a profile saved before connections existed migrates its sign-in; a new installation starts with no
      // connections (0.11.1), and the decision is kept so a later start does not create one either
      const legacy = await (this.opts.legacyProfile?.() ?? true);
      if (legacy && ![...this.connections.values()].some((c) => c.providerId === seed)) this.insert({ providerId: seed, method: def.methods[0].id, name: def.name, config: {}, secretNames: [] });
      this.seeded = true;
    }
    await this.save();
    this.changed();
  }

  // ── React glue ───────────────────────────────────────────
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = () => this.version;
  private changed() {
    this.version++;
    this.listeners.forEach((l) => l());
  }

  // ── reading ──────────────────────────────────────────────
  /** active connections (removed ones only on request), oldest first */
  list(opts: { includeRemoved?: boolean } = {}): AIConnection[] {
    return [...this.connections.values()].filter((c) => opts.includeRemoved || !c.removedAt).sort((a, b) => a.createdAt - b.createdAt);
  }
  get(id: string | undefined) {
    return id ? this.connections.get(id) : undefined;
  }
  /** the adapter to run on; undefined for unknown or removed connections */
  provider(id: string): AIProvider | undefined {
    return this.adapters.get(id);
  }
  /** what agents and chats use when nothing else is chosen: the first connected, else the first one */
  defaultId(): string | undefined {
    const active = this.list();
    return (active.find((c) => c.status === 'connected') ?? active[0])?.id;
  }
  /** the connection that stands for a provider id saved before connections existed */
  forLegacyProvider(providerId: string): string | undefined {
    const all = this.list({ includeRemoved: true });
    return (all.find((c) => c.providerId === providerId && !c.removedAt) ?? all.find((c) => c.providerId === providerId))?.id;
  }

  // ── changes ──────────────────────────────────────────────
  async create(input: NewConnection): Promise<AIConnection> {
    const def = this.catalog.get(input.providerId);
    if (!def?.create || def.availability !== 'available') throw new ConnectionError(`${def?.name ?? input.providerId} cannot be connected yet.`);
    const method = def.methods.find((m) => m.id === input.method);
    if (!method) throw new ConnectionError(`${def.name} does not support this connection method.`);
    const name = input.name.trim();
    if (!name) throw new ConnectionError('Give the connection a name.');
    const values = input.values ?? {};
    const config: Record<string, string> = {};
    const secrets: Record<string, string> = {};
    for (const f of method.fields) {
      const v = (values[f.key] ?? '').trim();
      if (f.required && !v) throw new ConnectionError(`${f.label} is required.`);
      if (!v) continue;
      if (f.kind === 'secret') secrets[f.key] = v;
      else config[f.key] = v;
    }
    const why = def.checkConfig?.(method.id, config);
    if (why) throw new ConnectionError(why);
    if (Object.keys(secrets).length && !this.deps.secrets.available) throw new ConnectionError('This connection needs a secret, and secure storage is only available in the RealmNest desktop app.');

    const id = this.newId();
    // secrets first: if the store refuses, nothing is half-created
    for (const [k, v] of Object.entries(secrets)) await this.deps.secrets.set(secretName(id, k), v);
    const c = this.insert({ id, providerId: def.id, method: method.id, name, config, secretNames: Object.keys(secrets).map((k) => secretName(id, k)) });
    await this.save(true);
    void this.validate(c.id);
    return c;
  }

  async update(id: string, patch: { name?: string; preferredModel?: string; config?: Record<string, string> }) {
    const c = this.require(id);
    const fields: string[] = [];
    if (patch.name !== undefined) {
      if (!patch.name.trim()) throw new ConnectionError('Give the connection a name.');
      c.name = patch.name.trim();
      fields.push('name');
    }
    if (patch.preferredModel !== undefined) {
      if (patch.preferredModel.trim()) c.preferredModel = patch.preferredModel.trim();
      else delete c.preferredModel;
      fields.push('preferredModel');
    }
    if (patch.config !== undefined) {
      const def = this.catalog.get(c.providerId);
      const config = Object.fromEntries(Object.entries(patch.config).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
      const why = def?.checkConfig?.(c.method, config);
      if (why) throw new ConnectionError(why);
      c.config = config;
      this.buildAdapter(c);
      fields.push('config');
    }
    c.updatedAt = this.now();
    this.bus.emit('connection.updated', { connectionId: id, fields });
    await this.save(true);
    this.changed();
    if (patch.config !== undefined) void this.validate(id);
  }

  /** Soft delete: the record stays for history, secrets and adapter go. */
  async remove(id: string) {
    const c = this.require(id);
    for (const n of c.secretNames) await this.deps.secrets.delete(n);
    c.secretNames = [];
    c.removedAt = this.now();
    c.updatedAt = c.removedAt;
    this.adapters.delete(id);
    this.catalogs.delete(id);
    delete c.modelCatalog;
    await this.saveCatalogs();
    this.setStatus(c, 'disconnected', 'This connection was removed.');
    this.bus.emit('connection.deleted', { connectionId: id });
    await this.save(true);
    this.changed();
  }

  // ── validation ───────────────────────────────────────────
  /** Ask the provider, for real, whether this connection works now. */
  async validate(id: string): Promise<AIConnection> {
    const c = this.require(id);
    const adapter = this.adapters.get(id);
    if (!adapter) return c;
    this.setStatus(c, 'checking');
    this.changed();
    let s: ProviderStatus;
    try {
      s = await adapter.getStatus();
    } catch (err) {
      s = { state: 'error', message: `Could not check ${c.name}.`, details: { error: String(err) }, checkedAt: this.now() };
    }
    if (c.removedAt) return c; // removed while checking
    const def = this.catalog.get(c.providerId);
    // what RealmNest can use through it: only when it works right now
    if (s.state === 'available') c.capabilities = def?.capabilities ? def.capabilities(c, adapter.capabilities) : baseCapabilities(def?.name ?? c.providerId, adapter.capabilities);
    else delete c.capabilities;
    c.version = s.version;
    c.account = accountOf(s);
    c.checkedAt = s.checkedAt;
    this.setStatus(c, STATE_TO_STATUS[s.state], s.message, s.hint);
    await this.save();
    this.changed();
    // the catalogue only after a successful check, and only when missing or old
    const cat = this.catalogs.get(id);
    if (s.state === 'available' && adapter.capabilities.modelListing && (!cat || cat.schema !== CATALOG_SCHEMA || this.now() - cat.fetchedAt > MODEL_CATALOG_TTL_MS)) {
      await this.refreshModels(id).catch(() => undefined);
    }
    return c;
  }

  /** the cached model catalogue of a connection (never proof that it works) */
  models(id: string): ModelInfo[] {
    return this.catalogs.get(id)?.models ?? [];
  }

  /** Fetch the provider's model list now. */
  async refreshModels(id: string): Promise<ModelInfo[]> {
    const c = this.require(id);
    const adapter = this.adapters.get(id);
    if (!adapter?.listModels || !adapter.capabilities.modelListing) throw new ConnectionError(`${c.name} cannot list its models.`);
    if (c.status !== 'connected') throw new ConnectionError(`Test ${c.name} first: models are listed only for a working connection.`);
    const models = await adapter.listModels();
    const fetchedAt = this.now();
    this.catalogs.set(id, { fetchedAt, models, schema: CATALOG_SCHEMA });
    c.modelCatalog = { count: models.length, fetchedAt };
    this.bus.emit('connection.updated', { connectionId: id, fields: ['models'] });
    await this.save();
    await this.saveCatalogs();
    this.changed();
    return models;
  }

  validateAll() {
    return Promise.all(this.list().map((c) => this.validate(c.id)));
  }

  // ── internals ────────────────────────────────────────────
  private insert(input: Omit<AIConnection, 'id' | 'status' | 'createdAt' | 'updatedAt'> & { id?: string }): AIConnection {
    const t = this.now();
    const c: AIConnection = { ...input, id: input.id ?? this.newId(), status: 'unknown', createdAt: t, updatedAt: t };
    this.connections.set(c.id, c);
    this.buildAdapter(c);
    this.bus.emit('connection.created', { connectionId: c.id, providerId: c.providerId, name: c.name });
    this.changed();
    return c;
  }

  private buildAdapter(c: AIConnection) {
    const def = this.catalog.get(c.providerId);
    if (def?.create) this.adapters.set(c.id, withPreferredModel(def.create(c, this.deps), () => this.connections.get(c.id)?.preferredModel));
    else this.adapters.delete(c.id);
  }

  private saveCatalogs() {
    return this.storage.set(CATALOG_KEY, Object.fromEntries(this.catalogs));
  }

  private setStatus(c: AIConnection, to: ConnectionStatus, message?: string, hint?: string) {
    const from = c.status;
    c.status = to;
    if (message !== undefined) c.statusMessage = message;
    if (to !== 'checking') {
      if (hint) c.statusHint = hint;
      else delete c.statusHint;
    }
    if (from === to) return;
    this.bus.emit('connection.status.changed', { connectionId: c.id, from, to });
    if (to === 'connected') this.bus.emit('connection.connected', { connectionId: c.id });
    if (from === 'connected' && to !== 'checking') this.bus.emit('connection.disconnected', { connectionId: c.id });
  }

  private require(id: string): AIConnection {
    const c = this.connections.get(id);
    if (!c) throw new ConnectionError('Unknown connection.');
    return c;
  }

  /**
   * When the saved list was unreadable, the startup seed and status checks stay in memory (the
   * raw text was copied to nestra:corrupt:connections); the user's first change saves over it.
   */
  private async save(userChange = false) {
    if (this.holdSaves && !userChange) return;
    this.holdSaves = false;
    await this.storage.set<ConnectionsSnapshot>(KEY, { version: CONNECTIONS_SCHEMA, seeded: this.seeded, connections: [...this.connections.values()] });
  }

  /** for logs and exports: names, statuses and capabilities only */
  summaries() {
    return this.list({ includeRemoved: true }).map(summarize);
  }
}

/** "Claude account · max": a sign-in kind and plan, never personal details */
function accountOf(s: ProviderStatus): string | undefined {
  const auth = s.details?.auth;
  if (!auth || auth === 'none') return undefined;
  const kind = auth === 'claude.ai' ? 'Claude account' : auth;
  return s.details?.plan ? `${kind} · ${s.details.plan}` : kind;
}

/**
 * A connection's preferred model applies to every turn that does not choose
 * one (chat or agent settings win). The adapter itself is unchanged.
 */
function withPreferredModel(adapter: AIProvider, preferred: () => string | undefined): AIProvider {
  return Object.assign(Object.create(adapter) as AIProvider, {
    runTurn: (req: ProviderTurnRequest) => adapter.runTurn(req.model || !preferred() ? req : { ...req, model: preferred() }),
  });
}
