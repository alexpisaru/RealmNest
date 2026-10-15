import { describe, expect, it } from 'vitest';
import { EventBus } from '../core/events';
import { attachmentKind, attachmentProblem, ATTACHMENT_LIMITS, withTextAttachments, type AttachmentInput } from '../domain/attachment';
import { MemoryAdapter } from '../persistence/storage';
import { ConversationRuntime } from '../runtime/chat/conversationRuntime';
import { ConversationRepository } from '../runtime/chat/repository';
import { checkClaudeArgs, turnArgs } from '../runtime/providers/claude-code/args';
import { userLine } from '../runtime/providers/claude-code/provider';
import { toOrMessage } from '../runtime/providers/openrouter/provider';
import { ProviderRegistry } from '../runtime/providers/registry';
import { ProviderService } from '../runtime/providers/service';
import type { AIProvider, ProviderCapabilities, ProviderEvent, ProviderTurnRequest } from '../runtime/providers/types';

// Chat attachments: text files are written into the message for every provider;
// images and PDFs reach adapters that take them, and their bytes are never saved.

const tick = () => new Promise((r) => setTimeout(r, 0));
const until = async (cond: () => boolean) => {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
  expect(cond()).toBe(true);
};

class Recorder implements AIProvider {
  readonly name: string;
  requests: ProviderTurnRequest[] = [];
  constructor(
    readonly id: string,
    readonly capabilities: ProviderCapabilities,
  ) {
    this.name = id;
  }
  async getStatus() {
    return { state: 'available' as const, message: 'ok', checkedAt: 0 };
  }
  async *runTurn(req: ProviderTurnRequest): AsyncGenerator<ProviderEvent> {
    this.requests.push(req);
    await tick();
    yield { type: 'run.completed', text: 'seen', runId: req.runId, providerId: this.id, seq: 1, at: 0, ...(req.session && { sessionId: 's1' }) };
  }
}

const BASE: ProviderCapabilities = { streaming: true, tools: false, vision: false, sessions: false, local: false, usage: false, cost: false, cancellation: true, modelListing: false, systemPrompt: true };
const PNG = 'iVBORw0KGgo=';
const image: AttachmentInput = { name: 'red.png', mime: 'image/png', size: 8, kind: 'image', data: PNG };
const pdf: AttachmentInput = { name: 'doc.pdf', mime: 'application/pdf', size: 5, kind: 'pdf', data: 'JVBERi0=' };
const note: AttachmentInput = { name: 'notes.md', mime: 'text/markdown', size: 11, kind: 'text', text: '# Plan\nship' };

function setup(storage = new MemoryAdapter()) {
  const bus = new EventBus(500);
  const plain = new Recorder('plain', BASE);
  const visual = new Recorder('visual', { ...BASE, vision: true, files: true });
  const sessions = new Recorder('sessions', { ...BASE, vision: true, files: true, sessions: true });
  const providers = new ProviderService(new ProviderRegistry().register(plain).register(visual).register(sessions), bus);
  let n = 0;
  const chat = new ConversationRuntime(bus, providers, new ConversationRepository(storage, 5), { newId: (k) => `${k}-${++n}` });
  return { chat, plain, visual, sessions, storage };
}

describe('attachment rules', () => {
  it('knows what it can send', () => {
    expect(attachmentKind('a.png', 'image/png')).toBe('image');
    expect(attachmentKind('a.pdf', '')).toBe('pdf');
    expect(attachmentKind('main.rs', '')).toBe('text');
    expect(attachmentKind('data.csv', 'text/csv')).toBe('text');
    expect(attachmentKind('setup.exe', 'application/x-msdownload')).toBeUndefined();
    expect(attachmentKind('photo.heic', 'image/heic')).toBeUndefined();
  });

  it('limits count and size', () => {
    expect(attachmentProblem([note, note, note, note, note])).toMatch(/At most 4/);
    expect(attachmentProblem([{ ...image, size: ATTACHMENT_LIMITS.imageBytes + 1 }])).toMatch(/red.png is larger/);
    expect(attachmentProblem([note, image])).toBeUndefined();
  });

  it('writes text files into the message', () => {
    expect(withTextAttachments('Summarise', [note])).toBe('Summarise\n\n<attachment name="notes.md">\n# Plan\nship\n</attachment>');
    expect(withTextAttachments('', [note])).toMatch(/^See the attached files\./);
    expect(withTextAttachments('hi')).toBe('hi');
  });
});

describe('sending attachments', () => {
  it('sends images and PDFs to an adapter that takes them, text files to all', async () => {
    const { chat, visual } = setup();
    const c = chat.create({ connectionId: 'visual' });
    chat.send(c.id, 'What is this?', [image, pdf, note]);
    await until(() => !chat.isBusy(c.id));
    const sent = visual.requests[0].messages.at(-1)!;
    expect(sent.content).toContain('<attachment name="notes.md">');
    expect(sent.attachments).toEqual([
      { kind: 'image', name: 'red.png', mime: 'image/png', data: PNG },
      { kind: 'pdf', name: 'doc.pdf', mime: 'application/pdf', data: 'JVBERi0=' },
    ]);
    const user = chat.get(c.id)!.messages[0];
    expect(user.attachments!.map((a) => a.name)).toEqual(['red.png', 'doc.pdf', 'notes.md']);
    expect(chat.attachmentData(user.attachments![0].id)).toBe(PNG);
  });

  it('refuses images for an adapter that cannot take them, before anything is sent', () => {
    const { chat, plain } = setup();
    const c = chat.create({ connectionId: 'plain' });
    expect(() => chat.send(c.id, 'look', [image])).toThrow(/cannot take images/);
    expect(() => chat.send(c.id, 'read', [pdf])).toThrow(/cannot take PDFs/);
    expect(chat.get(c.id)!.messages).toEqual([]);
    expect(plain.requests).toEqual([]);
  });

  it('accepts a message made only of attachments and names the chat after the file', async () => {
    const { chat, plain } = setup();
    const c = chat.create({ connectionId: 'plain' });
    chat.send(c.id, '', [note]);
    await until(() => !chat.isBusy(c.id));
    expect(chat.get(c.id)!.title).toBe('notes.md');
    expect(plain.requests[0].messages[0].content).toMatch(/^See the attached files\./);
  });

  it('never saves image or PDF bytes, and says so when they are gone after a restart', async () => {
    const storage = new MemoryAdapter();
    const a = setup(storage);
    const c = a.chat.create({ connectionId: 'visual' });
    a.chat.send(c.id, 'first', [image, note]);
    await until(() => !a.chat.isBusy(c.id));
    await a.chat['repo'].flush(a.chat.snapshot);
    const saved = JSON.stringify(await storage.get('conversations'));
    expect(saved).not.toContain(PNG);
    expect(saved).toContain('# Plan'); // text files are kept

    const b = setup(storage);
    await b.chat.init();
    b.chat.send(c.id, 'second');
    await until(() => !b.chat.isBusy(c.id));
    const history = b.visual.requests[0].messages;
    expect(history[0].content).toMatch(/red.png \(image\) was attached here; its contents are no longer available/);
    expect(history[0].content).toContain('<attachment name="notes.md">');
    expect(history[0].attachments).toBeUndefined();
  });

  it('a session provider gets only the new message, with its files', async () => {
    const { chat, sessions } = setup();
    const c = chat.create({ connectionId: 'sessions' });
    chat.send(c.id, 'one', [image]);
    await until(() => !chat.isBusy(c.id));
    chat.send(c.id, 'two');
    await until(() => !chat.isBusy(c.id));
    expect(sessions.requests[0].messages).toHaveLength(1);
    expect(sessions.requests[0].messages[0].attachments).toHaveLength(1);
    expect(sessions.requests[1].messages).toEqual([{ role: 'user', content: 'two' }]);
  });

  it('can send the same files again (retry) and forgets them with the conversation', async () => {
    const { chat } = setup();
    const c = chat.create({ connectionId: 'visual' });
    chat.send(c.id, 'look', [image, note]);
    await until(() => !chat.isBusy(c.id));
    const user = chat.get(c.id)!.messages[0];
    expect(chat.attachmentInputs(user.id)).toMatchObject([
      { name: 'red.png', mime: 'image/png', size: 8, kind: 'image', data: PNG },
      { name: 'notes.md', mime: 'text/markdown', size: 11, kind: 'text', text: '# Plan\nship' },
    ]);
    const id = user.attachments![0].id;
    chat.remove(c.id);
    expect(chat.attachmentData(id)).toBeUndefined();
  });
});

describe('adapters', () => {
  it('OpenRouter: data URL parts, plain text otherwise', () => {
    expect(toOrMessage({ role: 'user', content: 'hi' })).toEqual({ role: 'user', content: 'hi' });
    expect(toOrMessage({ role: 'user', content: 'what?', attachments: [{ kind: 'image', name: 'r.png', mime: 'image/png', data: PNG }, { kind: 'pdf', name: 'd.pdf', mime: 'application/pdf', data: 'JVBERi0=' }] })).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'what?' },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${PNG}` } },
        { type: 'file', file: { filename: 'd.pdf', file_data: 'data:application/pdf;base64,JVBERi0=' } },
      ],
    });
  });

  it('Claude Code: one stream-json user line, allowed by the argument allowlist', () => {
    const line = userLine('what?', [{ kind: 'image', name: 'r.png', mime: 'image/png', data: PNG }, { kind: 'pdf', name: 'd.pdf', mime: 'application/pdf', data: 'JVBERi0=' }]);
    expect(line.endsWith('\n')).toBe(true);
    expect(JSON.parse(line)).toEqual({
      type: 'user',
      message: {
        role: 'user',
        content: [
          { type: 'text', text: 'what?' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0=' } },
        ],
      },
    });
    const args = turnArgs({ tools: [], jsonInput: true });
    expect(args).toContain('--input-format');
    expect(checkClaudeArgs(args)).toBeNull();
    expect(turnArgs({ tools: [] })).not.toContain('--input-format');
  });
});
