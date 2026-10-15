import { describe, expect, it } from 'vitest';
import { AnthropicProvider, ANTHROPIC_DEFAULT_MODEL, toAnMessages } from '../runtime/providers/anthropic/provider';
import type { AnRequest, AnthropicTransport } from '../runtime/providers/anthropic/transport';
import type { OrStreamEvent, OrValidation } from '../runtime/providers/openrouter/transport';
import type { ProviderEvent } from '../runtime/providers/types';

// The Anthropic API connection: history in the Messages shape, the stream mapped to
// provider events, tools both ways. The HTTP side is Rust (src-tauri/src/anthropic).

class FakeTransport implements AnthropicTransport {
  readonly available = true;
  requests: AnRequest[] = [];
  constructor(private script: OrStreamEvent[], private validation: OrValidation = { status: 'connected', message: 'ok' }) {}
  async validate() {
    return this.validation;
  }
  async models() {
    return [{ id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' }];
  }
  async chat(_c: string, request: AnRequest, onEvent: (e: OrStreamEvent) => void) {
    this.requests.push(request);
    setTimeout(() => this.script.forEach(onEvent), 0);
    return 'an1';
  }
  async cancel() {
    return true;
  }
}

const collect = async (gen: AsyncGenerator<ProviderEvent>) => {
  const out: ProviderEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
};

describe('Anthropic API', () => {
  it('history: tool calls are tool_use, results are user tool_result, same-role turns merge', () => {
    const m = toAnMessages([
      { role: 'user', content: 'Read the page', attachments: [{ kind: 'image', mime: 'image/png', name: 'a.png', data: 'AAAA' }] },
      { role: 'assistant', content: '', toolCalls: [{ id: 't1', name: 'web_fetch', input: { url: 'https://example.com' } }] },
      { role: 'tool', content: 'page text', toolCallId: 't1' },
      { role: 'user', content: 'and?' },
    ]);
    expect(m).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'Read the page' }, { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAAA' } }] },
      { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'web_fetch', input: { url: 'https://example.com' } }] },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'page text' }, { type: 'text', text: 'and?' }] },
    ]);
  });

  it('a turn: system field, tools, default model; text, usage and tool calls come back as events', async () => {
    const t = new FakeTransport([
      { t: 'start', model: ANTHROPIC_DEFAULT_MODEL },
      { t: 'delta', d: 'Let me look.' },
      { t: 'usage', prompt: 10, completion: 4 },
      { t: 'tool', id: 'toolu_1', name: 'web_fetch', args: '{"url":"https://example.com"}' },
      { t: 'done', finishReason: 'tool_calls' },
    ]);
    const p = new AnthropicProvider('conn-a', t);
    const events = await collect(p.runTurn({ runId: 'r1', systemPrompt: 'Be brief.', messages: [{ role: 'user', content: 'hi' }], toolSchemas: [{ name: 'web_fetch', description: 'read a page', parameters: { type: 'object' } }] }));
    expect(t.requests[0]).toMatchObject({ model: ANTHROPIC_DEFAULT_MODEL, system: 'Be brief.', tools: [{ name: 'web_fetch', description: 'read a page', input_schema: { type: 'object' } }] });
    expect(events.map((e) => e.type)).toEqual(['provider.started', 'message.started', 'text.delta', 'usage.updated', 'tool.requested', 'text.completed', 'run.completed']);
    expect(events.find((e) => e.type === 'tool.requested')).toMatchObject({ toolCallId: 'toolu_1', name: 'web_fetch', input: { url: 'https://example.com' } });
    expect(events.at(-1)).toMatchObject({ type: 'run.completed', text: 'Let me look.', stopReason: 'tool_calls', usage: { inputTokens: 10, outputTokens: 4 } });
  });

  it('errors and key problems are normalized', async () => {
    const p = new AnthropicProvider('c', new FakeTransport([{ t: 'error', code: 'rate_limited', message: 'slow down', status: 429 }]));
    const ev = await collect(p.runTurn({ runId: 'r', model: 'claude-haiku-5-5', messages: [{ role: 'user', content: 'x' }] }));
    expect(ev.at(-1)).toMatchObject({ type: 'run.failed', error: { code: 'rate_limited', detail: 'HTTP 429' } });
    expect((await new AnthropicProvider('c', new FakeTransport([], { status: 'invalid_credentials', message: 'no' })).getStatus()).state).toBe('invalid_credentials');
    expect((await new AnthropicProvider('c', new FakeTransport([], { status: 'connected', message: 'ok' })).getStatus()).state).toBe('available');
  });
});
