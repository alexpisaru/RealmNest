// The OpenAI API in the provider catalogue: one method (an API key from
// platform.openai.com, kept in the OS credential store), the models that key
// can use (GET /models), stateless chat completions, embeddings.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { modelCapabilities } from '../../capabilities/model';
import { OpenAiProvider, OPENAI_API_ID } from './provider';
import type { OpenAiTransport } from './transport';

export function createOpenAiDefinition(transport: OpenAiTransport): ProviderDefinition {
  return {
    id: OPENAI_API_ID,
    name: 'OpenAI API',
    vendor: 'OpenAI',
    description: 'GPT models with an API key from platform.openai.com (billed per use).',
    availability: 'available',
    methods: [
      {
        id: 'api-key',
        label: 'API key',
        description: 'Create a key at platform.openai.com/api-keys. RealmNest stores it in your computer’s credential store and never shows it again.',
        fields: [{ key: 'apiKey', label: 'OpenAI API key', kind: 'secret', required: true, placeholder: 'sk-…' }],
      },
    ],
    create: (connection) => new OpenAiProvider(connection.id, transport),
    // connection level; OpenAI's model list says nothing per model, so these hold unless a model's metadata says otherwise
    capabilities: (_c, a) =>
      claims('OpenAI API', [
        ['text.chat', 'supported', 'chat completions API'],
        ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'server-sent events'],
        ['tools.calling', 'supported', 'function calling (tools)'],
        ['vision.input', 'supported', 'image_url content parts (vision models)'],
        ['files.input', 'supported', 'PDF file content parts'],
        ['structured.output', 'supported', 'response_format json_schema'],
        ['sessions.native', 'unsupported', 'chat completions keep no conversation; RealmNest sends the history'],
        ['embeddings.create', 'supported', 'embeddings API (/v1/embeddings)'],
        ['web.search', 'unsupported', 'not offered through chat completions in RealmNest'],
      ]),
    modelCapabilities: (m) => modelCapabilities(m, 'OpenAI model list'),
    requiresModel: true,
  };
}
