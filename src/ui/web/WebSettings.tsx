// Settings › Integrations › Web: who searches for web_search (Auto: the first AI connection that can
// search; one of them; or nobody), the hidden reader for pages that need JavaScript, results per
// search and the page cache.

import { Globe } from 'lucide-react';
import { useState } from 'react';
import { AUTO_ENGINE, OFF_ENGINE } from '../../domain/web';
import { useT, useWeb } from '../context';
import { Button, Segmented, Toggle } from '../kit';

export function WebSettings() {
  const t = useT();
  const web = useWeb();
  const s = web.settings();
  const engines = web.engineList().filter((e) => e.id !== AUTO_ENGINE);
  const [, bump] = useState(0);
  return (
    <div className="ai-conns web-settings">
      <h3>
        <Globe size={16} /> {t('web.title')}
      </h3>
      <p className="muted">{t('web.settingsSub')}</p>
      {!web.available && <p className="conn-msg">{t('web.unavailable')}</p>}
      <section className="set-card">
        <h4>{t('web.engine')}</h4>
        <p className="muted small">{t('web.engineSub')}</p>
        <select aria-label={t('web.engine')} value={s.searchEngine === OFF_ENGINE || engines.some((e) => e.id === s.searchEngine) ? s.searchEngine : AUTO_ENGINE} onChange={(e) => void web.setSettings({ searchEngine: e.target.value })}>
          <option value={AUTO_ENGINE}>{t('web.searchAuto')}</option>
          {engines.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
          <option value={OFF_ENGINE}>{t('web.searchOff')}</option>
        </select>
      </section>
      <section className="set-card">
        <Toggle on={s.renderFallback} onChange={(renderFallback) => void web.setSettings({ renderFallback })} label={t('web.renderFallback')} sub={web.canRender ? t('web.renderFallbackSub') : t('web.renderUnavailable')} />
        <h4>{t('web.defaultCount')}</h4>
        <Segmented value={s.defaultCount} onChange={(defaultCount) => void web.setSettings({ defaultCount })} label={t('web.defaultCount')} options={[3, 5, 8, 10].map((n) => ({ value: n, label: String(n) }))} />
        <div className="row">
          <span className="muted small">{t('web.cache', { n: web.cacheSize() })}</span>
          <Button size="sm" disabled={!web.cacheSize()} onClick={() => (web.clearCache(), bump((n) => n + 1))}>
            {t('web.clearCache')}
          </Button>
        </div>
      </section>
    </div>
  );
}
