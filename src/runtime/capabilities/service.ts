// ─────────────────────────────────────────────────────────────
// CapabilityService: the one place that answers
//   - what can this connection / model do, and who says so   (supported + provenance)
//   - does the connection work now                             (available)
//   - can RealmNest exercise it today                             (ready)
//   - which connection/model does the user want for it         (routed)
// Chat, agents, settings and debug views all ask here; nothing else decides.
//
// Routing is the user's explicit policy: capability → ordered targets. It is
// stored apart from connections and never changed automatically; a target
// that is offline, removed or points to a vanished model is reported, not
// replaced. Later targets are used only when the user configured them.
// ─────────────────────────────────────────────────────────────

import type { EventBus } from '../../core/events';
import {
  CAPABILITY_IDS,
  CAPABILITY_INFO,
  type CapabilityDescriptor,
  type CapabilityId,
  type CapabilitySet,
  type EffectiveCapability,
  type ResolvedRoute,
  type RouteTarget,
  type RoutingPolicy,
  type TargetCheck,
} from '../../domain/capability';
import type { StorageAdapter } from '../../persistence/storage';
import type { ConnectionManager } from '../connections/manager';
import type { ModelInfo } from '../providers/types';
import { realmnestReadiness } from './readiness';

const KEY = 'routing';
export const ROUTING_SCHEMA = 1;

export class RoutingError extends Error {}

export class CapabilityService {
  private policyState: RoutingPolicy = { version: ROUTING_SCHEMA, routes: {}, updatedAt: 0 };
  /** how many tools can run here (tools.calling is ready only with at least one) */
  private runnableTools: () => number = () => 0;
  private bridgeAvailable: () => boolean = () => false;
  /** embedding models are a catalogue of their own (undefined: not fetched yet) */
  private embeddingCatalog: (connectionId: string) => string[] | undefined = () => undefined;
  private listeners = new Set<() => void>();
  private version = 0;

  constructor(
    private connections: ConnectionManager,
    private bus: EventBus,
    private storage: StorageAdapter,
    private now: () => number = Date.now,
  ) {
    // statuses and catalogues change what routes resolve to
    connections.subscribe(() => this.changed());
  }

  async init() {
    const raw = await this.storage.get<Partial<RoutingPolicy>>(KEY);
    const routes: RoutingPolicy['routes'] = {};
    for (const [cap, targets] of Object.entries(raw?.routes ?? {})) {
      if ((CAPABILITY_IDS as readonly string[]).includes(cap) && Array.isArray(targets))
        routes[cap as CapabilityId] = targets.filter((t) => t && typeof t.connectionId === 'string').map((t) => ({ connectionId: t.connectionId, ...(t.modelId && { modelId: t.modelId }) }));
    }
    this.policyState = { version: ROUTING_SCHEMA, routes, updatedAt: raw?.updatedAt ?? 0 };
    this.changed();
  }

  /** the ToolRegistry's count of runnable tools (set once at startup) */
  useToolCount(count: () => number) {
    this.runnableTools = count;
    this.changed();
  }

  /** whether the RealmNest MCP bridge can run in this build (desktop app) */
  useToolBridge(available: () => boolean) {
    this.bridgeAvailable = available;
    this.changed();
  }

  /** the embedding-model catalogue of a connection, when known (Knowledge) */
  useEmbeddingCatalog(catalog: (connectionId: string) => string[] | undefined) {
    this.embeddingCatalog = catalog;
    this.changed();
  }

  /** let the UI re-evaluate after something outside connections changed (an embedding catalogue arrived) */
  refresh() {
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

  // ── what is supported, and who says so ──────────────────
  /** provider/connection-level claims (independent of a model and of the current status) */
  connectionCapabilities(connectionId: string): CapabilitySet {
    const c = this.connections.get(connectionId);
    if (!c) return {};
    if (c.capabilities) return c.capabilities;
    const def = this.connections.catalog.get(c.providerId);
    const adapter = this.connections.provider(connectionId);
    return def?.capabilities && adapter ? def.capabilities(c, adapter.capabilities) : {};
  }

  /** model-level claims from the catalogue; undefined when the model is not in it */
  modelCapabilities(connectionId: string, modelId: string): CapabilitySet | undefined {
    const c = this.connections.get(connectionId);
    const model = this.connections.models(connectionId).find((m) => m.id === modelId);
    const def = c && this.connections.catalog.get(c.providerId);
    if (!model || !def?.modelCapabilities) return undefined;
    return def.modelCapabilities(model);
  }

  /** everything about one capability on a connection (and model) */
  effective(connectionId: string, modelId?: string): Record<CapabilityId, EffectiveCapability> {
    const c = this.connections.get(connectionId);
    const adapter = this.connections.provider(connectionId);
    const conn = this.connectionCapabilities(connectionId);
    const model = modelId ? this.modelCapabilities(connectionId, modelId) : undefined;
    const available = !!c && !c.removedAt && c.status === 'connected';
    const out = {} as Record<CapabilityId, EffectiveCapability>;
    for (const id of CAPABILITY_IDS) {
      const claims = [model?.[id], conn[id]].filter((d): d is CapabilityDescriptor => !!d);
      // the most specific claim wins: a model can deny what the connection allows in general
      const support = claims[0]?.support ?? 'unknown';
      let r = adapter ? realmnestReadiness(id, adapter.capabilities) : { ready: false, note: 'no adapter for this connection' };
      if (id === 'tools.calling' && r.ready && this.runnableTools() === 0) r = { ready: false, note: 'no tool can run in this build' };
      if (id === 'tools.calling' && r.ready && adapter && !adapter.capabilities.toolCalling && adapter.capabilities.toolBridge && !this.bridgeAvailable())
        r = { ready: false, note: 'the RealmNest MCP bridge runs only in the desktop app' };
      out[id] = { id, support, provenance: claims.map((d) => d.source), available, ready: r.ready && support !== 'unsupported', ...(r.note && { note: r.note }) };
    }
    return out;
  }

  /** the connection's catalogue split by support for a capability (the catalogue itself is never trimmed) */
  modelsFor(connectionId: string, cap: CapabilityId): { supported: ModelInfo[]; unknown: ModelInfo[] } {
    const supported: ModelInfo[] = [];
    const unknown: ModelInfo[] = [];
    for (const m of this.connections.models(connectionId)) {
      const s = this.modelCapabilities(connectionId, m.id)?.[cap]?.support ?? this.connectionCapabilities(connectionId)[cap]?.support ?? 'unknown';
      if (s === 'supported') supported.push(m);
      else if (s === 'unknown') unknown.push(m);
    }
    return { supported, unknown };
  }

  /** connections that may serve a capability (not unsupported at connection level; some model if they have a catalogue) */
  connectionsFor(cap: CapabilityId) {
    return this.connections.list().filter((c) => {
      // embeddings: only connections that say so (the chat catalogue tells nothing about them)
      if (cap === 'embeddings.create') return this.connectionCapabilities(c.id)[cap]?.support === 'supported';
      if (this.connectionCapabilities(c.id)[cap]?.support === 'unsupported') return false;
      if (!this.connections.models(c.id).length) return true;
      const m = this.modelsFor(c.id, cap);
      return m.supported.length + m.unknown.length > 0;
    });
  }

  // ── routing policy ───────────────────────────────────────
  policy(): RoutingPolicy {
    return this.policyState;
  }

  targets(cap: CapabilityId): RouteTarget[] {
    return this.policyState.routes[cap] ?? [];
  }

  /** Replace a capability's ordered targets (empty = not configured). */
  async setRoute(cap: CapabilityId, targets: RouteTarget[]) {
    if (!CAPABILITY_INFO[cap]?.routable) throw new RoutingError(`${cap} cannot be routed.`);
    const clean = targets.filter((t) => t.connectionId).map((t) => ({ connectionId: t.connectionId, ...(t.modelId?.trim() && { modelId: t.modelId.trim() }) }));
    const routes = { ...this.policyState.routes };
    if (clean.length) routes[cap] = clean;
    else delete routes[cap];
    this.policyState = { version: ROUTING_SCHEMA, routes, updatedAt: this.now() };
    await this.storage.set<RoutingPolicy>(KEY, this.policyState);
    this.bus.emit('routing.updated', { capability: cap, targets: clean.length });
    this.changed();
  }

  /** One configured target, evaluated now (never changes the policy). */
  checkTarget(cap: CapabilityId, target: RouteTarget, index = 0): TargetCheck {
    const fail = (failure: TargetCheck['failure'], reason: string, support: TargetCheck['support'] = 'unknown'): TargetCheck => ({ target, index, ok: false, support, failure, reason });
    const c = this.connections.get(target.connectionId);
    if (!c) return fail('CONNECTION_REMOVED', 'This connection no longer exists.');
    if (c.removedAt) return fail('CONNECTION_REMOVED', `${c.name} was removed.`);
    // a failed check comes first: nothing on that connection works until it is fixed
    if (c.status !== 'connected' && c.status !== 'unknown' && c.status !== 'checking') return fail('CONNECTION_UNAVAILABLE', `${c.name}: ${(c.statusMessage ?? c.status).replace(/\.$/, '')}.`);
    const def = this.connections.catalog.get(c.providerId);
    if (cap === 'embeddings.create') return this.checkEmbeddingTarget(c, target, index);
    const modelId = target.modelId ?? c.preferredModel;
    const catalog = this.connections.models(c.id);
    if (target.modelId && catalog.length && !catalog.some((m) => m.id === target.modelId)) return fail('MODEL_UNAVAILABLE', `${target.modelId} is no longer in ${c.name}'s model list.`);
    if (!modelId && def?.requiresModel) return fail('MODEL_REQUIRED', `Choose a model for ${c.name}.`);
    const eff = this.effective(c.id, modelId)[cap];
    if (eff.support === 'unsupported') return fail('CAPABILITY_UNSUPPORTED', `${modelId ?? c.name} does not support ${CAPABILITY_INFO[cap].label.toLowerCase()} (${eff.provenance[0]?.origin ?? 'declared'}).`, 'unsupported');
    // not checked yet (e.g. right after a restart): never assumed to work
    if (c.status !== 'connected') return fail('CONNECTION_CHECKING', `${c.name} is being checked.`, eff.support);
    if (!eff.ready) return fail('NOT_READY', `Configured, but ${eff.note ?? 'RealmNest cannot use it yet'}.`, eff.support);
    return { target, index, ok: true, support: eff.support, ...(eff.support === 'unknown' && { reason: 'support not stated by the provider' }) };
  }

  /** embeddings: an explicit model from the embedding catalogue (never the chat model) */
  private checkEmbeddingTarget(c: NonNullable<ReturnType<ConnectionManager['get']>>, target: RouteTarget, index: number): TargetCheck {
    const cap = 'embeddings.create';
    const fail = (failure: TargetCheck['failure'], reason: string, support: TargetCheck['support'] = 'unknown'): TargetCheck => ({ target, index, ok: false, support, failure, reason });
    const eff = this.effective(c.id)[cap];
    if (eff.support !== 'supported') return fail('CAPABILITY_UNSUPPORTED', `${c.name} does not create embeddings.`, eff.support);
    if (!target.modelId) return fail('MODEL_REQUIRED', `Choose an embedding model for ${c.name}.`, eff.support);
    const catalog = this.embeddingCatalog(c.id);
    if (catalog && catalog.length && !catalog.includes(target.modelId)) return fail('MODEL_UNAVAILABLE', `${target.modelId} is no longer in ${c.name}'s embedding models.`, eff.support);
    if (c.status !== 'connected') return fail('CONNECTION_CHECKING', `${c.name} is being checked.`, eff.support);
    if (!eff.ready) return fail('NOT_READY', `Configured, but ${eff.note ?? 'RealmNest cannot use it yet'}.`, eff.support);
    return { target, index, ok: true, support: eff.support };
  }

  /** The route to use now: the first configured target that works (fallbacks only if configured). */
  resolveRoute(cap: CapabilityId): ResolvedRoute {
    const checks = this.targets(cap).map((t, i) => this.checkTarget(cap, t, i));
    if (!checks.length) return { capability: cap, ok: false, failure: 'NO_ROUTE_CONFIGURED', reason: `No route is set for ${CAPABILITY_INFO[cap].label.toLowerCase()} (Settings › AI Capabilities).`, checks };
    const hit = checks.find((c) => c.ok);
    if (hit) return { capability: cap, ok: true, target: hit.target, source: hit.index === 0 ? 'policy' : 'fallback', checks };
    return { capability: cap, ok: false, failure: checks[0].failure, reason: checks[0].reason, checks };
  }

  /** Can RealmNest currently satisfy every requirement (e.g. a future Deep Research needs text.chat + web.search)? */
  canSatisfy(requirements: CapabilityId[]) {
    const routes = requirements.map((r) => this.resolveRoute(r));
    return { ok: routes.every((r) => r.ok), routes };
  }
}
