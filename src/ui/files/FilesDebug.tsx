// Debug › Files: where file bytes live, what references them (conversations, tasks, artifacts),
// a check that every referenced file is still there, recent artifact events and import problems.
// Ids, sizes and hashes only: never contents or host paths.

import { useEffect, useState } from 'react';
import { formatBytes } from '../../domain/attachment';
import type { FileUsage } from '../../runtime/files/store';
import { useServices, useT } from '../context';
import { Button } from '../kit';
import { useArtifacts } from './FileViews';

const time = (t?: number) => (t ? new Date(t).toLocaleTimeString() : '—');

export function FilesDebug() {
  const t = useT();
  const { files, chat, live, bus, knowledge, research, crews } = useServices();
  const artifacts = useArtifacts();
  const [, bump] = useState(0);
  useEffect(() => bus.on('*', (_p, e) => e.type.startsWith('artifact.') && bump((n) => n + 1)), [bus]);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [usage, setUsage] = useState<FileUsage | null>(null);
  const [busy, setBusy] = useState(false);
  const chatRefs = chat.storageRefs();
  const taskRefs = live.storageRefs();
  const artRefs = artifacts.storageRefs();
  // every owner of stored files: collecting with less would delete Knowledge documents or report pictures
  const all = [...new Set([...chatRefs, ...taskRefs, ...artRefs, ...knowledge.storageRefs(), ...research.storageRefs(), ...crews.storageRefs()])];
  const list = artifacts.list('all', { deleted: true });
  const attachments = [
    ...chat.list().flatMap((c) => c.messages.flatMap((m) => (m.attachments ?? []).map((a) => ({ a, where: `chat ${c.id} · ${m.id}` })))),
    ...live.allAttachments().map(({ attachment: a, taskId }) => ({ a, where: `task ${taskId}` })),
  ].sort((x, y) => (y.a.createdAt ?? 0) - (x.a.createdAt ?? 0));
  const events = bus.log.filter((e) => e.type.startsWith('artifact.')).slice(0, 20);

  const check = async () => {
    setBusy(true);
    const gone: string[] = [];
    for (const r of all) if (!(await files.exists(r).catch(() => false))) gone.push(r);
    setMissing(gone);
    setBusy(false);
  };
  const collect = async () => {
    setBusy(true);
    setUsage(await files.collect(all).catch(() => null));
    setBusy(false);
  };

  return (
    <div className="tools-debug">
      <h4>{t('p.files.dbg.store')}</h4>
      <dl className="kv">
        <dt>{t('p.dbg.kind')}</dt>
        <dd>{files.persistent ? t('p.files.dbg.native') : t('p.files.dbg.memory')}</dd>
        <dt>{t('p.files.dbg.referenced')}</dt>
        <dd>
          {t('p.files.dbg.refs', { n: all.length, chats: chatRefs.size, tasks: taskRefs.size, artifacts: artRefs.size })}
        </dd>
        <dt>{t('p.files.dbg.artifacts')}</dt>
        <dd>
          {t('p.files.dbg.liveDeleted', { live: artifacts.list().length, deleted: list.length - artifacts.list().length })}
        </dd>
      </dl>
      <div className="row">
        <Button size="sm" onClick={() => void check()} disabled={busy}>
          {t('p.files.dbg.check')}
        </Button>
        <Button size="sm" onClick={() => void collect()} disabled={busy || !all.length}>
          {t('p.files.dbg.collect')}
        </Button>
      </div>
      {missing && <p className="muted small">{missing.length ? t('p.files.dbg.missing', { list: missing.map((r) => r.slice(0, 19)).join(', ') }) : t('p.files.dbg.allPresent')}</p>}
      {usage && (
        <p className="muted small">
          {t('p.files.dbg.collected', { kept: usage.kept, keptBytes: formatBytes(usage.keptBytes), removed: usage.removed, removedBytes: formatBytes(usage.removedBytes) })}
          {files.persistent ? t('p.files.dbg.keepsYoung') : ''}
        </p>
      )}

      <h4>{t('p.files.dbg.attachments', { n: attachments.length })}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>id</th>
            <th>{t('p.dbg.name')}</th>
            <th>{t('p.dbg.kind')}</th>
            <th>MIME</th>
            <th>{t('p.dbg.size')}</th>
            <th>sha256</th>
            <th>{t('p.files.dbg.stored')}</th>
            <th>{t('p.files.dbg.in')}</th>
            <th>{t('p.files.dbg.source')}</th>
          </tr>
        </thead>
        <tbody>
          {attachments.slice(0, 60).map(({ a, where }) => (
            <tr key={a.id}>
              <td className="mono">{a.id}</td>
              <td>{a.name}</td>
              <td>{a.kind}</td>
              <td className="mono">{a.mime}</td>
              <td>{formatBytes(a.size)}</td>
              <td className="mono">{a.sha256?.slice(0, 12) ?? '—'}</td>
              <td>{!a.storageRef ? (a.text !== undefined ? t('p.files.dbg.inlineOld') : t('p.files.dbg.memoryOld')) : missing?.includes(a.storageRef) ? t('p.files.dbg.missingOne') : missing ? t('p.files.dbg.present') : t('p.files.dbg.ref')}</td>
              <td className="mono">{where}</td>
              <td>{a.source ?? '—'}{a.artifactId ? ` ← ${a.artifactId}` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t('p.files.dbg.artifactsN', { n: list.length })}</h4>
      <table className="dbg-table">
        <thead>
          <tr>
            <th>{t('p.dbg.name')}</th>
            <th>{t('p.dbg.kind')}</th>
            <th>{t('p.dbg.size')}</th>
            <th>{t('p.files.dbg.origin')}</th>
            <th>{t('p.files.dbg.tool')}</th>
            <th>{t('p.files.dbg.run')}</th>
            <th>{t('p.files.dbg.from')}</th>
            <th>sha256</th>
          </tr>
        </thead>
        <tbody>
          {list.slice(0, 40).map((a) => (
            <tr key={a.id} className={a.deletedAt ? 'muted' : ''}>
              <td>
                {a.name}
                {a.deletedAt ? ` ${t('p.files.dbg.deleted')}` : ''}
              </td>
              <td>{a.kind}</td>
              <td>{formatBytes(a.size)}</td>
              <td>{a.provenance.origin}</td>
              <td className="mono">{a.provenance.toolId ?? '—'}</td>
              <td className="mono">{a.provenance.runId ?? '—'}</td>
              <td className="mono">{[...a.provenance.sourceAttachmentIds, ...a.provenance.sourceArtifactIds].join(', ') || '—'}</td>
              <td className="mono">{a.sha256?.slice(0, 12) ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h4>{t('p.files.dbg.problems', { n: artifacts.issues.length })}</h4>
      {artifacts.issues.length === 0 && <p className="muted small">{t('p.files.dbg.none')}</p>}
      <ul className="dbg-calls">
        {artifacts.issues.slice(0, 20).map((i, n) => (
          <li key={n} className="failed">
            <span className="mono">{time(i.at)}</span> <code>{i.code}</code> {i.name}: {i.message}
          </li>
        ))}
      </ul>

      <h4>{t('p.dbg.events')}</h4>
      <ul className="dbg-calls">
        {events.map((e) => (
          <li key={e.seq}>
            <span className="mono">{time(e.at)}</span> <code>{e.type}</code> <span className="mono small">{JSON.stringify(e.payload)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
