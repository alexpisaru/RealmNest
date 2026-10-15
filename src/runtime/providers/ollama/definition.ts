// Ollama in the provider catalogue: one method (this PC, no key), the models
// installed locally with what Ollama says each can do, stateless chat,
// embeddings with a local embedding model. RealmNest starts Ollama when needed.

import { claims, type ProviderDefinition } from '../../connections/catalog';
import { modelCapabilities } from '../../capabilities/model';
import { OllamaProvider, OLLAMA_ID } from './provider';
import type { OllamaTransport } from './transport';

export function createOllamaDefinition(transport: OllamaTransport): ProviderDefinition {
  return {
    id: OLLAMA_ID,
    name: 'Ollama',
    vendor: 'Ollama',
    description: 'Open models running on this PC (Gemma, Qwen…). Free, and nothing leaves the computer.',
    availability: 'available',
    methods: [
      {
        id: 'local-endpoint',
        label: 'This PC',
        description: 'RealmNest talks to Ollama at 127.0.0.1:11434 and starts it when it is not running. Install Ollama from ollama.com and pull a model first.',
        fields: [],
      },
    ],
    create: (connection) => new OllamaProvider(connection.id, transport),
    // connection level: tools and vision are per model (Ollama's /api/show capabilities)
    capabilities: (_c, a) =>
      claims('Ollama', [
        ['text.chat', 'supported', 'OpenAI-compatible chat completions (/v1)'],
        ['text.streaming', a.streaming ? 'supported' : 'unsupported', 'server-sent events'],
        ['sessions.native', 'unsupported', 'chat completions keep no conversation; RealmNest sends the history'],
        ['files.input', 'unsupported', 'the compatible endpoint takes no PDF parts'],
        ['embeddings.create', 'supported', 'embeddings with a local embedding model (/v1/embeddings)'],
        ['image.generate', 'unsupported', 'local models answer in text'],
        ['web.search', 'unsupported', 'local models have no web search'],
      ]),
    modelCapabilities: (m) => modelCapabilities(m, 'Ollama /api/show'),
    requiresModel: true,
  };
}
