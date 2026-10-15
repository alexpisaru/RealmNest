// Settings › AI Capabilities: the user's routing policy. For each capability,
// an ordered list of connection/model targets (first = primary, then explicit
// fallbacks), each evaluated live. Nothing here changes a route on its own.

import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CAPABILITY_IDS, CAPABILITY_INFO, type CapabilityId, type RouteTarget, type TargetCheck } from '../domain/capability';
import { realmnestReadiness } from '../runtime/capabilities/readiness';
import type { TKey } from '../i18n';
import type { ProviderCapabilities } from '../runtime/providers/types';
import { useConnectionLabel } from './connections';
import { useCapabilities, useConnections, useServices, useT } from './context';
import { Button } from './kit';
import { ModelPicker } from './ModelPicker';

const ROUTABLE = CAPABILITY_IDS.filter((c) => CAPABILITY_INFO[c].routable);
// the best any adapter offers today, to say up front what RealmNest cannot run yet
const ANY_ADAPTER: ProviderCapabilities = { streaming: true, tools: false, toolCalling: true, vision: true, files: true, embeddings: true, sessions: true, local: false, usage: true, cost: true, cancellation: true, modelListing: true, systemPrompt: true };

// readiness notes (src/runtime/capabilities/readiness.ts) in the user's language
const NOTE_KEYS: Record<string, TKey> = {
  'the model reasons on its own; the effort level is set per chat and per agent where the model offers one': 's.ready.reasonsOwn',
  'this adapter does not stream': 's.ready.noStream',
  'RealmNest replays the conversation history instead': 's.ready.replays',
  'RealmNest does not send images through this adapter yet': 's.ready.noImages',
  'PDFs attach from the chat composer': 's.ready.pdfComposer',
  'RealmNest does not send PDFs through this adapter yet': 's.ready.noPdf',
  'tools run through RealmNest (permissions and approval)': 's.ready.toolsVia',
  'through the RealmNest MCP bridge: the model calls, RealmNest checks permissions and runs': 's.ready.toolBridge',
  'this adapter does not take RealmNest tools yet': 's.ready.noTools',
  'web search is not built yet': 's.ready.noWebSearch',
  'image generation is not built yet': 's.ready.noImageGen',
  'used by Knowledge bases set to hybrid search': 's.ready.embKnowledge',
  'this adapter does not create embeddings': 's.ready.noEmb',
  'used by Memory extraction when the model supports it': 's.ready.memoryExtract',
  'RealmNest does not request structured output through this adapter': 's.ready.noStructured',
  'no adapter for this connection': 's.ready.noAdapter',
  'no tool can run in this build': 's.ready.noRunnable',
  'the RealmNest MCP bridge runs only in the desktop app': 's.ready.bridgeDesktop',
};
export const readinessNote = (t: ReturnType<typeof useT>, note: string | undefined) => (note && NOTE_KEYS[note] ? t(NOTE_KEYS[note]) : (note ?? ''));

const FAILURES = ['CONNECTION_REMOVED', 'CONNECTION_UNAVAILABLE', 'CONNECTION_CHECKING', 'MODEL_UNAVAILABLE', 'MODEL_REQUIRED', 'CAPABILITY_UNSUPPORTED', 'NOT_READY'];

export function AICapabilities() {
  const t = useT();
  return (
    <div className="ai-caps">
      <p className="muted">
        {t('s.caps.intro1')} <b>{t('s.cap.text.chat')}</b>
        {t('s.caps.intro2')}
      </p>
      {ROUTABLE.map((cap) => (
        <CapabilityRoute key={cap} cap={cap} />
      ))}
    </div>
  );
}

function CapabilityRoute({ cap }: { cap: CapabilityId }) {
  const capabilities = useCapabilities();
  const t = useT();
  const targets = capabilities.targets(cap);
  const resolved = capabilities.resolveRoute(cap);
  const labelOf = useConnectionLabel();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const notReady = realmnestReadiness(cap, ANY_ADAPTER);
  const save = async (next: RouteTarget[]) => {
    setError('');
    try {
      await capabilities.setRoute(cap, next);
    } catch (err) {
      setError(String(err));
    }
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...targets];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    void save(next);
  };

  return (
    <section className="cap-route">
      <header>
        <div>
          <b>{t(`s.cap.${cap}` as TKey)}</b>
          <small>{t(`s.capd.${cap}` as TKey)}</small>
        </div>
        <span className={`route-state ${targets.length ? (resolved.ok ? 'ok' : 'bad') : 'none'}`}>
          {!targets.length
            ? t('s.caps.notConfigured')
            : resolved.ok
              ? t(resolved.source === 'fallback' ? 's.caps.inUseFallback' : 's.caps.inUse', { name: labelOf(resolved.target!.connectionId) })
              : FAILURES.includes(resolved.failure!)
                ? t(`s.caps.fail.${resolved.failure}` as TKey)
                : t('s.caps.unavailable')}
        </span>
      </header>
      {!notReady.ready && <p className="muted small">{t('s.caps.notReady', { note: readinessNote(t, notReady.note) })}</p>}
      {targets.length > 0 && (
        <ol className="route-targets">
          {resolved.checks.map((c, i) => (
            <TargetRow key={`${c.target.connectionId}-${c.target.modelId}-${i}`} cap={cap} check={c} first={i === 0} last={i === targets.length - 1} onUp={() => move(i, -1)} onDown={() => move(i, 1)} onRemove={() => void save(targets.filter((_, j) => j !== i))} />
          ))}
        </ol>
      )}
      {adding ? (
        <AddTarget cap={cap} onAdd={(x) => (void save([...targets, x]), setAdding(false))} onCancel={() => setAdding(false)} />
      ) : (
        <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setAdding(true)}>
          {targets.length ? t('s.caps.addFallback') : t('s.caps.setRoute')}
        </Button>
      )}
      {error && <p className="chat-error">{error}</p>}
    </section>
  );
}

function TargetRow({ cap, check, first, last, onUp, onDown, onRemove }: { cap: CapabilityId; check: TargetCheck; first: boolean; last: boolean; onUp: () => void; onDown: () => void; onRemove: () => void }) {
  const labelOf = useConnectionLabel();
  const connections = useConnections();
  const t = useT();
  const model = check.target.modelId ?? connections.get(check.target.connectionId)?.preferredModel;
  return (
    <li className={check.ok ? 'ok' : 'bad'}>
      <span className="route-rank">{first ? t('s.caps.primary') : t('s.caps.fallbackN', { n: check.index })}</span>
      <div className="route-what">
        <b>{labelOf(check.target.connectionId)}</b>
        <small>
          {model ?? t('s.caps.defaultModelLower')} · {check.support === 'supported' ? t('s.caps.supports', { cap: t(`s.cap.${cap}` as TKey).toLowerCase() }) : check.support === 'unknown' ? t('s.caps.supportUnknown') : t('s.caps.unsupported')}
        </small>
        <small className={check.ok ? 'route-ok' : 'route-bad'}>{check.ok ? `${t('s.caps.availableOk')}${check.reason ? ` · ${check.reason}` : ''}` : check.reason}</small>
      </div>
      <div className="route-actions">
        <button className="icon-btn" disabled={first} onClick={onUp} aria-label={t('s.moveUp')} title={t('s.moveUp')}>
          <ArrowUp size={13} />
        </button>
        <button className="icon-btn" disabled={last} onClick={onDown} aria-label={t('s.moveDown')} title={t('s.moveDown')}>
          <ArrowDown size={13} />
        </button>
        <button className="icon-btn" onClick={onRemove} aria-label={t('s.caps.removeTarget')} title={t('s.remove')}>
          <X size={13} />
        </button>
      </div>
    </li>
  );
}

function AddTarget({ cap, onAdd, onCancel }: { cap: CapabilityId; onAdd: (t: RouteTarget) => void; onCancel: () => void }) {
  const capabilities = useCapabilities();
  const connections = useConnections();
  const labelOf = useConnectionLabel();
  const t = useT();
  // only connections that may serve it (models filtered in the picker)
  const options = capabilities.connectionsFor(cap);
  const [connectionId, setConnectionId] = useState(options[0]?.id ?? '');
  const [modelId, setModelId] = useState('');
  const hasCatalog = connectionId ? connections.models(connectionId).length > 0 : false;
  if (!options.length) return <p className="muted small">{t('s.caps.noConnections')}</p>;
  return (
    <div className="route-add">
      <select value={connectionId} onChange={(e) => (setConnectionId(e.target.value), setModelId(''))} aria-label={t('s.caps.routeConnection')}>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {labelOf(c.id)}
          </option>
        ))}
      </select>
      {cap === 'embeddings.create' ? (
        <EmbeddingModelPicker connectionId={connectionId} value={modelId} onChange={setModelId} />
      ) : (
        <ModelPicker connectionId={connectionId} value={modelId} onChange={setModelId} capability={cap} autoLabel={hasCatalog ? t('s.caps.chooseModel') : t('s.caps.defaultModel')} />
      )}
      <Button size="sm" tone="primary" disabled={!connectionId || (cap === 'embeddings.create' ? !modelId : hasCatalog && !modelId && !connections.get(connectionId)?.preferredModel)} onClick={() => onAdd({ connectionId, ...(modelId && { modelId }) })}>
        {t('s.add')}
      </Button>
      <Button size="sm" tone="ghost" onClick={onCancel}>
        {t('s.cancel')}
      </Button>
    </div>
  );
}

/** embedding models are their own catalogue (never the chat models) */
function EmbeddingModelPicker({ connectionId, value, onChange }: { connectionId: string; value: string; onChange: (m: string) => void }) {
  const { embeddings } = useServices();
  const t = useT();
  const [models, setModels] = useState<{ id: string; name: string }[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setModels(null);
    setError('');
    embeddings
      .models(connectionId)
      .then((m) => live && setModels(m))
      .catch((e) => live && (setModels([]), setError(e instanceof Error ? e.message : String(e))));
    return () => {
      live = false;
    };
  }, [connectionId, embeddings]);
  return (
    <>
      <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={t('s.caps.embModel')}>
        <option value="">{models === null ? t('s.caps.embLoading') : models.length ? t('s.caps.embChoose') : t('s.caps.embNone')}</option>
        {(models ?? []).map((m) => (
          <option key={m.id} value={m.id}>
            {m.id}
          </option>
        ))}
      </select>
      {error && <small className="route-bad">{error}</small>}
    </>
  );
}
