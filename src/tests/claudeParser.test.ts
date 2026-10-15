import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ClaudeStreamParser } from '../runtime/providers/claude-code/parser';
import type { ProviderEventBody } from '../runtime/providers/types';

// not-logged-in.jsonl, success-real.jsonl: captured from Claude Code 2.1.293 (init line reduced).
// *.sample.jsonl: written from the stream-json format (Anthropic streaming
// events wrapped by Claude Code) to exercise paths a signed-out CLI cannot produce.
const fixture = (name: string) => readFileSync(join(__dirname, 'fixtures', 'claude-code', name), 'utf8').split('\n');

function parse(lines: string[], opts = {}) {
  const p = new ClaudeStreamParser(opts);
  const events = lines.flatMap((l) => p.push(l).map((e) => e.body));
  return { p, events, types: events.map((e) => e.type) };
}

const of = <T extends ProviderEventBody['type']>(events: ProviderEventBody[], type: T) => events.filter((e): e is Extract<ProviderEventBody, { type: T }> => e.type === type);

describe('Claude Code stream parser', () => {
  it('normalizes a streamed text turn without duplicating the complete message', () => {
    const { events, types, p } = parse(fixture('success-partial.sample.jsonl'));
    expect(types).toEqual(['session.started', 'message.started', 'text.delta', 'text.delta', 'text.completed', 'usage.updated', 'usage.updated', 'run.completed']);
    expect(of(events, 'session.started')[0]).toMatchObject({ sessionId: '0b8f3c2e-5d4a-4c1e-9f7b-2a6d8e1c3f50', model: 'claude-opus-5-5', tools: [], resumed: false });
    expect(of(events, 'text.delta').map((e) => e.text).join('')).toBe('RealmNest provider test successful.');
    expect(of(events, 'text.completed')[0]).toMatchObject({ messageId: 'msg_01NESTRA', index: 0, text: 'RealmNest provider test successful.' });
    const [perMessage, total] = of(events, 'usage.updated');
    expect(perMessage).toMatchObject({ cumulative: false, usage: { inputTokens: 12, outputTokens: 9, cacheReadTokens: 2048 } });
    expect(total).toMatchObject({ cumulative: true, costUsd: 0.0031 });
    expect(of(events, 'run.completed')[0]).toMatchObject({ text: 'RealmNest provider test successful.', durationMs: 1840, turns: 1, stopReason: 'end_turn', costUsd: 0.0031 });
    expect(p.finished).toBe(true);
  });

  it('normalizes the real signed-in stream (assistant message arrives before content_block_stop)', () => {
    const { events, types } = parse(fixture('success-real.jsonl'));
    expect(types).toEqual(['session.started', 'message.started', 'text.delta', 'text.delta', 'text.completed', 'usage.updated', 'limits.updated', 'usage.updated', 'run.completed']);
    // the plan's windows, as the real stream reports them
    expect(of(events, 'limits.updated')[0].limits.windows.map((w) => w.id)).toContain('five_hour');
    expect(of(events, 'session.started')[0].tools).toEqual([]); // --tools "" and --strict-mcp-config
    expect(of(events, 'text.delta').map((e) => e.text).join('')).toBe('RealmNest provider test successful.');
    expect(of(events, 'text.completed').map((e) => e.text)).toEqual(['RealmNest provider test successful.']);
    expect(of(events, 'run.completed')[0]).toMatchObject({ text: 'RealmNest provider test successful.', stopReason: 'end_turn' });
  });

  it('reports tool requests (with full input) and results', () => {
    const { events, types } = parse(fixture('tool-use.sample.jsonl'));
    expect(types.filter((t) => t.startsWith('tool.'))).toEqual(['tool.requested', 'tool.completed']);
    expect(of(events, 'tool.requested')[0]).toMatchObject({ toolCallId: 'toolu_1', name: 'Read', input: { file_path: 'notes.md' }, messageId: 'msg_A' });
    expect(of(events, 'tool.completed')[0]).toMatchObject({ toolCallId: 'toolu_1', isError: false, output: '# Notes\nship it' });
    // tool_use blocks are not text: only the second message produced text
    expect(of(events, 'text.completed').map((e) => e.text)).toEqual(['The notes say: ship it.']);
    expect(of(events, 'message.started').map((e) => e.messageId)).toEqual(['msg_A', 'msg_B']);
  });

  it('takes text from complete messages when partial streaming is off', () => {
    const lines = [
      '{"type":"system","subtype":"init","session_id":"s1","model":"m"}',
      '{"type":"assistant","message":{"id":"msg_X","model":"m","content":[{"type":"text","text":"hello"}]},"parent_tool_use_id":null}',
      '{"type":"result","subtype":"success","is_error":false,"result":"hello","session_id":"s1"}',
    ];
    const { events, types } = parse(lines);
    expect(types).toEqual(['session.started', 'message.started', 'text.completed', 'run.completed']);
    expect(of(events, 'text.completed')[0].text).toBe('hello');
  });

  it('turns the real signed-out stream into a not_authenticated failure', () => {
    const { events, types } = parse(fixture('not-logged-in.jsonl'));
    expect(types).toEqual(['session.started', 'provider.error', 'usage.updated', 'run.failed']);
    const failed = of(events, 'run.failed')[0];
    expect(failed.error.code).toBe('not_authenticated');
    expect(failed.error.message).toMatch(/not signed in/i);
    expect(failed.error.detail).toContain('Not logged in');
    // the synthetic error message must not be shown as model text
    expect(types).not.toContain('text.completed');
  });

  it('marks a resumed session', () => {
    const { events } = parse(['{"type":"system","subtype":"init","session_id":"s2"}'], { resumed: true });
    expect(of(events, 'session.started')[0].resumed).toBe(true);
  });

  it('skips malformed lines with a non-fatal error and keeps going', () => {
    const lines = ['not json at all', '{"no_type":1}', '[]', '', ...fixture('success-partial.sample.jsonl')];
    const { events, types, p } = parse(lines);
    const errors = of(events, 'provider.error');
    expect(errors).toHaveLength(3);
    expect(errors.every((e) => e.error.code === 'malformed_event')).toBe(true);
    expect(types[types.length - 1]).toBe('run.completed');
    expect(p.finished).toBe(true);
  });

  it('reports structurally broken known messages as malformed instead of throwing', () => {
    const { events } = parse(['{"type":"stream_event"}', '{"type":"assistant","message":{"content":[{"type":"text","text":"x"}]}}']);
    expect(events.map((e) => e.type)).toEqual(['provider.error', 'provider.error']);
  });

  it('maps result error subtypes', () => {
    const { events } = parse(['{"type":"result","subtype":"error_max_turns","is_error":true,"num_turns":30}']);
    expect(of(events, 'run.failed')[0].error.code).toBe('max_turns');
  });

  it('redacts secrets in malformed-line details', () => {
    const { events } = parse(['oops Authorization: Bearer abcdefghijklmnop sk-ant-api03-SECRETSECRET']);
    const detail = of(events, 'provider.error')[0].error.detail ?? '';
    expect(detail).not.toContain('abcdefghijklmnop');
    expect(detail).not.toContain('SECRETSECRET');
  });

  it('produces a single terminal event even if Claude repeats the result', () => {
    const r = '{"type":"result","subtype":"success","is_error":false,"result":"a"}';
    const { types } = parse([r, r]);
    expect(types.filter((t) => t.startsWith('run.'))).toEqual(['run.completed']);
  });
});
