// The update of a GitHub Skill, before anything is installed: from which commit or tag
// to which, the commits that changed its folder, the files, and first of all what it
// may now use (capabilities, tools, MCP, network, files, permissions). Installing needs
// a yes, and a second one when the Skill was changed here since it was installed.

import { AlertTriangle, GitCommitHorizontal, ShieldAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { TKey } from '../../i18n';
import type { SkillUpdatePlan } from '../../runtime/skills/updates';
import { SkillError } from '../../runtime/skills/service';
import { useServices, useSkills, useT } from '../context';
import { Button, Modal } from '../kit';
import { useRefLabel } from './common';

export function SkillUpdate({ id, onClose }: { id: string; onClose: () => void }) {
  const t = useT();
  const skills = useSkills();
  const { store } = useServices();
  const refLabel = useRefLabel();
  const [plan, setPlan] = useState<SkillUpdatePlan | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const skill = skills.get(id);
  const kind = skill?.source.github?.refKind ?? 'branch';

  useEffect(() => {
    let live = true;
    skills
      .prepareUpdate(id)
      .then((p) => live && setPlan(p))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
      skills.discardUpdate(id);
    };
  }, [id, skills]);

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      const s = await skills.applyUpdate(id, { overwriteLocal: overwrite });
      const g = s.source.github;
      // Agent Skills folders carry no version: the commit says which one it is now
      store.toast(t('skills.upd.done', { name: s.manifest.name, to: g ? `${refLabel(g.refKind, g.ref)} @ ${g.commit.slice(0, 7)}` : s.manifest.version }));
      onClose();
    } catch (err) {
      const e = err as SkillError;
      // the old version is still installed: nothing was replaced
      setError(t('skills.upd.failed', { error: [e.message, ...(e.details ?? [])].join(' — ') }));
      setBusy(false);
    }
  };

  const toKind = plan && plan.to.ref !== plan.from.ref ? 'tag' : kind;
  return (
    <Modal onClose={onClose} title={t('skills.upd.title', { name: skill?.manifest.name ?? id })} wide>
      <div className="modal-head">
        <h2>{t('skills.upd.title', { name: skill?.manifest.name ?? id })}</h2>
      </div>
      <div className="modal-body skill-update">
        {!plan && !error && <p className="muted">{t('skills.upd.loading')}</p>}
        {plan && (
          <>
            <p className="skill-upd-route">
              <span className="mono">
                {refLabel(kind, plan.from.ref)} @ {plan.from.commit.slice(0, 7) || '?'} · {plan.from.version}
              </span>
              <span aria-hidden>→</span>
              <b className="mono">
                {refLabel(toKind, plan.to.ref)} @ {plan.to.commit.slice(0, 7)} · {plan.to.version}
              </b>
            </p>

            {plan.sensitive.length > 0 ? (
              <div className="skill-upd-sensitive" role="alert">
                <b>
                  <ShieldAlert size={15} /> {t('skills.upd.sensitive')}
                </b>
                <ul>
                  {plan.sensitive.map((c, i) => (
                    <li key={i} className={c.change}>
                      <span className="skill-upd-area">{t(`skills.upd.area.${c.area}` as TKey)}</span>
                      {t(c.change === 'added' ? 'skills.upd.added' : 'skills.upd.removed')} <code>{c.what}</code>
                      {c.optional && <small className="muted"> ({t('skills.upd.optional')})</small>}
                    </li>
                  ))}
                </ul>
                <small className="muted">{t('skills.upd.sensitiveNote')}</small>
              </div>
            ) : (
              <p className="muted small">{t('skills.upd.noSensitive')}</p>
            )}

            {plan.commits.length > 0 && (
              <section>
                <h4>{t('skills.upd.commits')}</h4>
                <ul className="skill-upd-commits">
                  {plan.commits.map((c) => (
                    <li key={c.sha}>
                      <GitCommitHorizontal size={13} />
                      <code>{c.sha.slice(0, 7)}</code>
                      <span>{c.message || '—'}</span>
                      {c.date && <small className="muted">{new Date(c.date).toLocaleDateString()}</small>}
                    </li>
                  ))}
                </ul>
                {plan.more && <small className="muted">{t('skills.upd.more')}</small>}
              </section>
            )}

            <section>
              <h4>{t('skills.upd.files')}</h4>
              {plan.files.length === 0 ? (
                <p className="muted small">{t('skills.upd.noFiles')}</p>
              ) : (
                <ul className="skill-upd-files mono">
                  {plan.files.map((f) => (
                    <li key={f.path}>
                      <span className={`skill-upd-change ${f.change}`}>{t(`skills.upd.file.${f.change}` as TKey)}</span>
                      <span className="q-text">{f.path}</span>
                      {f.plus !== undefined && (
                        <small>
                          <span className="plus">+{f.plus}</span> <span className="minus">−{f.minus}</span>
                        </small>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {plan.warnings.length > 0 && (
              <ul className="skill-plain small muted">
                {plan.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}
            {plan.problems.length > 0 && (
              <div className="chat-error">
                {t('skills.upd.problems')}
                <ul>
                  {plan.problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            )}
            {plan.localChanges && (
              <label className="skill-upd-local">
                <AlertTriangle size={15} />
                <span>{t('skills.upd.local')}</span>
                <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
                <b>{t('skills.upd.localOk')}</b>
              </label>
            )}
            <p className="muted small">{t('skills.upd.atomic')}</p>
          </>
        )}
        {error && <p className="chat-error">{error}</p>}
      </div>
      <div className="modal-foot">
        <span className="approval-gap" />
        <Button size="sm" tone="ghost" onClick={onClose}>
          {t('skills.upd.cancel')}
        </Button>
        <Button size="sm" tone="primary" disabled={!plan || busy || plan.problems.length > 0 || (plan.localChanges && !overwrite)} onClick={() => void apply()}>
          {busy ? t('skills.upd.installing') : t('skills.upd.install')}
        </Button>
      </div>
    </Modal>
  );
}
