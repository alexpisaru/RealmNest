import { describe, expect, it } from 'vitest';
import { insertMention, matchSkills, mentionAt, mentionedSkills, skillCatalog } from '../runtime/skills/mentions';

const SKILLS = [
  { id: 'nestra.workspace-note', name: 'Workspace Note', description: 'Write and verify a note in the workspace.' },
  { id: 'community.inspect-image', name: 'Inspect Image', description: 'Open an image in PhotoCraft and describe it.' },
];
const ids = SKILLS.map((s) => s.id);

describe('Skill mentions', () => {
  it('finds known ids after @, once each, and ignores anything else', () => {
    expect(mentionedSkills('Use @nestra.workspace-note and @community.inspect-image.', ids)).toEqual(['nestra.workspace-note', 'community.inspect-image']);
    expect(mentionedSkills('@nestra.workspace-note twice @nestra.workspace-note', ids)).toEqual(['nestra.workspace-note']);
    expect(mentionedSkills('(@nestra.workspace-note)', ids)).toEqual(['nestra.workspace-note']);
    // an e-mail address or an unknown name is not a mention
    expect(mentionedSkills('mail me@nestra.workspace-note or ask @someone', ids)).toEqual([]);
  });

  it('knows the mention being typed at the caret', () => {
    expect(mentionAt('hello @wor', 10)).toEqual({ start: 6, query: 'wor' });
    expect(mentionAt('@', 1)).toEqual({ start: 0, query: '' });
    expect(mentionAt('mail me@x', 9)).toBeNull();
    expect(mentionAt('done @nestra.workspace-note ', 28)).toBeNull();
  });

  it('matches by short id or name, prefix first', () => {
    expect(matchSkills(SKILLS, 'insp').map((s) => s.id)).toEqual(['community.inspect-image']);
    expect(matchSkills(SKILLS, 'note').map((s) => s.id)).toEqual(['nestra.workspace-note']);
    expect(matchSkills(SKILLS, '')).toHaveLength(2);
    expect(matchSkills(SKILLS, 'zzz')).toEqual([]);
  });

  it('replaces the typed fragment with the full id and a space', () => {
    expect(insertMention('use @wor now', 4, 8, 'nestra.workspace-note')).toEqual({ text: 'use @nestra.workspace-note now', caret: 26 });
    expect(insertMention('@', 0, 1, 'nestra.workspace-note')).toEqual({ text: '@nestra.workspace-note ', caret: 23 });
  });

  it('tells the model what exists, what is its own, and what is active', () => {
    expect(skillCatalog([])).toBeUndefined();
    const c = skillCatalog(SKILLS, ['community.inspect-image'], ['nestra.workspace-note'])!;
    expect(c).toContain('Assigned to you:\n- @community.inspect-image — Inspect Image');
    expect(c).toContain('Also installed:\n- @nestra.workspace-note — Workspace Note');
    expect(c).toContain('Active for this message: @nestra.workspace-note.');
  });
});
