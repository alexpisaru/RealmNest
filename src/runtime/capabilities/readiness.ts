// What RealmNest itself can exercise today, per capability, given an adapter.
// Separate from what a provider/model supports: a model may accept images
// while RealmNest cannot send them yet. Update this table as features land.

import type { CapabilityId } from '../../domain/capability';
import type { ProviderCapabilities } from '../providers/types';

export interface Readiness {
  ready: boolean;
  note?: string;
}

export function realmnestReadiness(cap: CapabilityId, a: ProviderCapabilities): Readiness {
  switch (cap) {
    case 'text.chat':
    case 'coding':
      return { ready: true };
    case 'text.reasoning':
      return { ready: true, note: 'the model reasons on its own; the effort level is set per chat and per agent where the model offers one' };
    case 'text.streaming':
      return a.streaming ? { ready: true } : { ready: false, note: 'this adapter does not stream' };
    case 'sessions.native':
      return a.sessions ? { ready: true } : { ready: false, note: 'RealmNest replays the conversation history instead' };
    case 'vision.input':
      return a.vision ? { ready: true } : { ready: false, note: 'RealmNest does not send images through this adapter yet' };
    case 'files.input':
      return a.files ? { ready: true, note: 'PDFs attach from the chat composer' } : { ready: false, note: 'RealmNest does not send PDFs through this adapter yet' };
    case 'tools.calling':
      // the model asks, RealmNest runs: needs an adapter that takes RealmNest tools (Claude Code runs its own)
      if (a.toolCalling) return { ready: true, note: 'tools run through RealmNest (permissions and approval)' };
      if (a.toolBridge) return { ready: true, note: 'through the RealmNest MCP bridge: the model calls, RealmNest checks permissions and runs' };
      return { ready: false, note: 'this adapter does not take RealmNest tools yet' };
    case 'web.search':
      return { ready: false, note: 'web search is not built yet' };
    case 'image.generate':
    case 'image.edit':
      return { ready: false, note: 'image generation is not built yet' };
    case 'embeddings.create':
      return a.embeddings ? { ready: true, note: 'used by Knowledge bases set to hybrid search' } : { ready: false, note: 'this adapter does not create embeddings' };
    case 'structured.output':
      return a.structuredOutput ? { ready: true, note: 'used by Memory extraction when the model supports it' } : { ready: false, note: 'RealmNest does not request structured output through this adapter' };
  }
}
