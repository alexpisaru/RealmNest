// ChatGPT in the provider catalogue: your ChatGPT account (Plus, Pro, Business…), signed in
// through OpenAI's Codex CLI, with the account's models to choose from. Codex runs the turns
// underneath, with its own tools switched off. Each connection may point at its own Codex
// folder (CODEX_HOME), i.e. a separate account.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { modelCapabilities } from '../../capabilities/model';
import { UnavailableCodexModels, type CodexModelSource } from './models';
import { CODEX_ID, CodexProvider } from './provider';

const ABSOLUTE = /^([A-Za-z]:[\\/]|\\\\|\/)/;

export function createCodexDefinition(models: CodexModelSource = new UnavailableCodexModels()): ProviderDefinition {
  return {
    id: CODEX_ID,
    name: 'ChatGPT',
    vendor: 'OpenAI',
    description: 'Your ChatGPT account (Plus, Pro, Business): sign in and choose the GPT models of your plan.',
    availability: 'available',
    methods: [
      {
        id: 'cli-session',
        label: 'ChatGPT account',
        description: 'Sign in with your ChatGPT account through Codex. RealmNest never sees your password or tokens.',
        fields: [
          {
            key: 'configDir',
            label: 'Codex folder',
            kind: 'folder',
            placeholder: 'Default (the account already signed in on this computer)',
            help: 'Optional. A different folder (CODEX_HOME) holds a different ChatGPT account; sign in to it from the connection.',
          },
        ],
      },
    ],
    create: (connection, { runner }) => new CodexProvider(runner, { models, configDir: connection.config.configDir }),
    // what Codex itself can do; whether RealmNest can use it today is decided by the capability service
    capabilities: (_c, a) =>
      claims('Codex CLI', [
        ['text.chat', 'supported', 'a GPT model of the ChatGPT plan behind the CLI'],
        ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'codex exec --json sends whole messages'],
        ['sessions.native', a.sessions ? 'supported' : 'unsupported', 'Codex keeps and resumes threads (codex exec resume)'],
        ['coding', 'supported', 'Codex is a coding agent'],
        ['text.reasoning', 'supported', 'reasoning models with effort levels'],
        ['tools.calling', 'supported', 'RealmNest tools through the RealmNest MCP bridge; Codex’s own tools stay off'],
        ['vision.input', 'unknown', 'codex exec -i takes image files; not wired in RealmNest yet'],
        ['files.input', 'unsupported', 'no document input through the CLI'],
        ['web.search', 'unsupported', 'Codex’s web search is switched off in RealmNest'],
        ['structured.output', 'unknown', 'codex exec --output-schema exists; not wired in RealmNest'],
        ['image.generate', 'unsupported', 'switched off in RealmNest'],
        ['image.edit', 'unsupported', 'switched off in RealmNest'],
        ['embeddings.create', 'unsupported', 'the CLI has no embeddings API'],
      ]),
    modelCapabilities: (m) => modelCapabilities(m, 'Codex model list'),
    checkConfig: (_method, config) => {
      const dir = config.configDir?.trim();
      if (dir && !ABSOLUTE.test(dir)) return 'The Codex folder must be a full path, e.g. D:\\Codex\\work';
      return null;
    },
  };
}
