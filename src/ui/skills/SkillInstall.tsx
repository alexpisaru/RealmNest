// Install a Skill: pick a source (file, folder, URL; Git and a gallery
// later), then a review screen shows everything before anything is kept —
// instructions, requirements and their state, files, what was left out, what
// the importer mapped, and an existing version. Never installs blindly.

import { FileUp, FolderUp, Globe, GitBranch, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { compareVersions, type ToolRequirement } from '../../domain/skill';
import type { PackageFile, SkillReview } from '../../runtime/skills/package';
import type { GithubRepo, GithubSkill } from '../../runtime/skills/github';
import { SKILL_LIMITS } from '../../runtime/skills/package';
import { SkillError } from '../../runtime/skills/service';
import { useSkills, useT } from '../context';
import { Button, Modal } from '../kit';
import { RequirementList, ToolPicker } from './common';

/** read what the user picked (the browser's own picker: the page never names a path) */
async function readPicked(list: FileList, folder: boolean, t: ReturnType<typeof useT>): Promise<PackageFile[]> {
  const files = [...list];
  const total = files.reduce((n, f) => n + f.size, 0);
  if (files.length > SKILL_LIMITS.files * 2 || total > SKILL_LIMITS.totalBytes * 2) throw new Error(t('s.skill.tooLarge', { n: files.length, mb: (total / 1024 / 1024).toFixed(1) }));
  return Promise.all(files.map(async (f) => ({ path: folder ? (f.webkitRelativePath || f.name) : f.name, bytes: new Uint8Array(await f.arrayBuffer()) })));
}

export function SkillInstall({ onClose }: { onClose: () => void }) {
  const t = useT();
  const skills = useSkills();
  const [review, setReview] = useState<SkillReview | null>(null);
  const [url, setUrl] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [found, setFound] = useState<{ repo: Required<GithubRepo>; skills: GithubSkill[]; truncated: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (f: () => Promise<SkillReview>) => {
    setBusy(true);
    setError('');
    try {
      setReview(await f());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal onClose={onClose} title={t('skills.install')} wide={!!review}>
      <div className="modal-head">
        <h2>{review ? t('skills.review') : t('skills.install')}</h2>
      </div>
      <div className="modal-body">
        {!review ? (
          <div className="skill-sources">
            <label className="skill-source">
              <FileUp size={18} />
              <b>{t('skills.from.file')}</b>
              <small>{t('skills.fileSub')}</small>
              <input
                type="file"
                accept=".md,.realmnest-skill,.nestra-skill,.json"
                disabled={busy}
                onChange={(e) => e.target.files?.length && void load(async () => skills.review(await readPicked(e.target.files!, false, t), { kind: 'local_file', label: e.target.files![0].name }))}
              />
            </label>
            <label className="skill-source">
              <FolderUp size={18} />
              <b>{t('skills.from.folder')}</b>
              <small>{t('skills.folderSub')}</small>
              <input
                type="file"
                // a folder picker: the browser lists the files with their paths inside the folder
                {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
                disabled={busy}
                onChange={(e) => {
                  const list = e.target.files;
                  if (!list?.length) return;
                  const folder = (list[0].webkitRelativePath || list[0].name).split('/')[0];
                  void load(async () => skills.review(await readPicked(list, true, t), { kind: 'local_directory', label: folder }));
                }}
              />
            </label>
            <div className="skill-source">
              <Globe size={18} />
              <b>{t('skills.from.url')}</b>
              <small>{t('skills.urlSub')}</small>
              <div className="row">
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/SKILL.md" spellCheck={false} />
                <Button size="sm" onClick={() => void load(() => skills.reviewUrl(url))} disabled={busy || !url.trim()}>
                  {t('skills.download')}
                </Button>
              </div>
            </div>
            <div className="skill-source">
              <GitBranch size={18} />
              <b>{t('skills.from.git')}</b>
              <small>{t('skills.gitSub')}</small>
              <div className="row">
                <input type="url" value={repoUrl} onChange={(e) => (setRepoUrl(e.target.value), setFound(null))} placeholder="https://github.com/anthropics/skills" spellCheck={false} />
                <Button
                  size="sm"
                  onClick={() => {
                    setBusy(true);
                    setError('');
                    skills
                      .githubList(repoUrl)
                      .then(setFound, (err) => setError(err instanceof Error ? err.message : String(err)))
                      .finally(() => setBusy(false));
                  }}
                  disabled={busy || !repoUrl.trim()}
                >
                  {t('skills.gitFind')}
                </Button>
              </div>
              {found && (
                <>
                  <small className="muted">{t('skills.gitFound', { n: found.skills.length, repo: `${found.repo.owner}/${found.repo.repo}`, ref: found.repo.ref })}</small>
                  <ul className="skill-git-list">
                    {found.skills.map((s) => (
                      <li key={s.dir}>
                        <span>
                          <b>{s.name}</b>
                          <small className="muted mono">{s.dir || '/'}</small>
                        </span>
                        <small className="muted">{t('skills.gitFiles', { n: s.files.length })}</small>
                        <Button size="sm" onClick={() => void load(() => skills.githubReview(found.repo, s))} disabled={busy}>
                          {t('skills.gitReview')}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {found.truncated && <small className="muted">{t('skills.gitTruncated')}</small>}
                </>
              )}
            </div>
            <p className="muted small">{t('skills.registrySoon')}</p>
            {busy && <p className="muted small">{t('skills.reading')}</p>}
            {error && <p className="chat-error">{error}</p>}
          </div>
        ) : (
          <SkillReviewView review={review} onBack={() => setReview(null)} onDone={onClose} />
        )}
      </div>
    </Modal>
  );
}

function SkillReviewView({ review, onBack, onDone }: { review: SkillReview; onBack: () => void; onDone: () => void }) {
  const t = useT();
  const skills = useSkills();
  const [id, setId] = useState(review.manifest.id);
  const [name, setName] = useState(review.manifest.name);
  const [tools, setTools] = useState<ToolRequirement[]>(review.manifest.requiresTools);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const overrides = review.needsConfirmation ? { id: id.trim(), name: name.trim() || review.manifest.name, requiresTools: tools } : undefined;
  const manifest = { ...review.manifest, ...overrides };
  const existing = skills.existing(review, overrides);
  const resolution = useMemo(() => skills.resolver.resolve(manifest), [skills, JSON.stringify(manifest)]);
  const blocked = review.problems.length > 0;

  const install = async () => {
    setBusy(true);
    setError('');
    try {
      await skills.install(review, { replace: !!existing, ...(overrides && { overrides }) });
      onDone();
    } catch (err) {
      const e = err as SkillError;
      setError([e.message, ...(e.details ?? [])].join(' — '));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="skill-review">
      <div className="skill-trust" role="note">
        <ShieldAlert size={16} />
        <span>{t('skills.trust')}</span>
      </div>
      <dl className="skill-facts">
        <dt>{t('skills.name')}</dt>
        <dd>{review.needsConfirmation ? <input value={name} onChange={(e) => setName(e.target.value)} /> : manifest.name}</dd>
        <dt>{t('skills.id')}</dt>
        <dd>{review.needsConfirmation ? <input className="mono" value={id} onChange={(e) => setId(e.target.value)} spellCheck={false} /> : <code>{manifest.id}</code>}</dd>
        <dt>{t('skills.version')}</dt>
        <dd>{manifest.version}</dd>
        {manifest.author && (
          <>
            <dt>{t('skills.author')}</dt>
            <dd>{manifest.author}</dd>
          </>
        )}
        {manifest.license && (
          <>
            <dt>{t('skills.license')}</dt>
            <dd>{manifest.license}</dd>
          </>
        )}
        <dt>{t('skills.source')}</dt>
        <dd>
          {review.source.url ?? review.source.label} · {review.format}
        </dd>
        <dt>{t('skills.hash')}</dt>
        <dd className="mono small">{review.hash.slice(0, 16)}…</dd>
      </dl>
      <p>{manifest.description}</p>

      {existing && (
        <div className="skill-existing">
          <b>{t('skills.existing', { old: existing.manifest.version, incoming: manifest.version })}</b>
          {compareVersions(manifest.version, existing.manifest.version) < 0 && <span> ↓</span>}
          {existing.modified && <p>{t('skills.existingModified')}</p>}
          {existing.origin === 'user_created' && <p>{t('skills.existingCreated')}</p>}
        </div>
      )}

      <h4>{t('skills.requires')}</h4>
      {review.needsConfirmation && <ToolPicker value={tools} onChange={setTools} label={t('skills.mapTools')} />}
      {review.unmappedTools.length > 0 && <p className="muted small">{t('skills.unmapped', { tools: review.unmappedTools.join(', ') })}</p>}
      <RequirementList items={resolution.items} />
      {manifest.permissions?.length ? (
        <>
          <h4>{t('skills.permissions')}</h4>
          <ul className="skill-plain">
            {manifest.permissions.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h4>{t('skills.instructions')}</h4>
      <pre className="skill-instructions">{review.instructions || '—'}</pre>

      <h4>{t('skills.files', { n: review.fileInfo.length })}</h4>
      <ul className="skill-files mono">
        {review.fileInfo.map((f) => (
          <li key={f.path}>
            {f.path} <small>{(f.bytes / 1024).toFixed(1)} KB</small>
          </li>
        ))}
      </ul>
      {review.excluded.length > 0 && (
        <>
          <h4>{t('skills.excluded')}</h4>
          <ul className="skill-files mono bad">
            {review.excluded.map((e) => (
              <li key={e.path}>
                {e.path} <small>{e.reason}</small>
              </li>
            ))}
          </ul>
        </>
      )}
      {review.mapping.length > 0 && (
        <>
          <h4>{t('skills.mapping')}</h4>
          <ul className="skill-plain">
            {review.mapping.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </>
      )}
      {review.warnings.length > 0 && (
        <div className="skill-warn">
          <b>{t('skills.warnings')}</b>
          <ul>
            {review.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      {blocked && (
        <div className="skill-problems">
          <b>{t('skills.problems')}</b>
          <ul>
            {review.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {error && <p className="chat-error">{error}</p>}
      <div className="row skill-review-actions">
        <Button tone="ghost" onClick={onBack}>
          {t('skills.cancel')}
        </Button>
        <Button tone={existing ? 'danger' : 'primary'} onClick={() => void install()} disabled={blocked || busy}>
          {existing ? t('skills.replace') : t('skills.installBtn')}
        </Button>
      </div>
    </div>
  );
}
