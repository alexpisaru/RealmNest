// Debug › Providers: checks each registered model provider and runs a test
// turn through the universal provider layer. Developer tool only, not the
// agent UI; it reaches providers only through the user's AI connections and the contract.

import { Play, RefreshCw, Square } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { TKey } from '../i18n';
import type { ProviderRun } from '../runtime/providers/service';
import type { ProviderCapabilities, ProviderEvent, ProviderState, ProviderStatus } from '../runtime/providers/types';
import { processHostName } from '../platform';
import { useConnections, useServices, useT } from './context';
import { Button, Toggle } from './kit';
import { contextSummary, defaultModelLabel, ModelPicker, priceSummary } from './ModelPicker';

type T = ReturnType<typeof useT>;
const stateLabel = (t: T, s: ProviderState) => t(`s.prov.state.${s}` as TKey);

const CAPS: (keyof ProviderCapabilities)[] = ['streaming', 'tools', 'vision', 'sessions', 'local', 'usage', 'cost', 'cancellation', 'modelListing', 'systemPrompt'];

/** consecutive text.delta events shown as one row */
interface LogRow {
  key: number;
  type: string;
  count: number;
  info: string;
}

function summary(t: T, e: ProviderEvent): string {
  switch (e.type) {
    case 'provider.started':
      return e.model ?? '';
    case 'session.started':
      return `${e.sessionId.slice(0, 8)}… ${e.model ?? ''}${e.resumed ? ` ${t('s.prov.resumed')}` : ''}`;
    case 'message.started':
      return e.model ?? '';
    case 'text.delta':
      return JSON.stringify(e.text);
    case 'text.completed':
      return t('s.prov.chars', { n: e.text.length });
    case 'tool.requested':
      return e.name;
    case 'tool.started':
      return e.name;
    case 'tool.completed':
      return e.isError ? t('s.prov.evError') : 'ok';
    case 'search.results':
      return `${e.query ?? ''} → ${t('s.prov.results', { n: e.results.length })}`;
    case 'limits.updated':
      return e.limits.windows.map((w) => `${w.id} ${Math.round(w.utilization * 100)}%`).join(' · ');
    case 'usage.updated':
      return `in ${e.usage.inputTokens} · out ${e.usage.outputTokens}${e.costUsd !== undefined ? ` · $${e.costUsd.toFixed(4)}` : ''}${e.cumulative ? ` ${t('s.prov.total')}` : ''}`;
    case 'provider.error':
    case 'run.failed':
      return `${e.error.code}: ${e.error.message}`;
    case 'run.completed':
      return `${e.durationMs ?? '?'} ms · ${t('s.prov.turns', { n: e.turns ?? '?' })}`;
    case 'run.cancelled':
      return e.reason;
  }
}

export function ProvidersPanel() {
  const { providers } = useServices();
  const connections = useConnections();
  const t = useT();
  const list = connections.list();
  const [providerId, setProviderId] = useState(list[0]?.id ?? '');
  // the selected connection's adapter (the turn and status run on the connection id)
  const provider = providers.resolve(providerId);
  const connection = connections.get(providerId);
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [prompt, setPrompt] = useState(() => t('s.prov.defaultPrompt'));
  const [model, setModel] = useState('');
  const selectedModel = connections.models(providerId).find((m) => m.id === model);
  const [keepSession, setKeepSession] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [output, setOutput] = useState('');
  const [rows, setRows] = useState<LogRow[]>([]);
  const [result, setResult] = useState<ProviderEvent | null>(null);
  const [run, setRun] = useState<ProviderRun | null>(null);
  const live = useRef(true);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const check = async () => {
    if (!providerId) return;
    setChecking(true);
    const s = await providers.status(providerId);
    if (live.current) (setStatus(s), setChecking(false));
  };

  useEffect(() => {
    setStatus(null);
    setSessionId(null);
    void check();
  }, [providerId]);

  const onEvent = (e: ProviderEvent) => {
    if (!live.current) return;
    if (e.type === 'text.delta') setOutput((o) => o + e.text);
    if (e.type === 'run.completed') setOutput((o) => o || e.text);
    if (keepSession && (e.type === 'session.started' || (e.type === 'run.completed' && e.sessionId))) setSessionId(e.sessionId ?? null);
    if (e.type === 'run.completed' || e.type === 'run.failed' || e.type === 'run.cancelled') setResult(e);
    setRows((r) => {
      const last = r[r.length - 1];
      if (e.type === 'text.delta' && last?.type === 'text.delta') return [...r.slice(0, -1), { ...last, count: last.count + 1, info: t('s.prov.chunks', { n: last.count + 1 }) }];
      return [...r, { key: e.seq, type: e.type, count: 1, info: summary(t, e) }];
    });
  };

  const start = async () => {
    if (!provider || run) return;
    setOutput('');
    setRows([]);
    setResult(null);
    const session = keepSession ? (sessionId ? { mode: 'resume' as const, id: sessionId } : { mode: 'new' as const }) : undefined;
    const r = providers.run(providerId, { messages: [{ role: 'user', content: prompt }], model: model.trim() || undefined, session }, onEvent);
    setRun(r);
    await r.done;
    if (live.current) setRun(null);
  };

  const caps = useMemo(() => (provider ? CAPS.filter((c) => provider.capabilities[c]) : []), [provider]);
  const ready = status?.state === 'available';

  if (!provider) return <p className="muted">{t('s.prov.noConnections')}</p>;

  return (
    <div className="providers">
      {list.length > 1 && (
        <select value={providerId} onChange={(e) => setProviderId(e.target.value)} aria-label={t('s.prov.provider')}>
          {list.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
      <div className="prov-head">
        <b>{connection?.name ?? provider.name}</b>
        <span className={`prov-state ${status?.state ?? 'checking'}`}>{checking || !status ? t('s.prov.checking') : stateLabel(t, status.state)}</span>
        <button className="icon-btn" onClick={() => void check()} disabled={checking} title={t('s.prov.checkAgain')} aria-label={t('s.prov.checkAgain')}>
          <RefreshCw size={14} />
        </button>
      </div>
      {status && (
        <>
          <p className="prov-msg">{status.message}</p>
          {status.hint && <p className="prov-hint mono">{status.hint}</p>}
          <dl className="kv mono">
            <dt>{t('s.prov.kvProvider')}</dt>
            <dd>{provider.name}</dd>
            <dt>{t('s.prov.kvVersion')}</dt>
            <dd>{status.version ?? '—'}</dd>
            <dt>{t('s.prov.kvHost')}</dt>
            <dd>{processHostName()}</dd>
            {Object.entries(status.details ?? {}).map(([k, v]) => (
              <Detail key={k} k={k} v={v} />
            ))}
          </dl>
        </>
      )}
      <div className="prov-caps">
        {CAPS.map((c) => (
          <span key={c} className={caps.includes(c) ? 'on' : ''} title={caps.includes(c) ? t('s.prov.supported') : t('s.prov.notSupported')}>
            {c}
          </span>
        ))}
      </div>

      <h4>{t('s.prov.testTurn')}</h4>
      <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={3} aria-label={t('s.prov.testPrompt')} placeholder={t('s.prov.testPromptPh')} />
      <ModelPicker connectionId={providerId} value={model} onChange={setModel} autoLabel={defaultModelLabel(connection?.preferredModel, connections.models(providerId).length > 0, t)} />
      {selectedModel && (
        <p className="muted small mono">
          {selectedModel.id}
          {contextSummary(selectedModel.contextLength) ? ` · ${contextSummary(selectedModel.contextLength)}` : ''}
          {priceSummary(selectedModel, t) ? ` · ${priceSummary(selectedModel, t)}` : ''}
          {selectedModel.inputModalities?.length ? ` · in: ${selectedModel.inputModalities.join(', ')}` : ''}
          {selectedModel.supportedParameters?.length ? ` · ${t('s.prov.paramsLabel')}: ${selectedModel.supportedParameters.slice(0, 8).join(', ')}` : ''}
        </p>
      )}
      {provider.capabilities.sessions && (
        <Toggle
          on={keepSession}
          onChange={(v) => (setKeepSession(v), v || setSessionId(null))}
          label={t('s.prov.keepSession')}
          sub={sessionId ? t('s.prov.sessionResume', { id: `${sessionId.slice(0, 8)}…` }) : t('s.prov.sessionSub')}
        />
      )}
      <div className="row">
        {run ? (
          <Button tone="danger" icon={<Square size={14} />} onClick={() => void run.cancel()}>
            {t('s.cancel')}
          </Button>
        ) : (
          <Button tone="primary" icon={<Play size={14} />} onClick={() => void start()} disabled={!prompt.trim()} title={ready ? undefined : t('s.prov.notAvailableRun')}>
            {t('s.prov.run')}
          </Button>
        )}
        {run && <span className="muted">{t('s.prov.running')}</span>}
      </div>

      <h4>{t('s.prov.output')}</h4>
      <pre className="prov-out" aria-live="polite">{output || (run ? '…' : '—')}</pre>
      {result?.type === 'run.failed' && (
        <div className="prov-error">
          <b>{result.error.message}</b>
          {result.error.detail && <pre>{result.error.detail}</pre>}
        </div>
      )}
      {result?.type === 'run.cancelled' && <p className="muted">{t('s.prov.cancelled')}</p>}
      {result?.type === 'run.completed' && (
        <p className="prov-ok mono">
          {t('s.prov.completed')} · {result.durationMs ?? '?'} ms{result.usage ? ` · ${t('s.prov.tokens', { in: result.usage.inputTokens + (result.usage.cacheReadTokens ?? 0), out: result.usage.outputTokens })}` : ''}
          {result.costUsd !== undefined ? ` · $${result.costUsd.toFixed(4)}` : ''}
        </p>
      )}

      <h4>{t('s.prov.events')}</h4>
      <ul className="prov-events">
        {rows.length === 0 && <li className="muted">{t('s.prov.noEvents')}</li>}
        {rows.map((r) => (
          <li key={r.key} className={r.type.startsWith('run.') || r.type === 'provider.error' ? `t-${r.type.replace('.', '-')}` : ''}>
            <code>
              {r.type}
              {r.count > 1 ? ` ×${r.count}` : ''}
            </code>
            <span>{r.info}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Detail({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt>{k}</dt>
      <dd title={v}>{v}</dd>
    </>
  );
}
