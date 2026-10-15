// Settings › AI Connections: the user's connections and the providers they can
// connect. Every form is generated from the provider catalogue (methods and
// fields); nothing here knows a specific provider. Secrets are typed once and
// sent to the OS credential store; they are never shown or kept in the page.

import { ListRestart, Plug, RefreshCw, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { CAPABILITY_IDS, type CapabilityId } from '../domain/capability';
import type { AIConnection } from '../domain/connection';
import type { ConnectionField, ConnectionMethodSpec, ProviderDefinition } from '../runtime/connections/catalog';
import { ConnectionError } from '../runtime/connections/manager';
import { ConnectionStatusBadge } from './connections';
import type { TKey } from '../i18n';
import { useApp, useCapabilities, useChat, useConnections, useLive, useT } from './context';
import { Button } from './kit';
import { ModelPicker } from './ModelPicker';
import { ClaudeAccountActions } from './ClaudeAccount';
import { ConnectionUsage } from './usage/UsageRing';

/** the account line ("Claude account · max", "API key · free tier") is stored in English: shown in the user's language */
const ACCOUNT_PARTS: Record<string, TKey> = { 'Claude account': 's.acct.claude', 'ChatGPT account': 's.acct.chatgpt', ChatGPT: 's.acct.chatgpt', 'API key': 's.acct.apiKey', 'free tier': 's.acct.free', paid: 's.acct.paid', 'local (no key)': 's.acct.local' };
const accountText = (t: (k: TKey) => string, account: string) =>
  account
    .split(' · ')
    .map((p) => (ACCOUNT_PARTS[p] ? t(ACCOUNT_PARTS[p]) : p))
    .join(' · ');

const MAX_CHIPS = 4;

type T = ReturnType<typeof useT>;
/** catalogue texts (provider, method, field) by id, falling back to the catalogue's English */
const tOr = (t: T, key: string, fallback: string | undefined) => {
  const v = t(key as TKey);
  return v === key ? fallback : v;
};

/** an account (Claude, ChatGPT) or this PC's Ollama: once connected, no longer offered (API keys can be added again) */
const ONCE = new Set(['claude-code', 'codex', 'ollama']);

export function AIConnections() {
  const connections = useConnections();
  const [adding, setAdding] = useState<ProviderDefinition | null>(null);
  const active = connections.list();
  const t = useT();
  return (
    <div className="ai-conns">
      <p className="muted">{t('s.conn.intro')}</p>
      <h3>{t('s.conn.connected')}</h3>
      {active.length === 0 && <p className="muted small">{t('s.conn.none')}</p>}
      <div className="conn-list">
        {active.map((c) => (
          <ConnectionCard key={c.id} c={c} />
        ))}
      </div>

      <h3>{t('s.conn.available')}</h3>
      {adding ? (
        <AddConnection def={adding} onDone={() => setAdding(null)} />
      ) : (
        <div className="provider-grid">
          {connections
            .catalog.list()
            .filter((d) => !(ONCE.has(d.id) && active.some((c) => c.providerId === d.id)))
            .map((d) => (
            <div key={d.id} className={`provider-card ${d.availability}`}>
              <div>
                <b>{d.name}</b>
                <small>{d.vendor}</small>
              </div>
              <p>{tOr(t, `s.prov.${d.id}.desc`, d.description)}</p>
              {d.availability === 'available' ? (
                <Button size="sm" icon={<Plug size={14} />} onClick={() => setAdding(d)}>
                  {t('s.conn.connect')}
                </Button>
              ) : (
                <span className="soon">{t('s.conn.soon')}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectionCard({ c }: { c: AIConnection }) {
  const connections = useConnections();
  const live = useLive();
  const chat = useChat();
  const capabilities = useCapabilities();
  const st = useApp();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const def = connections.catalog.get(c.providerId);
  const method = def?.methods.find((m) => m.id === c.method);
  // connection-level claims only; per-model details are in Debug › Capabilities
  const caps = CAPABILITY_IDS.filter((k) => c.capabilities?.[k]?.support === 'supported');
  const agents = live.agentsOn(c.id).map((id) => st.characters.find((x) => x.id === id)?.name ?? id);
  const chats = chat.list().filter((x) => x.connectionId === c.id).length;
  // routes are not rewritten on removal: say which ones will report it
  const routes = Object.entries(capabilities.policy().routes)
    .filter(([, targets]) => targets?.some((x) => x.connectionId === c.id))
    .map(([cap]) => t(`s.cap.${cap as CapabilityId}` as TKey));

  const run = async (fn: () => Promise<unknown>) => {
    setError('');
    try {
      await fn();
    } catch (err) {
      setError(err instanceof ConnectionError ? err.message : String(err));
    }
  };

  // "Anthropic" for a connection named like its provider, else the provider's name
  const provider = !def ? c.providerId : c.name === def.name || def.vendor === def.name ? def.vendor : `${def.name} · ${def.vendor}`;
  const shown = caps.slice(0, MAX_CHIPS);

  return (
    <div className="conn-card">
      <div className="conn-head">
        <div className="conn-id">
          <small className="conn-provider">{provider}</small>
          <b>{c.name}</b>
          {c.account && <small>{accountText(t, c.account)}</small>}
        </div>
        <ConnectionStatusBadge c={c} />
      </div>
      <div className="conn-meta">
        <span title={t('s.conn.preferredModel')}>
          <em>{t('s.conn.model')}</em> {c.preferredModel ?? t('s.conn.automatic')}
        </span>
        {c.modelCatalog && (
          <span title={t('s.conn.catalogUpdated', { date: new Date(c.modelCatalog.fetchedAt).toLocaleDateString() })}>
            <em>{t('s.conn.catalog')}</em> {t('s.conn.models', { n: c.modelCatalog.count })}
          </span>
        )}
        {c.version && (
          <span>
            <em>{t('s.conn.version')}</em> {c.version}
          </span>
        )}
      </div>
      {c.status !== 'connected' && c.statusMessage && c.status !== 'checking' && (
        <p className="conn-msg">
          {c.statusMessage}
          {c.statusHint && <code>{c.statusHint}</code>}
        </p>
      )}
      {caps.length > 0 && (
        <div className="conn-caps" aria-label={t('s.conn.caps')}>
          {shown.map((k) => (
            <span key={k} title={`${c.capabilities?.[k]?.source.origin}: ${c.capabilities?.[k]?.source.evidence ?? ''}`}>
              {t(`s.cap.${k}` as TKey)}
            </span>
          ))}
          {caps.length > shown.length && <span title={caps.slice(MAX_CHIPS).map((k) => t(`s.cap.${k}` as TKey)).join(', ')}>+{caps.length - shown.length}</span>}
        </div>
      )}
      <ConnectionUsage connectionId={c.id} />
      <div className="conn-actions">
        {c.providerId === 'claude-code' && <ClaudeAccountActions c={c} onError={setError} />}
        {c.providerId === 'codex' && <ClaudeAccountActions c={c} onError={setError} brand="ChatGPT" />}
        <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => void run(() => connections.validate(c.id))} disabled={c.status === 'checking'}>
          {t('s.conn.test')}
        </Button>
        {c.status === 'connected' && connections.provider(c.id)?.capabilities.modelListing && (
          <Button size="sm" icon={<ListRestart size={14} />} onClick={() => void run(() => connections.refreshModels(c.id))}>
            {t('s.conn.refreshModels')}
          </Button>
        )}
        <Button size="sm" tone="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? t('s.close') : t('s.manage')}
        </Button>
      </div>

      {open && (
        <div className="conn-manage">
          <label>
            <span>{t('s.name')}</span>
            <input defaultValue={c.name} onBlur={(e) => e.target.value !== c.name && void run(() => connections.update(c.id, { name: e.target.value }))} />
          </label>
          <label>
            <span>{t('s.conn.preferredModel')}</span>
            <ModelPicker connectionId={c.id} value={c.preferredModel} autoLabel={connections.models(c.id).length ? t('s.conn.modelNone') : t('s.conn.modelAuto')} onChange={(m) => void run(() => connections.update(c.id, { preferredModel: m }))} />
          </label>
          {method && <p className="muted small">{tOr(t, `s.prov.${c.providerId}.${method.id}`, method.label)}</p>}
          {method?.fields
            .filter((f) => f.kind !== 'secret')
            .map((f) => (
              <label key={f.key}>
                <span>{tOr(t, `s.prov.${c.providerId}.${f.key}`, f.label)}</span>
                <input
                  defaultValue={c.config[f.key] ?? ''}
                  placeholder={tOr(t, `s.prov.${c.providerId}.${f.key}.ph`, f.placeholder)}
                  onBlur={(e) => e.target.value.trim() !== (c.config[f.key] ?? '') && void run(() => connections.update(c.id, { config: { ...c.config, [f.key]: e.target.value } }))}
                />
                {f.help && <small className="muted">{tOr(t, `s.prov.${c.providerId}.${f.key}.help`, f.help)}</small>}
              </label>
            ))}
          {c.secretNames.length > 0 && <p className="muted small">{t('s.conn.secrets')}</p>}
          {!confirm ? (
            <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
              {t('s.conn.remove')}
            </Button>
          ) : (
            <div className="conn-confirm">
              <p>
                {t('s.conn.removeAsk')} <b>{c.name}</b>?{' '}
                {agents.length || chats
                  ? t('s.conn.usedBy', {
                      list: [
                        agents.length ? t(agents.length > 1 ? 's.conn.usedAgents' : 's.conn.usedAgent', { n: agents.length, names: agents.join(', ') }) : '',
                        chats ? t(chats > 1 ? 's.conn.usedChats' : 's.conn.usedChat', { n: chats }) : '',
                      ]
                        .filter(Boolean)
                        .join(t('s.and')),
                    })
                  : routes.length
                    ? ''
                    : t('s.conn.unused')}
                {routes.length > 0 && ` ${t(routes.length > 1 ? 's.conn.inRoutes' : 's.conn.inRoute', { routes: routes.join(', ') })}`}
              </p>
              <div className="row">
                <Button size="sm" tone="danger" onClick={() => void run(() => connections.remove(c.id))}>
                  {t('s.remove')}
                </Button>
                <Button size="sm" tone="ghost" onClick={() => setConfirm(false)}>
                  {t('s.conn.keep')}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="chat-error">{error}</p>}
    </div>
  );
}

function AddConnection({ def, onDone }: { def: ProviderDefinition; onDone: () => void }) {
  const connections = useConnections();
  const t = useT();
  const [method, setMethod] = useState<ConnectionMethodSpec | undefined>(def.methods[0]);
  const count = connections.list().filter((c) => c.providerId === def.id).length;
  const [name, setName] = useState(count ? `${def.name} ${count + 1}` : def.name);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!method) return;
    setError('');
    setSaving(true);
    try {
      await connections.create({ providerId: def.id, method: method.id, name, values });
      setValues({}); // never keep a typed secret around
      onDone();
    } catch (err) {
      setError(err instanceof ConnectionError ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="conn-card conn-add">
      <div className="conn-head">
        <div>
          <b>{t('s.conn.connectName', { name: def.name })}</b>
          <small>{def.vendor}</small>
        </div>
      </div>
      {def.methods.length > 1 && (
        <label>
          <span>{t('s.conn.how')}</span>
          <select value={method?.id} onChange={(e) => setMethod(def.methods.find((m) => m.id === e.target.value))}>
            {def.methods.map((m) => (
              <option key={m.id} value={m.id}>
                {tOr(t, `s.prov.${def.id}.${m.id}`, m.label)}
              </option>
            ))}
          </select>
        </label>
      )}
      {method && <p className="muted small">{tOr(t, `s.prov.${def.id}.${method.id}.desc`, method.description)}</p>}
      <label>
        <span>{t('s.conn.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('s.conn.namePh')} />
      </label>
      {method?.fields.map((f) => (
        <Field key={f.key} f={f} providerId={def.id} value={values[f.key] ?? ''} onChange={(v) => setValues((x) => ({ ...x, [f.key]: v }))} />
      ))}
      <div className="row">
        <Button size="sm" tone="primary" onClick={() => void save()} disabled={saving || !name.trim()}>
          {saving ? t('s.saving') : t('s.conn.saveTest')}
        </Button>
        <Button size="sm" tone="ghost" onClick={onDone}>
          {t('s.cancel')}
        </Button>
      </div>
      {error && <p className="chat-error">{error}</p>}
    </div>
  );
}

function Field({ f, providerId, value, onChange }: { f: ConnectionField; providerId: string; value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <label>
      <span>
        {tOr(t, `s.prov.${providerId}.${f.key}`, f.label)}
        {f.required ? '' : ` ${t('s.optional')}`}
      </span>
      <input type={f.kind === 'secret' ? 'password' : f.kind === 'url' ? 'url' : 'text'} autoComplete="off" spellCheck={false} value={value} placeholder={tOr(t, `s.prov.${providerId}.${f.key}.ph`, f.placeholder)} onChange={(e) => onChange(e.target.value)} />
      {f.help && <small className="muted">{tOr(t, `s.prov.${providerId}.${f.key}.help`, f.help)}</small>}
    </label>
  );
}
