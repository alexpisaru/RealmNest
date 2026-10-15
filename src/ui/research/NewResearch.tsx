// A new research: the question, the AI (connection, planner/writer model, reader model), the
// depth, the Knowledge bases, clarifying questions on or off. Web search is the connection's own.

import { Telescope } from 'lucide-react';
import { useMemo, useState } from 'react';
import { RESEARCH_PRESETS, type ResearchPreset } from '../../domain/research';
import { useConnections, useResearch, useT } from '../context';
import { BasePicker } from '../knowledge/common';
import { Button, Segmented } from '../kit';
import { ModelPicker } from '../ModelPicker';

export function NewResearch({ initialQuestion, onStarted }: { initialQuestion?: string; onStarted: (id: string) => void }) {
  const t = useT();
  const research = useResearch();
  const connections = useConnections();
  const usable = connections.list().filter((c) => c.status === 'connected' && connections.provider(c.id));
  const [question, setQuestion] = useState(initialQuestion ?? '');
  const [connectionId, setConnectionId] = useState(() => usable.find((c) => connections.provider(c.id)?.capabilities.webSearch)?.id ?? usable[0]?.id ?? '');
  const [model, setModel] = useState('');
  const [reader, setReader] = useState('');
  const [preset, setPreset] = useState<ResearchPreset>('standard');
  const [bases, setBases] = useState<string[]>([]);
  const [clarify, setClarify] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const conn = connections.get(connectionId);
  const webSearch = !!connections.provider(connectionId)?.capabilities.webSearch;
  // OpenRouter and the like work only with a chosen model
  const needsModel = !!conn && !!connections.catalog.get(conn.providerId)?.requiresModel && !model && !conn.preferredModel;
  const defaultReader = useMemo(() => research.defaultReader(connectionId, model || undefined), [connectionId, model]);
  const b = RESEARCH_PRESETS[preset];

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      const run = await research.create({
        question,
        connectionId,
        ...((model || conn?.preferredModel) && { model: model || conn?.preferredModel }),
        ...(reader && { readerModel: reader }),
        preset,
        knowledgeBaseIds: bases,
        clarify,
      });
      onStarted(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rs-new">
      <h2>
        <Telescope size={18} /> {t('rs.newTitle')}
      </h2>
      <p className="muted">{t('rs.newSub')}</p>
      <label className="field-stack">
        <span>{t('rs.question')}</span>
        <textarea rows={4} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder={t('rs.questionPh')} autoFocus />
      </label>
      <div className="rs-form-row">
        <label className="field-stack">
          <span>{t('rs.connection')}</span>
          <select value={connectionId} onChange={(e) => (setConnectionId(e.target.value), setModel(''), setReader(''))}>
            {usable.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-stack">
          <span>{t('rs.model')}</span>
          <ModelPicker connectionId={connectionId || undefined} value={model || undefined} onChange={setModel} autoLabel={conn?.preferredModel ?? t('rs.modelDefault')} />
        </label>
        <label className="field-stack">
          <span>{t('rs.reader')}</span>
          <ModelPicker connectionId={connectionId || undefined} value={reader || undefined} onChange={setReader} autoLabel={defaultReader ?? t('rs.readerSame')} />
        </label>
      </div>
      <p className={`rs-web ${webSearch ? 'ok' : 'no'}`}>{!conn ? t('chat.noConnections') : webSearch ? t('rs.webYes', { name: conn.name }) : t('rs.webNo', { name: conn.name })}</p>
      <span className="field-label">{t('rs.depth')}</span>
      <Segmented
        value={preset}
        onChange={setPreset}
        label={t('rs.depth')}
        options={[
          { value: 'quick', label: t('rs.preset.quick') },
          { value: 'standard', label: t('rs.preset.standard') },
          { value: 'deep', label: t('rs.preset.deep') },
        ]}
      />
      <small className="muted">{t('rs.budget', { rounds: b.rounds, pages: b.pages, searches: b.searches, minutes: b.minutes })}</small>
      <span className="field-label">{t('rs.knowledge')}</span>
      <BasePicker value={bases} onChange={setBases} />
      <label className="tool-check">
        <input type="checkbox" checked={clarify} onChange={(e) => setClarify(e.target.checked)} />
        <span>{t('rs.clarify')}</span>
      </label>
      {needsModel && <p className="rs-web no">{t('rs.needsModel', { name: conn?.name ?? '' })}</p>}
      {error && <p className="chat-error">{error}</p>}
      <div className="row">
        <Button tone="primary" icon={<Telescope size={15} />} onClick={() => void start()} disabled={busy || !question.trim() || !connectionId || needsModel || (!webSearch && !bases.length)}>
          {t('rs.start')}
        </Button>
      </div>
      <p className="muted small">{t('rs.howItWorks')}</p>
    </div>
  );
}
