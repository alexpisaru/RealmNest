// The Anthropic API in the provider catalogue: one method (an API key from the Anthropic
// Console, kept in the OS credential store), the models that key can use, stateless chat.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { modelCapabilities } from '../../capabilities/model';
import { AnthropicProvider, ANTHROPIC_API_ID } from './provider';
import type { AnthropicTransport } from './transport';

export function createAnthropicDefinition(transport: AnthropicTransport): ProviderDefinition {
  return {
    id: ANTHROPIC_API_ID,
    name: 'Anthropic API',
    vendor: 'Anthropic',
    description: 'Claude models with an API key from the Anthropic Console (billed per use).',
    availability: 'available',
    methods: [
      {
        id: 'api-key',
        label: 'API key',
        description: 'Create a key at console.anthropic.com. RealmNest stores it in your computer’s credential store and never shows it again.',
        fields: [{ key: 'apiKey', label: 'Anthropic API key', kind: 'secret', required: true, placeholder: 'sk-ant-…' }],
      },
    ],
    create: (connection) => new AnthropicProvider(connection.id, transport),
    capabilities: (_c, a) =>
      claims('Anthropic API', [
        ['text.chat', 'supported', 'Messages API'],
        ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'server-sent events'],
        ['tools.calling', 'supported', 'tool_use blocks'],
        ['vision.input', 'supported', 'image content blocks'],
        ['files.input', 'supported', 'PDF document blocks'],
        ['sessions.native', 'unsupported', 'the Messages API keeps no conversation; RealmNest sends the history'],
        ['embeddings.create', 'unsupported', 'Anthropic has no embeddings API'],
        ['image.generate', 'unsupported', 'Claude answers in text'],
        ['web.search', 'supported', 'the server web_search tool (billed per search)'],
      ]),
    modelCapabilities: (m) => modelCapabilities(m, 'Anthropic model list'),
  };
}
