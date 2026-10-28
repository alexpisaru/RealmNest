// The inspector's live section: give a real task to one agent, follow its run
// as it streams, cancel it, see past results. Everything shown comes from the
// LiveRuntime; nothing here changes what the character does on screen.

import { Paperclip, Play, Square } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { AttachmentKind } from '../domain/attachment';
import { ArtifactStrip, FileChip, SkillsUsed, StoredAttachment, useArtifacts, usePendingFiles } from './files/FileViews';
import { isFinished, type AgentRun } from '../domain/agent';
import { LiveRuntimeError } from '../runtime/live/liveRuntime';
import { AUTO_ROUTE, ConnectionSelect, useConnectionLabel } from './connections';
import type { TKey } from '../i18n';
import { useApp, useCapabilities, useConnections, useLive, useServices, useT, useTD } from './context';
import { fileMessage } from './files/importFiles';
import { Button } from './kit';
import { defaultModelLabel, ModelPicker } from './ModelPicker';
import { EffortSelect, useEfforts } from './chat/EffortPicker';
import { Markdown } from './chat/Markdown';
import { ToolCallList } from './tools/ToolCalls';
import { AgentTools } from './tools/ToolSettings';
import { AgentSkills } from './skills/AgentSkills';
import { AgentKnowledge } from './knowledge/AgentKnowledge';
import { CitationPanel, CitedText } from './knowledge/common';
import { AgentMemory, MemoryProposed, MemoryUsed } from './memory/MemoryViews';
import { AgentWeb, WebSources } from './web/WebViews';
import { UsageRing } from './usage/UsageRing';
import { DelegationLinks } from './DelegationLinks';

const STATUS_KEY: Record<string, TKey> = {
  idle: 'a.live.idle',
  starting: 'a.live.starting',
  working: 'a.live.working',
};

export function LiveTaskPanel({ agentId }: { agentId: string }) {
  const live = useLive();
  const connections = useConnections();
  const def = live.agent(agentId);
  const conn = connections.get(def.connectionId);
  const capabilities = useCapabilities();
  const labelOf = useConnectionLabel();
  const route = def.useDefaultRoute ? capabilities.resolveRoute('text.chat') : undefined;
  const status = live.agentStatus(agentId);
  const t = useT();
  const td = useTD();
  const st = useApp();
  const name = st.characters.find((c) => c.id === agentId)?.name ?? agentId;
  // the connection and model a task would run on now
  const runConnection = def.useDefaultRoute ? route?.target?.connectionId : def.connectionId;
  const runModel = def.useDefaultRoute ? route?.target?.modelId : (def.model ?? conn?.preferredModel);
  // reasoning effort: only for a model that lists levels
  const effortChoice = useEfforts(runConnection, runModel);
  const active = live.activeRun(agentId);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const tasks = live.tasksOf(agentId);
  const latest = tasks[0];
  const shown: AgentRun | undefined = active ?? (latest ? live.runsOf(latest.id).at(-1) : undefined);
  const artifacts = useArtifacts();
  const picker = useRef<HTMLInputElement>(null);
  const taskBox = useRef<HTMLTextAreaElement>(null);
  // files for the task: the same import as the chat (content-checked, stored, by reference)
  const refuse = (kind: AttachmentKind) => {
    if (kind === 'text' || !runConnection) return undefined;
    const eff = capabilities.effective(runConnection, runModel)[kind === 'image' ? 'vision.input' : 'files.input'];
    return eff.support === 'unsupported' || !eff.ready ? t('chat.attachUnsupported', { model: runModel ?? labelOf(runConnection), what: t(kind === 'image' ? 'chat.whatImages' : 'chat.whatPdfs') }) : undefined;
  };
  const pending = usePendingFiles(refuse);
  // Send to Agent (Artifacts): the artifact's stored file, attached to this agent's next task
  const { store } = useServices();
  useEffect(() => {
    const h = store.takeTaskHandoff(agentId);
    if (!h) return;
    artifacts
      .asAttachment(h.artifactId)
      .then((a) => {
        const no = refuse(a.kind);
        pending.set((l) => [...l.filter((x) => x.artifactId !== a.artifactId), { ...a, key: `art-${h.artifactId}`, ...(no && { status: 'error' as const, error: no }) }]);
        requestAnimationFrame(() => taskBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
      })
      .catch((e) => setError(fileMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [st.taskHandoff, agentId]);

  const start = () => {
    setError('');
    try {
      if (pending.loading) throw new LiveRuntimeError(t('files.waiting'));
      // a new installation has none (0.11.1): say where to add one, in the user's language
      if (!connections.list().length) throw new LiveRuntimeError(t('chat.noConnections'));
      live.startTask(agentId, { prompt, attachments: pending.ready });
      setPrompt('');
      pending.clear();
    } catch (err) {
      setError(err instanceof LiveRuntimeError ? err.message : String(err));
    }
  };

  return (
    <div className="live-task">
      <h4 className="ins-section">AI</h4>
      <dl className="kv">
        <dt>{t('a.live.connection')}</dt>
        <dd>
          <ConnectionSelect
            value={def.useDefaultRoute ? AUTO_ROUTE : def.connectionId}
            autoLabel={t('picker.autoSub')}
            disabled={!!active}
            onChange={(id) => live.updateAgent(agentId, id === AUTO_ROUTE ? { useDefaultRoute: true } : { connectionId: id, useDefaultRoute: false })}
          />
        </dd>
        <dt>{t('a.model.label')}</dt>
        <dd>
          {def.useDefaultRoute ? (
            <span className={`route-preview ${route?.ok ? 'ok' : 'bad'}`}>
              {route?.ok ? `${labelOf(route.target!.connectionId)}${route.target!.modelId ? ` · ${route.target!.modelId}` : ''}` : route?.reason}
            </span>
          ) : (
            <ModelPicker
              connectionId={def.connectionId}
              value={def.model}
              disabled={!!active}
              autoLabel={defaultModelLabel(conn?.preferredModel, connections.models(def.connectionId).length > 0, t)}
              onChange={(m) => live.updateAgent(agentId, { model: m })}
            />
          )}
        </dd>
        {effortChoice.efforts.length > 0 && (
          <>
            <dt title={t('a.effort.hint')}>{t('a.effort.label')}</dt>
            <dd>
              <EffortSelect {...effortChoice} value={def.effort} disabled={!!active} onChange={(e) => live.updateAgent(agentId, { effort: e })} />
            </dd>
          </>
        )}
        <dt>{t('use.title')}</dt>
        <dd>
          <UsageRing connectionId={def.useDefaultRoute ? route?.target?.connectionId : def.connectionId} agentId={agentId} agentName={st.characters.find((c) => c.id === agentId)?.name} summary />
        </dd>
        <dt>{t('a.live.runtime')}</dt>
        <dd className={`live-status ${status}`}>{STATUS_KEY[status] ? t(STATUS_KEY[status]) : status}</dd>
      </dl>
      <details className="live-instructions">
        <summary>{t('a.live.instructions')}</summary>
        <textarea key={`i-${agentId}`} rows={3} defaultValue={def.instructions ?? ''} disabled={!!active} placeholder={t('a.live.instructionsPh')} onBlur={(e) => e.target.value !== (def.instructions ?? '') && live.updateAgent(agentId, { instructions: e.target.value })} aria-label={t('a.live.instructionsLabel')} />
      </details>

      <h4 className="ins-section">{t('skills.title')}</h4>
      <AgentSkills agentId={agentId} name={name} connectionId={runConnection} model={runModel} disabled={!!active} />

      <h4 className="ins-section">{t('kn.title')}</h4>
      <AgentKnowledge agentId={agentId} name={name} disabled={!!active} />

      <h4 className="ins-section">{t('mem.title')}</h4>
      <AgentMemory agentId={agentId} disabled={!!active} />

      <h4 className="ins-section">{t('web.title')}</h4>
      <AgentWeb agentId={agentId} disabled={!!active} />

      <h4 className="ins-section">{t('tools.title')}</h4>
      {runConnection && <AgentTools agentId={agentId} connectionId={runConnection} model={runModel} name={name} disabled={!!active} />}

      <h4 className="ins-section">{t('a.live.work')}</h4>
      {!active && (
        <>
          <textarea
            ref={taskBox}
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={(e) => {
              const f = [...e.clipboardData.files];
              if (f.length) (e.preventDefault(), pending.add(f, 'paste'));
            }}
            onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            onDrop={(e) => {
              if (!e.dataTransfer.files.length) return;
              e.preventDefault();
              pending.add([...e.dataTransfer.files], 'drop');
            }}
            placeholder={t('a.live.taskPh')}
            aria-label={t('a.live.task')}
          />
          {pending.items.length > 0 && (
            <ul className="composer-files task-files" aria-label={t('task.files')}>
              {pending.items.map((a) => (
                <FileChip key={a.key} a={a} onRemove={() => pending.remove(a.key)} />
              ))}
            </ul>
          )}
          <div className="row">
            <Button size="sm" icon={<Paperclip size={14} />} onClick={() => picker.current?.click()}>
              {t('task.attach')}
            </Button>
            <input
              ref={picker}
              type="file"
              multiple
              hidden
              onChange={(e) => {
                if (e.target.files?.length) pending.add([...e.target.files], 'picker');
                e.target.value = '';
              }}
            />
            <Button tone="primary" size="sm" icon={<Play size={14} />} onClick={start} disabled={(!prompt.trim() && !pending.ready.length) || pending.loading}>
              {t('a.live.run')}
            </Button>
          </div>
        </>
      )}
      {active && (
        <div className="row">
          <span className="muted">{td(latest?.title)}</span>
          <Button tone="danger" size="sm" icon={<Square size={14} />} onClick={() => void live.cancel(agentId)}>
            {t('creator.cancel')}
          </Button>
        </div>
      )}
      {error && <p className="live-error">{error}</p>}

      {shown && (
        <div className="live-run">
          <div className="live-run-head">
            <span className={`run-badge ${shown.status}`}>{t(`a.run.${shown.status}` as TKey)}</span>
            {latest && <span className="muted">{t('a.live.taskStatus', { status: t(`dlg.st.${latest.status}` as TKey) })}</span>}
            {isFinished(shown.status) && shown.finishedAt && shown.startedAt && <span className="muted">{((shown.finishedAt - shown.startedAt) / 1000).toFixed(1)} s</span>}
            {shown.costUsd !== undefined && <span className="muted">${shown.costUsd.toFixed(4)}</span>}
          </div>
          <SkillsUsed refs={shown.skills} />
          <DelegationLinks runId={shown.id} taskId={shown.taskId} />
          {(() => {
            const files = live.getTask(shown.taskId)?.attachments;
            return files?.length ? (
              <ul className="composer-files task-files" aria-label={t('task.files')}>
                {files.map((a) => (
                  <StoredAttachment key={a.id} a={a} load={(x) => live.attachmentBytes(x)} />
                ))}
              </ul>
            ) : null;
          })()}
          <ToolCallList runId={shown.id} />
          <div className="live-out" aria-live="polite">
            <Markdown text={(shown.status === 'completed' ? (shown.result ?? shown.output) : shown.output) || (active ? '…' : '—')} plain={(x) => <CitedText text={x} record={shown.status === 'completed' ? shown.knowledge : undefined} web={shown.status === 'completed' ? shown.web : undefined} render={(y) => y} />} />
          </div>
          <CitationPanel record={shown.knowledge} />
          <WebSources record={shown.web} />
          <MemoryUsed record={shown.memory} />
          {shown.status === 'completed' && <MemoryProposed runId={shown.id} />}
          {artifacts.forRun(shown.id).length > 0 && (
            <>
              <h5 className="ins-sub">{t('art.outputs')}</h5>
              <ArtifactStrip list={artifacts.forRun(shown.id)} />
            </>
          )}
          {shown.error && (
            <p className="live-error">
              {shown.error.code === 'interrupted' ? t('a.live.interrupted') : shown.error.message}
              {shown.error.detail && <small> · {shown.error.detail}</small>}
            </p>
          )}
        </div>
      )}

      {tasks.length > 1 && (
        <details className="live-history">
          <summary>{t('a.live.earlier', { n: tasks.length - 1 })}</summary>
          <ul>
            {tasks.slice(1, 11).map((task) => {
              // the Skills its last run used, as they were then (kept after an uninstall)
              const used = live.getRun(task.runIds[task.runIds.length - 1])?.skills;
              return (
                <li key={task.id}>
                  <span className={`run-badge ${task.status}`}>{t(`dlg.st.${task.status}` as TKey)}</span> {td(task.title)}
                  {used?.length ? <small className="run-skills-inline"> · {used.map((x) => `${x.name} ${x.version}`).join(', ')}</small> : null}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
