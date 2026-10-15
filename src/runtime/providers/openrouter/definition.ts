// OpenRouter in the provider catalogue: one method (an API key, kept in the OS
// credential store), a live model catalogue, stateless chat.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { modelCapabilities } from '../../capabilities/model';
import { OpenRouterProvider, OPENROUTER_ID } from './provider';
import type { OpenRouterTransport } from './transport';

/** OpenRouter's own router: a real model id from its catalogue, picks a model per request */
export const OPENROUTER_AUTO = 'openrouter/auto';

export function createOpenRouterDefinition(transport: OpenRouterTransport): ProviderDefinition {
  return {
    id: OPENROUTER_ID,
    name: 'OpenRouter',
    vendor: 'OpenRouter',
    description: 'Hundreds of models (Anthropic, OpenAI, Google, open models…) through one API key.',
    availability: 'available',
    methods: [
      {
        id: 'api-key',
        label: 'API key',
        description: 'Create a key at openrouter.ai/keys. RealmNest stores it in your computer’s credential store and never shows it again.',
        fields: [{ key: 'apiKey', label: 'OpenRouter API key', kind: 'secret', required: true, placeholder: 'sk-or-…' }],
      },
    ],
    create: (connection) => new OpenRouterProvider(connection.id, transport),
    // connection level: only what holds for every model; the rest comes from each model's metadata
    capabilities: (_c, a) =>
      claims('OpenRouter', [
        ['text.chat', 'supported', 'chat completions API'],
        ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'server-sent events'],
        ['sessions.native', 'unsupported', 'chat completions keep no conversation; RealmNest sends the history'],
        ['embeddings.create', 'supported', 'embeddings API (/api/v1/embeddings) with its own model list'],
        ['web.search', 'supported', 'the web plugin (paid per search, needs credits)'],
      ]),
    modelCapabilities: (m) => modelCapabilities(m, 'OpenRouter model catalogue'),
    requiresModel: true,
  };
}
