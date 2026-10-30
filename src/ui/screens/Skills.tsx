// Skills: what agents know how to do. Installed, created and built-in Skills
// as cards (source, version, readiness, who uses them), a detail view with
// everything a Skill contains, the editor and the installer. No marketplace.

import { BookOpenCheck, Download, Pencil, Plus, Power, RefreshCw, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { useState } from 'react';
import type { InstalledSkill } from '../../domain/skill';
import type { TKey } from '../../i18n';
import { SkillError } from '../../runtime/skills/service';
import { useApp, useServices, useSkills, useT } from '../context';
import { Button, Modal, Segmented } from '../kit';
import { RequirementList, SkillStateBadge, useGithubLabel, useRefLabel, useSkillText } from '../skills/common';
import { SkillEditor } from '../skills/SkillEditor';
import { SkillInstall } from '../skills/SkillInstall';
import { SkillUpdate } from '../skills/SkillUpdate';

type Filter = 'all' | 'imported' | 'created' | 'builtin';

/** agent id → name, and which agents have a Skill */
function useAgents() {
  const st = useApp();
  const { live } = useServices();
  return {
    all: st.characters.map((c) => ({ id: c.id, name: c.name })),
    using: (skillId: string) => st.characters.filter((c) => live.agent(c.id).skillIds?.includes(skillId)).map((c) => c.name),
    has: (agentId: string, skillId: string) => !!live.agent(agentId).skillIds?.includes(skillId),
    toggle: (agentId: string, skillId: string, on: boolean) => {
      const cur = live.agent(agentId).skillIds ?? [];
      live.updateAgent(agentId, { skillIds: on ? [...new Set([...cur, skillId])] : cur.filter((x) => x !== skillId) });
    },
  };
}

type Skills = ReturnType<typeof useSkills>;
type T = ReturnType<typeof useT>;

/** check all GitHub Skills (or one) and say what came out */
async function checkAll(skills: Skills, t: T, store: ReturnType<typeof useServices>['store'], ids?: string[]) {
  const r = await skills.checkUpdates(ids).catch((e: Error) => (store.toast(e.message), undefined));
  if (!r) return;
  if (r.failed) store.toast(t('skills.upd.someFailed', { n: r.failed }));
  else if (ids) {
    const s = skills.get(ids[0]);
    store.toast(s?.update?.available ? t('skills.upd.foundOne') : s?.source.github?.refKind === 'commit' ? t('skills.upd.pinnedNone') : t('skills.upd.upToDateOne'));
  } else store.toast(r.available ? t('skills.upd.found', { n: r.available }) : t('skills.upd.upToDate'));
}

export function SkillsScreen() {
  const t = useT();
  const skills = useSkills();
  const { store } = useServices();
  const agents = useAgents();
  const text = useSkillText();
  const [filter, setFilter] = useState<Filter>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [installing, setInstalling] = useState(false);
  const [editing, setEditing] = useState<InstalledSkill | 'new' | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const githubLabel = useGithubLabel();
  const fromGithub = skills.githubSkills().length > 0;
  const upd = skills.updateSettings();
  const pending = skills.withUpdates().length;
  const list = skills.list().filter((s) => filter === 'all' || (filter === 'imported' && s.origin === 'imported') || (filter === 'created' && s.origin === 'user_created') || (filter === 'builtin' && s.origin === 'built_in'));
  const shown = open ? skills.get(open) : undefined;

  return (
    <div className="skills-screen panel-glass">
      <header className="section-head">
        <div>
          <h1 className="display">{t('skills.title')}</h1>
          <p className="muted">{t('skills.sub')}</p>
        </div>
        <div className="row">
          {fromGithub && (
            <Button icon={<RefreshCw size={14} className={skills.checkingUpdates() ? 'spin' : undefined} />} disabled={skills.checkingUpdates()} onClick={() => void checkAll(skills, t, store)}>
              {skills.checkingUpdates() ? t('skills.upd.checking') : t('skills.upd.checkAll')}
            </Button>
          )}
          <Button icon={<Upload size={14} />} onClick={() => setInstalling(true)}>
            {t('skills.install')}
          </Button>
          <Button tone="primary" icon={<Plus size={14} />} onClick={() => setEditing('new')}>
            {t('skills.create')}
          </Button>
        </div>
      </header>
      {fromGithub && (
        <div className="skill-upd-bar small">
          <span className="muted">
            {pending ? t('skills.upd.pending', { n: pending }) : upd.lastCheck ? t('skills.upd.lastCheck', { when: new Date(upd.lastCheck).toLocaleString() }) : t('skills.upd.never')}
          </span>
          <label className="tool-check">
            <input type="checkbox" checked={upd.auto} onChange={(e) => void skills.setAutoCheck(e.target.checked)} />
            {t('skills.upd.auto')}
          </label>
        </div>
      )}
      <Segmented
        value={filter}
        onChange={setFilter}
        label={t('s.skill.filter')}
        options={[
          { value: 'all', label: t('skills.filter.all') },
          { value: 'imported', label: t('skills.filter.imported') },
          { value: 'created', label: t('skills.filter.created') },
          { value: 'builtin', label: t('skills.filter.builtin') },
        ]}
      />
      {list.length === 0 && <p className="muted">{t('skills.empty')}</p>}
      <div className="skill-grid">
        {list.map((s) => {
          const using = agents.using(s.manifest.id);
          return (
            <article key={s.manifest.id} className={`skill-card ${s.enabled ? '' : 'off'}`}>
              <header>
                <BookOpenCheck size={18} />
                <div>
                  <b>{text(s, 'name')}</b>
                  <small className="mono">
                    {s.manifest.id} · {s.manifest.version}
                  </small>
                </div>
                <SkillStateBadge state={skills.readiness(s.manifest.id)} />
              </header>
              <p>{text(s, 'description')}</p>
              <div className="skill-meta">
                <span className={`skill-origin ${s.origin}`}>{t(`skills.origin.${s.origin}` as TKey)}</span>
                {s.origin === 'imported' && <span>{s.source.github ? githubLabel(s.source.github) : (s.source.url ?? s.source.label)}</span>}
                {s.modified && <span>{t('skills.modified')}</span>}
                {s.update?.available && (
                  <button className="skill-upd-chip" onClick={() => setUpdating(s.manifest.id)}>
                    {s.update.available.kind === 'tag' ? t('skills.upd.newTag', { tag: s.update.available.tag }) : t('skills.upd.available')}
                  </button>
                )}
                <span>{using.length ? t('skills.assigned', { names: using.join(', ') }) : t('skills.assignedNone')}</span>
              </div>
              <div className="row">
                <Button size="sm" onClick={() => setOpen(s.manifest.id)}>
                  {t('skills.open')}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {shown && <SkillDetail skill={shown} onClose={() => setOpen(null)} onEdit={() => (setOpen(null), setEditing(shown))} onUpdate={() => (setOpen(null), setUpdating(shown.manifest.id))} />}
      {updating && <SkillUpdate id={updating} onClose={() => setUpdating(null)} />}
      {installing && <SkillInstall onClose={() => setInstalling(false)} />}
      {editing && <SkillEditor skill={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function SkillDetail({ skill, onClose, onEdit, onUpdate }: { skill: InstalledSkill; onClose: () => void; onEdit: () => void; onUpdate: () => void }) {
  const t = useT();
  const skills = useSkills();
  const { store } = useServices();
  const agents = useAgents();
  const text = useSkillText();
  const githubLabel = useGithubLabel();
  const refLabel = useRefLabel();
  const gh = skill.source.github;
  const tracked = skills.githubSkills().includes(skill);
  const u = skill.update;
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState('');
  const m = skill.manifest;
  const resolution = skills.resolve(m.id)!;
  const resources = skill.files.filter((f) => f.kind === 'resource' || f.kind === 'example' || f.kind === 'other');

  const run = async (f: () => Promise<unknown>) => {
    setError('');
    try {
      await f();
    } catch (err) {
      const e = err as SkillError;
      setError([e.message, ...(e.details ?? [])].join(' — '));
    }
  };

  return (
    <Modal onClose={onClose} title={text(skill, 'name')} wide>
      <div className="modal-head">
        <h2>
          {text(skill, 'name')} <small className="mono muted">{m.version}</small>
        </h2>
        <SkillStateBadge state={skills.readiness(m.id)} />
      </div>
      <div className="modal-body skill-detail">
        {skill.origin === 'imported' && (
          <div className="skill-trust" role="note">
            <ShieldAlert size={16} />
            <span>{t('skills.trust')}</span>
          </div>
        )}
        <section>
          <h4>{t('skills.overview')}</h4>
          <p>{text(skill, 'description')}</p>
          <dl className="skill-facts">
            <dt>{t('skills.id')}</dt>
            <dd>
              <code>{m.id}</code>
            </dd>
            <dt>{t('skills.version')}</dt>
            <dd>{m.version}</dd>
            <dt>{t('skills.source')}</dt>
            <dd>
              {t(`skills.origin.${skill.origin}` as TKey)}
              {skill.origin === 'imported' && ` · ${gh ? githubLabel(gh) : (skill.source.url ?? skill.source.label)} · ${skill.source.format}`}
              {skill.modified && ` · ${t('skills.modified')}`}
            </dd>
            {m.author && (
              <>
                <dt>{t('skills.author')}</dt>
                <dd>{m.author}</dd>
              </>
            )}
            {m.license && (
              <>
                <dt>{t('skills.license')}</dt>
                <dd>{m.license}</dd>
              </>
            )}
            {skill.packageHash && (
              <>
                <dt>{t('skills.hash')}</dt>
                <dd className="mono small">{skill.packageHash.slice(0, 16)}…</dd>
              </>
            )}
            {m.tags.length > 0 && (
              <>
                <dt>{t('s.skill.tags')}</dt>
                <dd>{m.tags.join(', ')}</dd>
              </>
            )}
          </dl>
        </section>
        {tracked && (
          <section className="skill-upd-status">
            <h4>{t('skills.upd.section')}</h4>
            <p className="small">
              {gh?.refKind === 'commit'
                ? t('skills.pinnedCommit')
                : gh?.refKind === 'tag'
                  ? t('skills.pinnedTag')
                  : gh
                    ? t('skills.followsBranch')
                    : t('skills.upd.legacy')}
            </p>
            <p className="small">
              {u?.available ? (
                <b className="skill-upd-yes">{u.available.kind === 'tag' ? t('skills.upd.newTag', { tag: u.available.tag }) : t('skills.upd.availableN', { n: u.available.commits.length + (u.available.more ? '+' : '') })}</b>
              ) : u?.checkedAt && !u.error ? (
                <span className="muted">{t('skills.upd.upToDateAt', { when: new Date(u.checkedAt).toLocaleString() })}</span>
              ) : null}
              {u?.error && <span className="chat-error"> {u.error}</span>}
            </p>
            <div className="row">
              <Button size="sm" icon={<RefreshCw size={13} className={skills.checkingUpdates() ? 'spin' : undefined} />} disabled={skills.checkingUpdates()} onClick={() => void checkAll(skills, t, store, [skill.manifest.id])}>
                {t('skills.upd.checkOne')}
              </Button>
              {u?.available && gh && (
                <Button size="sm" tone="primary" onClick={onUpdate}>
                  {u.available.kind === 'tag' ? t('skills.upd.reviewTag', { ref: refLabel('tag', u.available.tag) }) : t('skills.upd.review')}
                </Button>
              )}
            </div>
          </section>
        )}
        <section>
          <h4>{t('skills.requirements')}</h4>
          <RequirementList items={resolution.items} />
          <p className="muted small">{t('skills.toolsNote')}</p>
          {m.permissions?.length ? (
            <>
              <h4>{t('skills.permissions')}</h4>
              <ul className="skill-plain">
                {m.permissions.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
        <section className="skill-wide">
          <h4>{t('skills.instructions')}</h4>
          <pre className="skill-instructions">{skill.instructions}</pre>
        </section>
        {m.examples?.length ? (
          <section className="skill-wide">
            <h4>{t('skills.examples')}</h4>
            <ul className="skill-plain">
              {m.examples.map((e, i) => (
                <li key={i}>
                  <b>{e.input}</b>
                  <br />
                  <small>{e.procedure}</small>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        {resources.length > 0 && (
          <section>
            <h4>{t('skills.resources')}</h4>
            <ul className="skill-files mono">
              {resources.map((f) => (
                <li key={f.path}>
                  {f.path} <small>{(f.bytes / 1024).toFixed(1)} KB</small>
                </li>
              ))}
            </ul>
          </section>
        )}
        {skill.importNotes?.length ? (
          <section>
            <h4>{t('skills.notes')}</h4>
            <ul className="skill-plain small">
              {skill.importNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </section>
        ) : null}
        <section>
          <h4>{t('skills.assign')}</h4>
          <div className="skill-agents">
            {agents.all.map((a) => (
              <label key={a.id} className="tool-check">
                <input type="checkbox" checked={agents.has(a.id, m.id)} disabled={!skill.enabled} onChange={(e) => agents.toggle(a.id, m.id, e.target.checked)} />
                {a.name}
              </label>
            ))}
          </div>
        </section>
        {error && <p className="chat-error">{error}</p>}
      </div>
      <div className="modal-foot skill-actions">
        <Button size="sm" icon={<Download size={14} />} onClick={() => void run(async () => store.toast(t('skills.exported', { path: (await skills.export(m.id)).path })))}>
          {t('skills.export')}
        </Button>
        {skill.origin !== 'built_in' && (
          <Button size="sm" icon={<Pencil size={14} />} onClick={onEdit}>
            {t('skills.edit')}
          </Button>
        )}
        <Button size="sm" icon={<Power size={14} />} onClick={() => void run(() => skills.setEnabled(m.id, !skill.enabled))}>
          {skill.enabled ? t('skills.disable') : t('skills.enable')}
        </Button>
        {skill.origin !== 'built_in' &&
          (!confirm ? (
            <Button size="sm" tone="danger" icon={<Trash2 size={14} />} onClick={() => setConfirm(true)}>
              {t('skills.uninstall')}
            </Button>
          ) : (
            <span className="skill-confirm">
              {t('skills.uninstallConfirm', { name: text(skill, 'name') })}
              <Button size="sm" tone="danger" onClick={() => void run(async () => (await skills.uninstall(m.id), onClose()))}>
                {t('skills.uninstall')}
              </Button>
            </span>
          ))}
        <span className="approval-gap" />
        <Button size="sm" tone="ghost" onClick={onClose}>
          {t('skills.close')}
        </Button>
      </div>
    </Modal>
  );
}
