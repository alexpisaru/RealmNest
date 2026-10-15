// Moving an agent to another world, the same way from every surface
// (Agents, Worlds, the World inspector). A drag-and-drop target would call
// the same function.

import { WORLD_BY_ID } from '../data/worlds';
import { useServices, useT, useTD } from './context';

export function useMoveAgent() {
  const { store, live } = useServices();
  const t = useT();
  const td = useTD();
  return (agentId: string, worldId: string) => {
    const r = store.moveCharacter(agentId, worldId, (id) => !!live.activeRun(id));
    const name = store.getState().characters.find((c) => c.id === agentId)?.name ?? '';
    if (r.ok) store.toast(t('agent.moved', { name, world: td(WORLD_BY_ID[worldId]?.name ?? worldId) }));
    else if (r.reason === 'busy') store.toast(t('agent.moveBusy'));
    return r;
  };
}
