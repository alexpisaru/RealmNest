// The system prompt an agent brings to any provider turn (tasks and chat):
// who it is (from its Character) and its standing instructions. Runtime
// configuration, never stored in a conversation's messages.

import type { AgentDefinition } from '../domain/agent';

export interface AgentIdentity {
  name: string;
  role: string;
}

export function agentSystemPrompt(who: AgentIdentity | undefined, def: Pick<AgentDefinition, 'instructions'>): string | undefined {
  const parts = [who && `You are ${who.name}${who.role ? `, ${who.role}` : ''}, an agent working in RealmNest.`, def.instructions?.trim()].filter(Boolean);
  return parts.length ? parts.join('\n\n') : undefined;
}
