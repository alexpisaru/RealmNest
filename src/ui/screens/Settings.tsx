import { useRef, useSyncExternalStore } from 'react';
import { isDesktop } from '../../platform';
import { BackupRejected, backupName, createBackup, parseBackup, restoreBackup, storageUsage } from '../../persistence/backup';
import { storageHealth } from '../../persistence/health';
import { freezeWrites } from '../../persistence/storage';
import type { Settings } from '../../persistence/repository';
import type { TKey } from '../../i18n';
import { AICapabilities } from '../AICapabilities';
import { AIConnections } from '../AIConnections';
import { useApp, useNotifier, useServices, useT } from '../context';
import { Button, Segmented, Slider, Toggle } from '../kit';
import { ThemePicker } from '../ThemePicker';
import { ProfileEditor } from '../profile';
import { ToolSettings } from '../tools/ToolSettings';
import { McpSettings } from '../mcp/McpSettings';
import { WebSettings } from '../web/WebSettings';
import { TelegramSettings } from '../telegram/TelegramSettings';
import { APP_LABEL, APP_VERSION } from '../../version';
import { diagnosticsName, diagnosticsReport } from '../../runtime/diagnostics/report';
import { UpdateSettings } from '../update/UpdateViews';

const fmtBytes = (n: number, lang: 'it' | 'en') => {
  const f = (v: number) => v.toLocaleString(lang === 'it' ? 'it-IT' : 'en-US', { maximumFractionDigits: 1 });
  return n < 1024 * 1024 ? `${f(n / 1024)} KB` : `${f(n / 1024 / 1024)} MB`;
};

/** Settings › Data: where things are saved, how much space they take, backup and restore (D-1, D-7) */
function DataCard() {
  const st = useApp();
  const t = useT();
  const { store, files } = useServices();
  const health = useSyncExternalStore(storageHealth.subscribe, storageHealth.getSnapshot);
  const picker = useRef<HTMLInputElement>(null);
  const lang = st.settings.language;
  let usage: ReturnType<typeof storageUsage> | undefined;
  try {
    usage = storageUsage(window.localStorage);
  } catch {
    usage = undefined;
  }

  const exportAll = async () => {
    try {
      const backup = createBackup(window.localStorage, APP_VERSION);
      const text = JSON.stringify(backup);
      const name = backupName(backup.createdAt);
      if (isDesktop()) {
        // the same path as an artifact's export: the native Save dialog
        const stored = await files.put(new TextEncoder().encode(text));
        const path = await files.exportCopy(stored.storageRef, name);
        if (path) store.toast(t('s.data.exported', { path }));
      } else {
        const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err) {
      store.toast(t('s.data.exportFailed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };

  const importFile = async (f: File | undefined) => {
    if (!f) return;
    let backup;
    try {
      // checked before anything is written; a file far too big is not even read
      if (f.size > 64 * 1024 * 1024) throw new BackupRejected('tooLarge');
      backup = parseBackup(await f.text());
    } catch (err) {
      const reason = err instanceof BackupRejected ? t(`s.data.importErr.${err.code}` as TKey) : String(err);
      store.toast(t('s.data.importRejected', { reason }));
      return;
    }
    const date = new Date(backup.createdAt).toLocaleString(lang === 'it' ? 'it-IT' : 'en-US');
    if (!window.confirm(t('s.data.importConfirm', { date, n: Object.keys(backup.keys).length }))) return;
    try {
      // the app's state in memory must not be saved over the backup before the reload
      freezeWrites();
      restoreBackup(window.localStorage, backup);
    } catch (err) {
      store.toast(t('s.data.importFailed', { error: err instanceof Error ? err.message : String(err) }));
      return;
    }
    window.location.reload();
  };

  const unreadable = health.unreadable.map((u) => u.key);
  return (
    <section className="set-card">
      <h3>{t('settings.data')}</h3>
      <p className="muted small">{t(isDesktop() ? 's.data.savedDesktop' : 's.data.savedBrowser')}</p>
      {usage && (
        <p className="muted small">
          {t('s.data.usage', { size: fmtBytes(usage.total, lang) })}{' '}
          {usage.keys.length > 0 &&
            t('s.data.biggest', {
              list: usage.keys
                .slice(0, 3)
                .map((k) => `${k.key} ${fmtBytes(k.bytes, lang)}`)
                .join(', '),
            })}
        </p>
      )}
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => void exportAll()}>{t('s.data.export')}</Button>
        <Button onClick={() => picker.current?.click()}>{t('s.data.import')}</Button>
        <input
          ref={picker}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            void importFile(f);
          }}
        />
      </div>
      <p className="muted small">{t('s.data.backupNote')}</p>
      {(health.writeFailures.length > 0 || unreadable.length > 0 || health.previousSessionWriteFailure || health.collectSkipped) && (
        <div className="small">
          <b>{t('s.data.issues')}</b>
          {health.writeFailures.length > 0 && <p className="muted">{t('s.health.writeFailed', { keys: health.writeFailures.map((f) => f.key).join(', ') })}</p>}
          {unreadable.length > 0 && <p className="muted">{t('s.health.unreadable', { keys: unreadable.join(', ') })}</p>}
          {health.previousSessionWriteFailure && <p className="muted">{t('s.data.previousFailed')}</p>}
          {health.collectSkipped && <p className="muted">{t('s.data.collectSkipped', { reason: health.collectSkipped })}</p>}
        </div>
      )}
      <Button tone="danger" onClick={() => window.confirm(t('s.data.resetConfirm')) && void store.resetDemo().then(() => store.toast(t('s.data.restored')))}>
        {t('settings.reset')}
      </Button>
    </section>
  );
}

/** Settings › Diagnostics: the log file and a report to send with a problem (docs/DIAGNOSTICS.md) */
function DiagnosticsCard() {
  const st = useApp();
  const t = useT();
  const { store, files, log, connections, mcp, chat, crews, workflows, research } = useServices();
  const desktop = isDesktop();
  const exportReport = async () => {
    try {
      const health = storageHealth.getSnapshot();
      const text = diagnosticsReport({
        app: 'RealmNest OS',
        version: APP_LABEL,
        at: Date.now(),
        userAgent: navigator.userAgent,
        language: st.settings.language,
        desktop,
        connections: connections.list().map((c) => ({ providerId: c.providerId, status: c.status })),
        mcp: mcp.list().map((c) => ({ status: mcp.state(c.id).status, tools: mcp.state(c.id).tools.length })),
        storage: { writeFailures: health.writeFailures.length, unreadable: health.unreadable.map((u) => u.key), previousSessionWriteFailure: health.previousSessionWriteFailure, startupIssues: health.startupIssues.map((i) => i.service) },
        counts: { agents: st.characters.length, chats: chat.list().length, crews: crews.list().length, workflows: workflows.all().length, research: research.list().length },
        logFile: desktop ? await log.read() : '',
        recent: log.recent(),
      });
      const name = diagnosticsName();
      if (desktop) {
        // the same path as the backup: the native Save dialog
        const stored = await files.put(new TextEncoder().encode(text));
        const path = await files.exportCopy(stored.storageRef, name);
        if (path) store.toast(t('dg.exported', { path }));
      } else {
        const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 10_000);
      }
    } catch (err) {
      store.toast(t('dg.failed', { error: err instanceof Error ? err.message : String(err) }));
    }
  };
  return (
    <section className="set-card">
      <h3>{t('dg.title')}</h3>
      <p className="muted small">{t(desktop ? 'dg.sub' : 'dg.subBrowser')}</p>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <Button onClick={() => void exportReport()}>{t('dg.export')}</Button>
        {desktop && <Button onClick={() => void log.reveal().catch((err) => store.toast(t('dg.failed', { error: String(err) })))}>{t('dg.reveal')}</Button>}
      </div>
    </section>
  );
}

/** Windows notifications while RealmNest is in the background (docs/NOTIFICATIONS.md) */
function NotifyCard() {
  const t = useT();
  const notifier = useNotifier();
  const n = notifier.settings();
  const set = (p: Parameters<typeof notifier.setSettings>[0]) => void notifier.setSettings(p);
  return (
    <section className="set-card">
      <h3>{t('nt.title')}</h3>
      {!notifier.available ? (
        <p className="muted small">{t('nt.unavailable')}</p>
      ) : (
        <>
          <p className="muted small">{t('nt.sub')}</p>
          <Toggle on={n.enabled} onChange={(enabled) => set({ enabled })} label={t('nt.enabled')} />
          {n.enabled && (
            <>
              <Toggle on={n.approvals} onChange={(approvals) => set({ approvals })} label={t('nt.approvals')} sub={t('nt.approvalsSub')} />
              <Toggle on={n.results} onChange={(results) => set({ results })} label={t('nt.results')} sub={t('nt.resultsSub')} />
              <Toggle on={n.updates} onChange={(updates) => set({ updates })} label={t('nt.updates')} sub={t('nt.updatesSub')} />
              <div className="row">
                <Button size="sm" onClick={() => void notifier.test().catch(() => undefined)}>
                  {t('nt.test')}
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}

export function SettingsScreen() {
  const st = useApp();
  const t = useT();
  const { store } = useServices();
  const s = st.settings;
  const set = (p: Partial<Settings>) => store.updateSettings(p);
  const view = st.settingsTab;

  return (
    <div className="settings panel-glass">
      <header className="section-head">
        <h1 className="display">{t('settings.title')}</h1>
        <Segmented
          value={view}
          onChange={(v) => store.setSettingsTab(v)}
          label={t('s.section')}
          options={[
            { value: 'general', label: t('settings.general') },
            { value: 'appearance', label: t('settings.appearance') },
            { value: 'ai', label: t('settings.connections') },
            { value: 'caps', label: t('settings.capabilities') },
            { value: 'integrations', label: t('settings.integrations') },
          ]}
        />
      </header>
      {view === 'ai' && <AIConnections />}
      {view === 'caps' && <AICapabilities />}
      {view === 'integrations' && (
        <>
          <WebSettings />
          <McpSettings />
          <TelegramSettings />
        </>
      )}
      {view === 'appearance' && (
        <div className="appearance">
          <section>
            <h3>{t('settings.theme')}</h3>
            <ThemePicker value={s.theme} onChange={(theme) => set({ theme })} />
          </section>
          <section className="set-card">
            <h3>{t('settings.view')}</h3>
            <Toggle on={s.showLabels} onChange={(showLabels) => set({ showLabels })} label={t('s.view.labels')} k="L" />
            <Slider label={t('s.view.animSpeed')} min={0.5} max={2} step={0.25} value={s.animationSpeed} format={(v) => `${v}×`} onChange={(animationSpeed) => set({ animationSpeed })} />
          </section>
        </div>
      )}
      {view === 'general' && (
        <div className="settings-grid">
          <section className="set-card">
            <h3>{t('settings.profile')}</h3>
            <ProfileEditor />
            <h3>{t('settings.language')}</h3>
            <Segmented value={s.language} onChange={(language) => set({ language })} label={t('settings.language')} options={[{ value: 'it', label: 'Italiano' }, { value: 'en', label: 'English' }]} />
          </section>

          <section className="set-card">
            <h3>{t('s.chat')}</h3>
            <Toggle on={s.aiTitles} onChange={(aiTitles) => set({ aiTitles })} label={t('settings.aiTitles')} sub={t('settings.aiTitlesSub')} />
          </section>

          <NotifyCard />

          <section className="set-card">
            <h3>{t('tools.title')}</h3>
            <ToolSettings />
          </section>

          <section className="set-card">
            <h3>{t('settings.audio')}</h3>
            <Toggle on={s.sound} onChange={(sound) => set({ sound })} label={t('home.sound')} />
            {(['master', 'music', 'ambient', 'effects'] as const).map((k) => (
              <Slider key={k} label={t(`s.audio.${k}` as TKey)} value={s.volume[k]} onChange={(v) => set({ volume: { ...s.volume, [k]: v } })} />
            ))}
            <p className="muted small">{t('s.audio.note')}</p>
          </section>

          <section className="set-card">
            <h3>{t('s.worldView')}</h3>
            <label className="field-inline wide">
              <span>{t('s.defaultZoom')}</span>
              <select value={s.defaultZoom} onChange={(e) => set({ defaultZoom: +e.target.value })}>
                <option value={0}>{t('s.autoFit')}</option>
                {[1, 2, 3, 4].map((z) => (
                  <option key={z} value={z}>
                    {z}×
                  </option>
                ))}
              </select>
            </label>
          </section>

          <section className="set-card">
            <h3>{t('settings.debug')}</h3>
            <Toggle on={s.debug} onChange={(debug) => set({ debug })} label={t('s.debug.panel')} k="D" />
            <Toggle on={s.showPaths} onChange={(showPaths) => set({ showPaths })} label={t('s.debug.paths')} />
            <Toggle on={s.showPoints} onChange={(showPoints) => set({ showPoints })} label={t('s.debug.points')} />
            <Toggle on={s.showTargets} onChange={(showTargets) => set({ showTargets })} label={t('s.debug.targets')} />
            <Toggle on={s.showGrid} onChange={(showGrid) => set({ showGrid })} label={t('s.debug.grid')} />
          </section>

          <DataCard />

          <DiagnosticsCard />

          <section className="set-card">
            <h3>{t('s.about')}</h3>
            <p className="small">
              <b>RealmNest OS</b> {APP_LABEL}. {t('s.about.agents', { n: st.characters.length })}
            </p>
            <p className="muted small">{t('s.about.modes')}</p>
            <h3>{t('up.title')}</h3>
            <UpdateSettings />
          </section>
        </div>
      )}
    </div>
  );
}
