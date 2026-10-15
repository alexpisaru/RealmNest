// A task's place in a chain of delegations (delegate_task, docs/DELEGATION.md): who handed it over,
// and the tasks this run handed to colleagues with their state. A name opens that agent's panel
// when it is in the current world.

import { CornerDownRight, CornerUpLeft, Network, Workflow } from 'lucide-react';
import type { TKey } from '../i18n';
import { useApp, useCrews, useLive, useOrchestrator, useServices, useSession, useT, useTD } from './context';

export function DelegationLinks({ runId, taskId }: { runId: string; taskId: string }) {
  const t = useT();
  const td = useTD();
  const live = useLive();
  const st = useApp();
  const session = useSession();
  const task = live.getTask(taskId);
  const children = live.delegatedFrom(runId);
  const from = task?.delegatedBy;
  const crews = useCrews();
  const { store } = useServices();
  const crew = task?.crew ? crews.run(task.crew.runId) : undefined;
  const orchestrator = useOrchestrator();
  const flow = task?.workflow ? orchestrator.get(task.workflow.runId) : undefined;
  if (!from && !children.length && !crew && !flow) return null;
  const nameOf = (id: string) => st.characters.find((c) => c.id === id)?.name ?? id;
  const open = (id: string) => session?.sim.agents.some((a) => a.id === id) && session.select(id);
  const who = (id: string) => (
    <button type="button" className="link-btn" onClick={() => open(id)} title={t('dlg.open', { name: nameOf(id) })}>
      {nameOf(id)}
    </button>
  );
  return (
    <div className="dlg-links">
      {crew && task?.crew && (
        <p>
          <Network size={13} />{' '}
          <button type="button" className="link-btn" onClick={() => store.openCrew({ runId: crew.id })} title={t('cw.openCrew')}>
            {t('cw.inCrew', { name: crew.crew.name, task: task.crew.kind === 'plan' ? t('cw.plan') : task.crew.kind === 'assemble' ? t('cw.final') : `${task.crew.taskId ?? ''}${task.crew.kind === 'review' ? ` · ${t('cw.kind.review')}` : ''}` })}
          </button>
        </p>
      )}
      {flow && task?.workflow && (
        <p>
          <Workflow size={13} />{' '}
          <button type="button" className="link-btn" onClick={() => store.openWorkflow({ runId: flow.id })} title={t('wf.openWorkflow')}>
            {t('wf.inWorkflow', { name: flow.definition.name, node: flow.definition.nodes.find((n) => n.id === task.workflow!.nodeId)?.title ?? task.workflow.nodeId })}
          </button>
        </p>
      )}
      {from && (
        <p>
          <CornerUpLeft size={13} /> {from.agentId && !from.conversationId ? <>{t('dlg.from', { name: '' })}{who(from.agentId)}</> : t('dlg.fromChat')}
          {from.taskId && <span className="muted"> · {td(live.getTask(from.taskId)?.title)}</span>}
        </p>
      )}
      {children.length > 0 && (
        <>
          <small className="muted">{t('dlg.handed')}</small>
          <ul>
            {children.map((c) => (
              <li key={c.id}>
                <CornerDownRight size={13} /> {who(c.agentId)} <span className="muted">· {td(c.title)}</span> <span className={`run-badge ${c.status}`}>{t(`dlg.st.${c.status}` as TKey)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
