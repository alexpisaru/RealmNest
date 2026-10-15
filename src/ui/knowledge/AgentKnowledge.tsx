// The agent inspector's Knowledge section: the bases this agent's tasks (and its
// chats without a choice of their own) search, and how answers may use them.

import { useKnowledge, useServices, useT } from '../context';
import { BasePicker, ModeSwitch } from './common';

export function AgentKnowledge({ agentId, name, disabled }: { agentId: string; name: string; disabled?: boolean }) {
  const t = useT();
  const { live } = useServices();
  useKnowledge();
  const def = live.agent(agentId);
  const ids = def.knowledgeBaseIds ?? [];
  const mode = def.knowledgeMode ?? 'grounded';
  return (
    <div className="agent-tools agent-knowledge">
      <span className="agent-tools-head">{t('kn.agentHead', { name })}</span>
      <BasePicker value={ids} disabled={disabled} onChange={(next) => live.updateAgent(agentId, next.length ? { knowledgeBaseIds: next, knowledgeMode: mode } : { knowledgeBaseIds: undefined })} />
      {ids.length > 0 && <ModeSwitch value={mode} disabled={disabled} onChange={(m) => live.updateAgent(agentId, { knowledgeMode: m })} />}
    </div>
  );
}
