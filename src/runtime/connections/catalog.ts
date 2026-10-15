// ─────────────────────────────────────────────────────────────
// Provider catalogue: every backend RealmNest knows about, what connection
// methods it supports, and which settings each method needs. The settings UI
// is generated from this; no provider-specific form lives in React.
//
// Implemented providers live in their own module (claude-code/definition.ts)
// and can create an adapter for a connection. The others are listed as
// "coming soon", with no fake sign-in flow.
// ─────────────────────────────────────────────────────────────

import type { CapabilityId, CapabilitySet, Support } from '../../domain/capability';
import type { AIConnection, ConnectionMethodId } from '../../domain/connection';
import type { ProcessRunner } from '../process/types';
import type { AIProvider, ModelInfo, ProviderCapabilities } from '../providers/types';
import type { SecretStore } from './secrets';

export interface ConnectionField {
  key: string;
  label: string;
  /** secret: stored in the OS credential store, never in app storage */
  kind: 'text' | 'folder' | 'url' | 'secret';
  required?: boolean;
  placeholder?: string;
  help?: string;
}

export interface ConnectionMethodSpec {
  id: ConnectionMethodId;
  label: string;
  description: string;
  fields: ConnectionField[];
}

export interface AdapterDeps {
  runner: ProcessRunner;
  secrets: SecretStore;
}

export interface ProviderDefinition {
  id: string;
  /** product name, e.g. "Claude Code" */
  name: string;
  /** company, e.g. "Anthropic" */
  vendor: string;
  description: string;
  availability: 'available' | 'coming-soon';
  methods: ConnectionMethodSpec[];
  /** an adapter for one connection (implemented providers only) */
  create?(connection: AIConnection, deps: AdapterDeps): AIProvider;
  /** provider/connection-level capabilities with provenance (independent of a model) */
  capabilities?(connection: AIConnection, adapter: ProviderCapabilities): CapabilitySet;
  /** capabilities of one model from its catalogue metadata (providers with a model catalogue) */
  modelCapabilities?(model: ModelInfo): CapabilitySet;
  /** turns cannot run without a model chosen somewhere (no provider default) */
  requiresModel?: boolean;
  /** extra checks on a method's settings; null when fine */
  checkConfig?(method: ConnectionMethodId, config: Record<string, string>): string | null;
}

export class ProviderCatalog {
  private defs = new Map<string, ProviderDefinition>();

  register(def: ProviderDefinition): this {
    if (this.defs.has(def.id)) throw new Error(`Provider "${def.id}" is already in the catalogue`);
    this.defs.set(def.id, def);
    return this;
  }
  get(id: string) {
    return this.defs.get(id);
  }
  /** implemented first, then coming soon, in registration order */
  list(): ProviderDefinition[] {
    const all = [...this.defs.values()];
    return [...all.filter((d) => d.availability === 'available'), ...all.filter((d) => d.availability !== 'available')];
  }
}

/** Helper for definitions: one provider-level claim with its origin. */
export function claims(origin: string, entries: [CapabilityId, Support, string?][], level: 'provider' | 'connection' = 'provider'): CapabilitySet {
  const set: CapabilitySet = {};
  for (const [id, support, evidence] of entries) set[id] = { id, support, source: { level, origin, ...(evidence && { evidence }), via: 'native' } };
  return set;
}

/** What any adapter states about itself, for providers with nothing to add. */
export const baseCapabilities = (name: string, a: ProviderCapabilities): CapabilitySet =>
  claims(`${name} adapter`, [
    ['text.chat', 'supported'],
    ['text.streaming', a.streaming ? 'supported' : 'unsupported'],
    ['sessions.native', a.sessions ? 'supported' : 'unsupported'],
  ]);

/** Known providers without an adapter yet: listed, never connectable. */
export const COMING_SOON: ProviderDefinition[] = [
  { id: 'anthropic-api', name: 'Anthropic API', vendor: 'Anthropic', description: 'Claude models with an API key.', availability: 'coming-soon', methods: [] },
  { id: 'openrouter', name: 'OpenRouter', vendor: 'OpenRouter', description: 'Many models through one API key.', availability: 'coming-soon', methods: [] },
  { id: 'ollama', name: 'Ollama', vendor: 'Ollama', description: 'Local or remote open models.', availability: 'coming-soon', methods: [] },
  { id: 'google', name: 'Gemini', vendor: 'Google', description: 'Gemini models.', availability: 'coming-soon', methods: [] },
];
