// ─────────────────────────────────────────────────────────────
// Capabilities: what a provider, a connection or a model can do.
//
//   SUPPORTED   a provider/model declares it can do it (with provenance)
//   AVAILABLE   the connection works right now (real status check)
//   READY       RealmNest can actually exercise it today (adapter wiring)
//   ROUTED      the user's routing policy picked this connection/model for it
//
// These are never collapsed into one boolean. A capability is not a tool
// (an executable action), a skill (instructions/procedure), a provider (an
// implementation), a connection (a configured account) or a model.
// See docs/CAPABILITIES.md.
// ─────────────────────────────────────────────────────────────

export const CAPABILITY_IDS = [
  'text.chat',
  'text.streaming',
  'text.reasoning',
  'vision.input',
  'files.input',
  'coding',
  'tools.calling',
  'web.search',
  'image.generate',
  'image.edit',
  'structured.output',
  'sessions.native',
  'embeddings.create',
] as const;
export type CapabilityId = (typeof CAPABILITY_IDS)[number];

export interface CapabilityInfo {
  label: string;
  description: string;
  /** can be routed to a connection/model in Settings › AI Capabilities */
  routable: boolean;
}

export const CAPABILITY_INFO: Record<CapabilityId, CapabilityInfo> = {
  'text.chat': { label: 'Chat', description: 'Answers in text to a conversation.', routable: true },
  'text.streaming': { label: 'Streaming', description: 'Text arrives while it is being written.', routable: false },
  'text.reasoning': { label: 'Reasoning', description: 'Thinks step by step before answering.', routable: true },
  'vision.input': { label: 'Vision', description: 'Understands images in the input.', routable: true },
  'files.input': { label: 'Files', description: 'Reads documents given as input.', routable: false },
  coding: { label: 'Coding', description: 'Writes and works on code.', routable: true },
  'tools.calling': { label: 'Tool calling', description: 'Asks for tools to be run.', routable: false },
  'web.search': { label: 'Web search', description: 'Looks things up on the web.', routable: true },
  'image.generate': { label: 'Image generation', description: 'Creates images.', routable: true },
  'image.edit': { label: 'Image editing', description: 'Changes existing images.', routable: false },
  'structured.output': { label: 'Structured output', description: 'Answers in a requested JSON shape.', routable: false },
  'sessions.native': { label: 'Native sessions', description: 'The provider remembers conversations itself.', routable: false },
  'embeddings.create': { label: 'Embeddings', description: 'Turns text into vectors for semantic Knowledge search.', routable: true },
};

/** unknown is not false: the provider gave no evidence either way */
export type Support = 'supported' | 'unsupported' | 'unknown';

/** where a claim comes from */
export type CapabilityLevel = 'provider' | 'connection' | 'model' | 'nestra';

export interface CapabilitySource {
  level: CapabilityLevel;
  /** who says so, e.g. "Claude Code adapter", "OpenRouter model catalogue" */
  origin: string;
  /** what exactly, e.g. "architecture.input_modalities includes image" */
  evidence?: string;
  /** provider-native, or added by RealmNest (tools, parsers…, later) */
  via: 'native' | 'nestra';
}

export interface CapabilityDescriptor {
  id: CapabilityId;
  support: Support;
  source: CapabilitySource;
}

/** missing entries mean unknown */
export type CapabilitySet = Partial<Record<CapabilityId, CapabilityDescriptor>>;

export interface EffectiveCapability {
  id: CapabilityId;
  /** the most specific claim (model over connection over provider) */
  support: Support;
  /** every contributing claim, most specific first */
  provenance: CapabilitySource[];
  /** the connection works right now */
  available: boolean;
  /** RealmNest can exercise it today through this connection */
  ready: boolean;
  /** why not ready, or other remarks */
  note?: string;
}

// ── routing ──────────────────────────────────────────────────

export interface RouteTarget {
  connectionId: string;
  /** none: the connection's preferred model / provider default */
  modelId?: string;
}

/** capability → ordered targets (first is primary, the rest explicit fallbacks) */
export type CapabilityRoutes = Partial<Record<CapabilityId, RouteTarget[]>>;

export interface RoutingPolicy {
  version: number;
  routes: CapabilityRoutes;
  updatedAt: number;
}

export type RouteFailure =
  | 'NO_ROUTE_CONFIGURED'
  | 'CONNECTION_UNAVAILABLE'
  | 'CONNECTION_CHECKING'
  | 'CONNECTION_REMOVED'
  | 'MODEL_UNAVAILABLE'
  | 'MODEL_REQUIRED'
  | 'CAPABILITY_UNSUPPORTED'
  | 'NOT_READY';

/** one configured target, evaluated now */
export interface TargetCheck {
  target: RouteTarget;
  /** position in the route: 0 primary, 1+ fallbacks */
  index: number;
  ok: boolean;
  support: Support;
  failure?: RouteFailure;
  reason?: string;
}

export interface ResolvedRoute {
  capability: CapabilityId;
  ok: boolean;
  /** the target to use when ok */
  target?: RouteTarget;
  /** 'policy' = primary target, 'fallback' = a later configured target */
  source?: 'policy' | 'fallback';
  /** when not ok: the primary target's failure (or NO_ROUTE_CONFIGURED) */
  failure?: RouteFailure;
  reason?: string;
  /** every configured target and its state */
  checks: TargetCheck[];
}
