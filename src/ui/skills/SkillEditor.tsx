// Create or edit a Skill: name, id, description, instructions, required
// capabilities, required / optional tools, tags. Not a workflow editor.

import { useState } from 'react';
import type { CapabilityId } from '../../domain/capability';
import type { InstalledSkill, ToolRequirement } from '../../domain/skill';
import { SkillError } from '../../runtime/skills/service';
import { useSkills, useT } from '../context';
import { Button, Modal } from '../kit';
import { CapabilityChips, ToolRequirements } from './common';

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

export function SkillEditor({ skill, onClose }: { skill?: InstalledSkill; onClose: () => void }) {
  const t = useT();
  const skills = useSkills();
  const m = skill?.manifest;
  const [name, setName] = useState(m?.name ?? '');
  const [id, setId] = useState(m?.id ?? '');
  const [description, setDescription] = useState(m?.description ?? '');
  const [instructions, setInstructions] = useState(skill?.instructions ?? '');
  const [version, setVersion] = useState(m?.version ?? '1.0.0');
  const [caps, setCaps] = useState<CapabilityId[]>(m?.requiresCapabilities ?? []);
  const [required, setRequired] = useState<ToolRequirement[]>(m?.requiresTools ?? []);
  const [optional, setOptional] = useState<ToolRequirement[]>(m?.optionalTools ?? []);
  const [tags, setTags] = useState((m?.tags ?? []).join(', '));
  const [error, setError] = useState('');

  const save = async () => {
    setError('');
    const draft = {
      name,
      description,
      instructions,
      version,
      requiresCapabilities: caps,
      requiresTools: required,
      optionalTools: optional,
      tags: tags.split(',').map((x) => x.trim()).filter(Boolean),
      ...(m?.permissions && { permissions: m.permissions }),
    };
    try {
      if (skill) await skills.update(skill.manifest.id, draft);
      else await skills.create({ ...draft, id: id.trim() || `user.${slug(name) || 'skill'}` });
      onClose();
    } catch (err) {
      const e = err as SkillError;
      setError(e.message);
    }
  };

  return (
    <Modal onClose={onClose} title={skill ? t('skills.editorEdit', { name: skill.manifest.name }) : t('skills.editorNew')} wide>
      <div className="modal-head">
        <h2>{skill ? t('skills.editorEdit', { name: skill.manifest.name }) : t('skills.editorNew')}</h2>
      </div>
      <div className="modal-body skill-editor">
        <div className="mcp-form-row">
          <label className="field-stack">
            <span>{t('skills.name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
          </label>
          <label className="field-stack">
            <span>{t('skills.id')}</span>
            <input className="mono" value={skill ? skill.manifest.id : id} placeholder={`user.${slug(name) || 'skill'}`} onChange={(e) => setId(e.target.value)} disabled={!!skill} spellCheck={false} />
            <small className="muted">{t('skills.idSub')}</small>
          </label>
          <label className="field-stack">
            <span>{t('skills.version')}</span>
            <input className="mono" value={version} onChange={(e) => setVersion(e.target.value)} />
          </label>
        </div>
        <label className="field-stack">
          <span>{t('skills.description')}</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1024} />
        </label>
        <label className="field-stack">
          <span>{t('skills.instructions')}</span>
          <textarea className="mono" rows={10} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
          <small className="muted">{t('skills.instructionsSub')}</small>
        </label>
        <section className="skill-section">
          <span className="skill-section-head">{t('skills.caps')}</span>
          <small className="muted">{t('skills.capsSub')}</small>
          <CapabilityChips value={caps} onChange={setCaps} />
        </section>
        <section className="skill-section">
          <span className="skill-section-head">{t('skills.toolsSection')}</span>
          <small className="muted">{t('skills.toolsSub')}</small>
          <ToolRequirements required={required} optional={optional} onChange={(r, o) => (setRequired(r), setOptional(o))} />
        </section>
        <label className="field-stack">
          <span>{t('skills.tags')}</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} />
        </label>
        {error && <p className="chat-error">{error}</p>}
      </div>
      <div className="modal-foot">
        <Button tone="ghost" onClick={onClose}>
          {t('skills.cancel')}
        </Button>
        <Button tone="primary" onClick={() => void save()}>
          {t('skills.save')}
        </Button>
      </div>
    </Modal>
  );
}
