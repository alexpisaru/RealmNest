// Short conversation titles written by the conversation's own model, once,
// after the first reply. Optional (Settings › General, off by default) because
// it is one extra request. The chat never waits for it; any failure keeps the
// first-message title (conversationTitle).

import type { ProviderService } from '../providers/service';

export interface TitleRequest {
  connectionId: string;
  model?: string;
  firstMessage: string;
  firstReply: string;
}

/** resolves to a title, or undefined when none came back */
export type Titler = (req: TitleRequest) => Promise<string | undefined>;

const MAX_TITLE = 60;
const CLIP = 1_500;
const TIMEOUT_MS = 30_000;
const QUOTES = /^["'“”‘’«»*`]+|["'“”‘’«»*`]+$/g;

/** one line, no quotes or trailing punctuation, at most MAX_TITLE characters */
export function cleanTitle(raw: string): string {
  let t = raw.replace(/\s+/g, ' ').trim();
  t = t.replace(/^(title|titolo)\s*:\s*/i, '');
  t = t.replace(QUOTES, '').trim();
  t = t.replace(/[\s.,;:!?…-]+$/u, '');
  if (t.length > MAX_TITLE) {
    const cut = t.slice(0, MAX_TITLE + 1);
    const space = cut.lastIndexOf(' ');
    t = space > MAX_TITLE * 0.5 ? cut.slice(0, space) : t.slice(0, MAX_TITLE);
  }
  return t;
}

export const TITLE_PROMPT =
  'Write a title of 2 to 6 words for the conversation below, in the language of the user message. Reply with the title only: no quotes, no punctuation at the end.';

/** a Titler that runs one short, stateless turn on the conversation's connection */
export function providerTitler(providers: ProviderService, timeoutMs = TIMEOUT_MS): Titler {
  return async ({ connectionId, model, firstMessage, firstReply }) => {
    const run = providers.run(connectionId, {
      model,
      systemPrompt: TITLE_PROMPT,
      messages: [{ role: 'user', content: `User: ${firstMessage.slice(0, CLIP)}\n\nAssistant: ${firstReply.slice(0, CLIP)}` }],
    });
    const timer = setTimeout(() => void run.cancel(), timeoutMs);
    try {
      const end = await run.done;
      return end.type === 'run.completed' && end.text ? end.text : undefined;
    } finally {
      clearTimeout(timer);
    }
  };
}
