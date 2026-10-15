// Skills that ship with RealmNest. They are ordinary Skills (same manifest,
// same activation); the user can disable them but not change or uninstall them.

import { SKILL_SCHEMA_VERSION, type InstalledSkill } from '../../domain/skill';

export const BUILT_IN_SKILLS: Omit<InstalledSkill, 'installedAt' | 'updatedAt' | 'enabled'>[] = [
  {
    manifest: {
      schemaVersion: SKILL_SCHEMA_VERSION,
      id: 'nestra.workspace-note',
      name: 'Workspace Note',
      description: 'Create a text note in the workspace and verify it: write the exact content, read it back, confirm it matches.',
      version: '1.0.0',
      author: 'RealmNest',
      requiresCapabilities: [],
      requiresTools: ['write_text_file', 'read_text_file'],
      optionalTools: [],
      permissions: ['writes a text file in the workspace folder', 'reads it back'],
      tags: ['files', 'notes', 'test'],
      examples: [
        {
          title: 'A one-line note',
          input: 'Create todo.txt containing exactly: Buy milk.',
          procedure: 'write_text_file {path: "todo.txt", content: "Buy milk."} → read_text_file {path: "todo.txt"} → compare → "todo.txt contains exactly: Buy milk."',
        },
      ],
    },
    instructions: [
      '# Workspace Note',
      '',
      'Use this procedure whenever you are asked to create or replace a text note in the workspace.',
      '',
      '1. Take the file name and the exact content from the task. Do not add quotes, a trailing newline or anything else unless the task asks for it.',
      '2. Write it with `write_text_file` (path relative to the workspace).',
      '3. Read the same path back with `read_text_file`.',
      '4. Compare what you read with what was asked, character by character.',
      '5. Answer with the file name and the exact contents you read back, and say whether they match. If writing was refused or failed, say so and stop: do not pretend the note exists.',
    ].join('\n'),
    origin: 'built_in',
    source: { kind: 'built_in', label: 'RealmNest', format: 'nestra-package' },
    files: [],
  },
];
