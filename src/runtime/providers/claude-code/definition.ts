// Claude in the provider catalogue: your Claude account (Pro, Max, Team), signed in from
// RealmNest, with the Claude models to choose from. Claude Code runs the turns underneath.
// Each connection may point at its own config folder, i.e. a separate account.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { ClaudeCodeProvider } from './provider';

export const claudeCodeDefinition: ProviderDefinition = {
  id: 'claude-code',
  name: 'Claude',
  vendor: 'Anthropic',
  description: 'Your Claude account (Pro, Max, Team): sign in and choose Opus, Fable, Sonnet or Haiku.',
  availability: 'available',
  methods: [
    {
      id: 'cli-session',
      label: 'Claude account',
      description: 'Sign in with your Claude account. RealmNest never sees your password or tokens.',
      fields: [
        {
          key: 'configDir',
          label: 'Claude config folder',
          kind: 'folder',
          placeholder: 'Default (the account already signed in on this computer)',
          help: 'Optional. A different folder holds a different Claude account; sign in to it from the connection.',
        },
      ],
    },
  ],
  create: (connection, { runner }) => new ClaudeCodeProvider(runner, { configDir: connection.config.configDir }),
  // what Claude Code itself can do; whether RealmNest can use it today is decided by the capability service
  capabilities: (_c, a) =>
    claims('Claude Code', [
      ['text.chat', 'supported', 'a Claude model behind the CLI'],
      ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'stream-json partial messages'],
      ['sessions.native', a.sessions ? 'supported' : 'unsupported', 'Claude Code keeps and resumes sessions (--resume)'],
      ['coding', 'supported', 'Claude Code is a coding agent'],
      ['text.reasoning', 'supported', 'the CLI exposes reasoning effort (--effort)'],
      ['tools.calling', 'supported', 'built-in tools (Read, Bash, …)'],
      ['files.input', 'supported', 'PDF document blocks on stream-json input'],
      ['vision.input', a.vision ? 'supported' : 'unknown', 'image blocks on stream-json input (verified with the CLI)'],
      ['web.search', 'supported', 'built-in WebSearch tool'],
      ['structured.output', 'supported', 'the CLI accepts --json-schema'],
      ['image.generate', 'unsupported', 'Claude Code answers in text only'],
      ['image.edit', 'unsupported', 'Claude Code answers in text only'],
      ['embeddings.create', 'unsupported', 'the CLI has no embeddings API'],
    ]),
  checkConfig: (_method, config) => {
    const dir = config.configDir?.trim();
    if (dir && !/^([A-Za-z]:[\\/]|\\\\|\/)/.test(dir)) return 'The Claude config folder must be a full path, e.g. D:\\Claude\\work';
    return null;
  },
};
