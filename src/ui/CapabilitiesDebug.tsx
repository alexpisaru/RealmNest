// Debug › Capabilities: for one connection (and optionally one model), every
// capability with its connection-level claim, model-level claim, effective
// support, provenance, availability and whether RealmNest can use it today.
// Answers "why does RealmNest believe this model supports vision?".

import { useState } from 'react';
import { CAPABILITY_IDS, type CapabilitySource, type Support } from '../domain/capability';
import type { TKey } from '../i18n';
import { readinessNote } from './AICapabilities';
import { ConnectionSelect } from './connections';
import { useCapabilities, useConnections, useT } from './context';
import { ModelPicker } from './ModelPicker';

type T = ReturnType<typeof useT>;
const mark = (t: T, s: Support | undefined) => (s === 'supported' ? t('s.yes') : s === 'unsupported' ? t('s.no') : s === 'unknown' ? '?' : '–');
const where = (t: T, s: CapabilitySource) => `${t(`s.capdbg.level.${s.level}` as TKey)}: ${s.origin}${s.evidence ? ` — ${s.evidence}` : ''}${s.via === 'nestra' ? ` ${t('s.capdbg.viaRealmNest')}` : ''}`;

export function CapabilitiesDebug() {
  const t = useT();
  const connections = useConnections();
  const capabilities = useCapabilities();
  const [connectionId, setConnectionId] = useState(connections.list()[0]?.id ?? '');
  const [modelId, setModelId] = useState('');
  const conn = capabilities.connectionCapabilities(connectionId);
  const model = modelId ? capabilities.modelCapabilities(connectionId, modelId) : undefined;
  const eff = connectionId ? capabilities.effective(connectionId, modelId || undefined) : undefined;
  const c = connections.get(connectionId);
  const meta = connections.models(connectionId).find((m) => m.id === modelId);

  return (
    <div className="cap-debug">
      <ConnectionSelect value={connectionId} onChange={(id) => (setConnectionId(id), setModelId(''))} />
      {connections.models(connectionId).length > 0 && <ModelPicker connectionId={connectionId} value={modelId} onChange={setModelId} capability="all" autoLabel={t('s.capdbg.noModel')} />}
      {c && (
        <p className="muted small mono">
          {t('s.capdbg.status', { status: c.status })}
          {meta ? ` · ${meta.contextLength ? `${meta.contextLength} ctx · ` : ''}${t('s.capdbg.in')} ${meta.inputModalities?.join('+') || '?'} → ${t('s.capdbg.out')} ${meta.outputModalities?.join('+') || '?'} · ${t('s.capdbg.params', { n: meta.supportedParameters?.length ?? 0 })}` : ''}
        </p>
      )}
      {eff && (
        <table className="dbg-table cap-table">
          <thead>
            <tr>
              <th>{t('s.capdbg.capability')}</th>
              <th title={t('s.capdbg.connT')}>{t('s.capdbg.conn')}</th>
              <th title={t('s.capdbg.modelT')}>{t('s.capdbg.model')}</th>
              <th title={t('s.capdbg.effT')}>{t('s.capdbg.eff')}</th>
              <th title={t('s.capdbg.availT')}>{t('s.capdbg.avail')}</th>
              <th title={t('s.capdbg.readyT')}>{t('s.capdbg.ready')}</th>
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_IDS.map((id) => {
              const e = eff[id];
              return (
                <tr key={id} className={`sup-${e.support}`} title={[...e.provenance.map((s) => where(t, s)), readinessNote(t, e.note)].filter(Boolean).join('\n') || t('s.capdbg.noClaim')}>
                  <td>{id}</td>
                  <td>{mark(t, conn[id]?.support)}</td>
                  <td>{model ? mark(t, model[id]?.support) : '–'}</td>
                  <td>
                    <b>{mark(t, e.support)}</b>
                  </td>
                  <td>{e.available ? t('s.yes') : t('s.no')}</td>
                  <td>{e.ready ? t('s.yes') : t('s.no')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {eff && (
        <ul className="cap-provenance">
          {CAPABILITY_IDS.filter((id) => eff[id].provenance.length).map((id) => (
            <li key={id}>
              <code>{id}</code> {t(`s.cap.${id}` as TKey)}: {where(t, eff[id].provenance[0])}
              {!eff[id].ready && eff[id].note ? <em> · {t('s.capdbg.notUsable', { note: readinessNote(t, eff[id].note) })}</em> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
