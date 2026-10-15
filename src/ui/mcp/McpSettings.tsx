// Settings › Integrations › MCP: the user's MCP servers. Add one (executable +
// argument list, never a command string), connect it, and turn on the tools
// agents and chats may use. Statuses are the manager's, i.e. the real process.

import { LogIn, LogOut, Plug, PlugZap, Plus, RefreshCw, Settings2, Trash2, Unplug } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { McpServerConfig, McpServerStatus } from '../../domain/mcp';
import type { TKey } from '../../i18n';
import { resolvePermission } from '../../runtime/tools/policy';
import { MAX_OFFERED_TOOLS } from '../../runtime/tools/service';
import type { McpServerInput } from '../../runtime/mcp/manager';
import { mcpRisk, mcpToolId } from '../../runtime/mcp/normalize';
import { useMcp, useT, useTools } from '../context';
import { Button, Segmented } from '../kit';
import { PermissionSelect } from '../tools/ToolCalls';

/** status → the dot colour classes the connection cards already use */
const DOT: Record<McpServerStatus, string> = {
  connected: 'connected',
  starting: 'checking',
  failed: 'error',
  unavailable: 'unavailable',
  auth_required: 'auth_required',
  stopped: 'idle',
  disconnected: 'idle',
};

export function McpStatusBadge({ status, error }: { status: McpServerStatus; error?: string }) {
  const t = useT();
  return (
    <span className={`conn-status ${DOT[status]}`} title={error}>
      <i /> {t(`mcp.status.${status}` as TKey)}
    </span>
  );
}

export function McpSettings() {
  const t = useT();
  const mcp = useMcp();
  const [adding, setAdding] = useState(false);
  const servers = mcp.list();

  return (
    <div className="ai-conns mcp-settings">
      <h3>{t('mcp.title')}</h3>
      <p className="muted">{t('mcp.sub')}</p>
      {!mcp.available && <p className="conn-msg">{t('mcp.browser')}</p>}
      {servers.length === 0 && !adding && <p className="muted small">{t('mcp.empty')}</p>}
      <div className="conn-list">
        {servers.map((c) => (
          <McpServerCard key={c.id} c={c} />
        ))}
      </div>
      {adding ? (
        <McpServerForm onDone={() => setAdding(false)} />
      ) : (
        <Button icon={<Plus size={14} />} onClick={() => setAdding(true)} disabled={!mcp.available}>
          {t('mcp.add')}
        </Button>
      )}
    </div>
  );
}

function McpServerCard({ c }: { c: McpServerConfig }) {
  const t = useT();
  const mcp = useMcp();
  const st = mcp.state(c.id);
  const [open, setOpen] = useState<'tools' | 'edit' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const run = async (f: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await f();
    } finally {
      setBusy(false);
    }
  };
  const live = st.status === 'connected' || st.status === 'starting';

  return (
    <div className="conn-card mcp-card">
      <div className="conn-head">
        <div className="conn-id">
          <small className="conn-provider">{c.transport === 'http' ? t('mcp.kindOnline') : t('mcp.kindLocal')}</small>
          <b>{c.name}</b>
          <small className="mono">{c.transport === 'http' ? c.url : `${c.command.split(/[\\/]/).pop()} ${c.args.join(' ').slice(0, 80)}`}</small>
        </div>
        <McpStatusBadge status={st.status} error={st.error} />
      </div>
      <div className="conn-meta">
        <span>
          <em>{t('mcp.tools')}</em>{' '}
          {st.tools.length
            ? t('mcp.toolsCount', {
                n: st.tools.length,
                on: c.enabledTools.filter((n) => st.tools.some((x) => x.name === n)).length,
              })
            : t('mcp.toolsUnknown')}
        </span>
        {st.serverInfo?.version && (
          <span>
            <em>{t('mcp.info.server')}</em> {st.serverInfo.name ?? ''} {st.serverInfo.version}
          </span>
        )}
        {st.protocolVersion && (
          <span>
            <em>{t('mcp.info.protocol')}</em> {st.protocolVersion}
          </span>
        )}
        <span>
          <em>{t('mcp.form.startup')}</em> {t(`mcp.startup.${c.startup}` as TKey)}
        </span>
        <span>
          {c.lastConnectedAt
            ? t('mcp.lastConnected', {
                when: new Date(c.lastConnectedAt).toLocaleString(),
              })
            : t('mcp.never')}
        </span>
      </div>
      {st.error && st.status !== 'connected' && <p className="conn-msg">{st.error}</p>}
      {st.status === 'connected' && st.tools.length > 0 && !c.enabledTools.some((n) => st.tools.some((x) => x.name === n)) && <p className="conn-msg">{t('mcp.noneOn')}</p>}
      <div className="conn-actions">
        {c.transport === 'http' && c.oauth && st.status === 'auth_required' && (
          <Button size="sm" tone="primary" icon={<LogIn size={14} />} onClick={() => void run(() => mcp.signIn(c.id))} disabled={busy || !mcp.available}>
            {t('mcp.signIn')}
          </Button>
        )}
        {!live ? (
          <Button size="sm" icon={<Plug size={14} />} onClick={() => void run(() => mcp.connect(c.id))} disabled={busy || !mcp.available}>
            {t('mcp.connect')}
          </Button>
        ) : (
          <Button size="sm" icon={<Unplug size={14} />} onClick={() => void run(() => mcp.disconnect(c.id))} disabled={busy}>
            {t('mcp.disconnect')}
          </Button>
        )}
        <Button size="sm" icon={<RefreshCw size={14} />} onClick={() => void run(() => mcp.restart(c.id))} disabled={busy || !mcp.available}>
          {t('mcp.restart')}
        </Button>
        {c.transport === 'http' && c.oauth && st.status === 'connected' && (
          <Button size="sm" tone="ghost" icon={<LogOut size={14} />} onClick={() => void run(() => mcp.signOut(c.id))} disabled={busy}>
            {t('mcp.signOut')}
          </Button>
        )}
        <Button size="sm" tone="ghost" icon={<Settings2 size={14} />} onClick={() => setOpen(open === 'tools' ? null : 'tools')}>
          {open === 'tools' ? t('mcp.close') : t('mcp.manage')}
        </Button>
      </div>

      {open === 'tools' && (
        <div className="conn-manage mcp-manage">
          <McpServerTools c={c} />
          <dl className="mcp-info">
            {st.executable && (
              <>
                <dt>{t('mcp.info.executable')}</dt>
                <dd className="mono">{st.executable}</dd>
              </>
            )}
            <dt>{t('mcp.info.source')}</dt>
            <dd>{c.origin === 'user' ? t('mcp.userAdded') : 'RealmNest'}</dd>
            {st.instructions && (
              <>
                <dt>{t('mcp.info.instructions')}</dt>
                <dd className="mcp-instructions">{st.instructions}</dd>
              </>
            )}
          </dl>
          <div className="row">
            <Button size="sm" icon={<Settings2 size={14} />} onClick={() => setOpen('edit')}>
              {t('mcp.form.edit')}
            </Button>
            {!confirm ? (
              <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
                {t('mcp.delete')}
              </Button>
            ) : (
              <div className="conn-confirm">
                <p>{t('mcp.deleteConfirm', { name: c.name })}</p>
                <div className="row">
                  <Button size="sm" tone="danger" onClick={() => void run(() => mcp.remove(c.id))}>
                    {t('mcp.delete')}
                  </Button>
                  <Button size="sm" tone="ghost" onClick={() => setConfirm(false)}>
                    {t('mcp.form.cancel')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {open === 'edit' && <McpServerForm server={c} onDone={() => setOpen('tools')} />}
    </div>
  );
}

/** the server's discovered tools: search, turn on/off, permission */
function McpServerTools({ c }: { c: McpServerConfig }) {
  const t = useT();
  const mcp = useMcp();
  const tools = useTools();
  const st = mcp.state(c.id);
  const [q, setQ] = useState('');
  const policy = tools.policy.get();
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return st.tools.filter((x) => !needle || x.name.toLowerCase().includes(needle) || (x.description ?? '').toLowerCase().includes(needle));
  }, [st.tools, q]);
  const enabled = new Set(c.enabledTools);
  const onCount = st.tools.filter((x) => enabled.has(x.name)).length;

  if (!st.tools.length) return <p className="muted small">{t('mcp.noTools')}</p>;
  return (
    <div className="mcp-tools">
      <div className="mcp-tools-head">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('mcp.search')} aria-label={t('mcp.search')} />
        <Button
          size="sm"
          onClick={() =>
            void mcp.setTools(
              c.id,
              list.map((x) => x.name),
              true,
            )
          }
        >
          {t('mcp.enableAll')}
        </Button>
        <Button
          size="sm"
          tone="ghost"
          onClick={() =>
            void mcp.setTools(
              c.id,
              list.map((x) => x.name),
              false,
            )
          }
        >
          {t('mcp.disableAll')}
        </Button>
      </div>
      {onCount > MAX_OFFERED_TOOLS && <p className="conn-msg">{t('mcp.manyOn', { n: onCount, max: MAX_OFFERED_TOOLS })}</p>}
      <ul className="tool-list mcp-tool-list">
        {list.map((x) => {
          const id = mcpToolId(c.key, x.name);
          const on = enabled.has(x.name);
          const def = tools.registry.get(id);
          const claim = x.annotations?.readOnlyHint ? t('mcp.readOnly') : x.annotations?.destructiveHint ? t('mcp.destructive') : '';
          return (
            <li key={x.name} className={on ? 'on' : ''}>
              <label className="tool-check">
                <input type="checkbox" checked={on} onChange={(e) => void mcp.setTools(c.id, [x.name], e.target.checked)} />
                <span className="tool-name">
                  <code>{x.name}</code>
                  <small title={x.description}>
                    {(x.description ?? x.title ?? '').slice(0, 140)}
                    {claim && ` · ${claim}`}
                  </small>
                </span>
              </label>
              {on && (
                <PermissionSelect value={policy.global[id]} fallback={def ? resolvePermission(def, {}) : mcpRisk(x) === 'low' ? 'allow' : 'ask'} onChange={(p) => void tools.policy.setGlobal(id, p)} label={`${t('tools.permission')} ${x.name}`} />
              )}
            </li>
          );
        })}
      </ul>
      {st.skipped.length > 0 && (
        <details className="mcp-skipped">
          <summary>
            {t('mcp.skipped')} ({st.skipped.length})
          </summary>
          <ul>
            {st.skipped.map((s) => (
              <li key={s.name}>
                <code>{s.name}</code> {s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** "NAME=value" lines → a map (undefined + the bad line when one is malformed) */
function parseEnv(text: string): { env: Record<string, string>; bad?: string } {
  const env: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const i = line.indexOf('=');
    if (i <= 0) return { env, bad: line };
    env[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return { env };
}

function McpServerForm({ server, onDone }: { server?: McpServerConfig; onDone: () => void }) {
  const t = useT();
  const mcp = useMcp();
  const [kind, setKind] = useState<McpServerConfig['transport']>(server?.transport ?? 'http');
  const [name, setName] = useState(server?.name ?? '');
  const [url, setUrl] = useState(server?.url ?? '');
  const [oauth, setOauth] = useState(!!server?.oauth);
  const [headers, setHeaders] = useState<{ name: string; value: string }[]>((server?.secretHeaders ?? []).map((n) => ({ name: n, value: '' })));
  const [command, setCommand] = useState(server?.command ?? '');
  const [args, setArgs] = useState(server?.args.join('\n') ?? '');
  const [cwd, setCwd] = useState(server?.workingDirectory ?? '');
  const [env, setEnv] = useState(
    Object.entries(server?.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
  );
  const [secrets, setSecrets] = useState<{ name: string; value: string }[]>((server?.secretEnv ?? []).map((n) => ({ name: n, value: '' })));
  const [stored, setStored] = useState<Record<string, boolean>>({});
  const [startup, setStartup] = useState<McpServerConfig['startup']>(server?.startup ?? 'manual');
  const [timeout, setTimeoutS] = useState(String(Math.round((server?.toolTimeoutMs ?? 120_000) / 1000)));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const online = kind === 'http';

  useEffect(() => {
    if (server) void mcp.secretStatus(server.id).then(setStored);
  }, [mcp, server]);

  const save = async (connect: boolean) => {
    setError('');
    const parsed = parseEnv(env);
    if (!online && parsed.bad) return setError(t('mcp.form.badEnv', { line: parsed.bad.slice(0, 60) }));
    const named = secrets.filter((s) => s.name.trim());
    const hdrs = headers.filter((h) => h.name.trim());
    const common = { name, startup, toolTimeoutMs: Math.round(Number(timeout) * 1000) || 120_000 };
    const input: McpServerInput = online
      ? {
          ...common,
          transport: 'http',
          url: url.trim(),
          headers: {},
          secretHeaders: hdrs.map((h) => h.name.trim()),
          secretHeaderValues: Object.fromEntries(hdrs.filter((h) => h.value).map((h) => [h.name.trim(), h.value])),
          oauth,
          command: '',
          args: [],
          env: {},
          secretEnv: [],
        }
      : {
          ...common,
          command,
          args: args
            .split('\n')
            .map((a) => a.trim())
            .filter(Boolean),
          workingDirectory: cwd,
          env: parsed.env,
          secretEnv: named.map((s) => s.name.trim()),
          secretValues: Object.fromEntries(named.filter((s) => s.value).map((s) => [s.name.trim(), s.value])),
        };
    setBusy(true);
    try {
      const id = server ? (await mcp.update(server.id, input), server.id) : (await mcp.add(input)).id;
      // OAuth: the browser sign-in comes first, then the connection
      if (connect) void (online && oauth && !(await mcp.signedIn(id)) ? mcp.signIn(id) : mcp.connect(id));
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="mcp-form" onSubmit={(e) => (e.preventDefault(), void save(true))}>
      <h4>{server ? t('mcp.form.titleEdit', { name: server.name }) : t('mcp.form.titleNew')}</h4>
      {!server && (
        <Segmented
          value={kind}
          onChange={setKind}
          label={t('mcp.form.kind')}
          options={[
            { value: 'http', label: t('mcp.form.kindHttp') },
            { value: 'stdio', label: t('mcp.form.kindStdio') },
          ]}
        />
      )}
      <label className="field-stack">
        <span>{t('mcp.form.name')}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={online ? 'Figma' : 'PhotoCraft'} required maxLength={60} />
      </label>
      {online ? (
        <>
          <label className="field-stack">
            <span>{t('mcp.form.url')}</span>
            <input className="mono" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://mcp.example.com/mcp" required spellCheck={false} />
            <small className="muted">{t('mcp.form.urlSub')}</small>
          </label>
          <label className="tool-check">
            <input type="checkbox" checked={oauth} onChange={(e) => setOauth(e.target.checked)} />
            <span>{t('mcp.form.oauth')}</span>
          </label>
          <small className="muted">{t('mcp.form.oauthSub')}</small>
          <div className="field-stack">
            <span>{t('mcp.form.headers')}</span>
            {headers.map((h, i) => (
              <div className="mcp-secret" key={i}>
                <input className="mono" value={h.name} onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Authorization" aria-label={t('mcp.form.headers')} spellCheck={false} />
                <input
                  type="password"
                  value={h.value}
                  onChange={(e) => setHeaders(headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder={stored[h.name] ? `•••• (${t('mcp.form.secretSaved')})` : 'Bearer …'}
                  autoComplete="new-password"
                  aria-label={t('s.mcp.valueOf', { name: h.name })}
                />
                <Button size="sm" tone="ghost" onClick={() => setHeaders(headers.filter((_, j) => j !== i))}>
                  {t('mcp.form.remove')}
                </Button>
              </div>
            ))}
            <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setHeaders([...headers, { name: '', value: '' }])}>
              {t('mcp.form.addHeader')}
            </Button>
            <small className="muted">{t('mcp.form.headersSub')}</small>
          </div>
        </>
      ) : (
        <>
          <label className="field-stack">
            <span>{t('mcp.form.command')}</span>
            <input className="mono" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="C:\Program Files\PhotoCraft\photocraft-cli.exe" required spellCheck={false} />
            <small className="muted">{t('mcp.form.commandSub')}</small>
          </label>
          <label className="field-stack">
            <span>{t('mcp.form.args')}</span>
            <textarea className="mono" rows={4} value={args} onChange={(e) => setArgs(e.target.value)} placeholder={'mcp\n--automation-read-root\nC:\\Users\\…\\Pictures'} spellCheck={false} />
            <small className="muted">{t('mcp.form.argsSub')}</small>
          </label>
          <label className="field-stack">
            <span>{t('mcp.form.cwd')}</span>
            <input className="mono" value={cwd} onChange={(e) => setCwd(e.target.value)} spellCheck={false} />
          </label>
          <label className="field-stack">
            <span>{t('mcp.form.env')}</span>
            <textarea className="mono" rows={2} value={env} onChange={(e) => setEnv(e.target.value)} placeholder="LOG_LEVEL=info" spellCheck={false} />
            <small className="muted">{t('mcp.form.envSub')}</small>
          </label>
          <div className="field-stack">
            <span>{t('mcp.form.secrets')}</span>
            {secrets.map((s, i) => (
              <div className="mcp-secret" key={i}>
                <input className="mono" value={s.name} onChange={(e) => setSecrets(secrets.map((x, j) => (j === i ? { ...x, name: e.target.value.toUpperCase() } : x)))} placeholder="API_TOKEN" aria-label={t('mcp.form.secrets')} spellCheck={false} />
                <input
                  type="password"
                  value={s.value}
                  onChange={(e) => setSecrets(secrets.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder={stored[s.name] ? `•••• (${t('mcp.form.secretSaved')})` : t('mcp.form.secretMissing')}
                  autoComplete="new-password"
                  aria-label={t('s.mcp.valueOf', { name: s.name })}
                />
                <Button size="sm" tone="ghost" onClick={() => setSecrets(secrets.filter((_, j) => j !== i))}>
                  {t('mcp.form.remove')}
                </Button>
              </div>
            ))}
            <Button size="sm" tone="ghost" icon={<Plus size={14} />} onClick={() => setSecrets([...secrets, { name: '', value: '' }])}>
              {t('mcp.form.addSecret')}
            </Button>
            <small className="muted">{t('mcp.form.secretsSub')}</small>
          </div>
        </>
      )}
      <div className="mcp-form-row">
        <label className="field-stack">
          <span>{t('mcp.form.startup')}</span>
          <select value={startup} onChange={(e) => setStartup(e.target.value as McpServerConfig['startup'])}>
            <option value="manual">{t('mcp.startup.manual')}</option>
            <option value="auto">{t('mcp.startup.auto')}</option>
          </select>
        </label>
        <label className="field-stack">
          <span>{t('mcp.form.timeout')}</span>
          <input type="number" min={1} max={1800} value={timeout} onChange={(e) => setTimeoutS(e.target.value)} />
        </label>
      </div>
      {!online && (
        <p className="muted small">
          <PlugZap size={13} /> {t('mcp.native')}
        </p>
      )}
      {error && <p className="chat-error">{error}</p>}
      <div className="row">
        <Button type="submit" tone="primary" disabled={busy}>
          {online && oauth ? t('mcp.form.saveSignIn') : t('mcp.form.saveConnect')}
        </Button>
        <Button onClick={() => void save(false)} disabled={busy}>
          {t('mcp.form.save')}
        </Button>
        <Button tone="ghost" onClick={onDone}>
          {t('mcp.form.cancel')}
        </Button>
      </div>
    </form>
  );
}
